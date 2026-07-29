#!/usr/bin/env node
/**
 * Gera `data/inep/indicadores-escolas.json` — o contexto de cada escola
 * municipal, cruzando cinco publicações do INEP num único dataset:
 *
 * | Indicador | Fonte | Ano |
 * |---|---|---|
 * | INSE (nível socioeconômico médio dos alunos) | Saeb/INSE por escola | 2023 |
 * | Complexidade de gestão (porte, turnos, etapas) | ICG por escola | 2021 |
 * | Distorção idade-série no fundamental | TDI por escola | 2024 |
 * | Aprovação e abandono no fundamental | Taxas de rendimento por escola | 2024 |
 * | Formação adequada dos docentes (Grupo 1) | AFD por escola | 2024 |
 *
 * ## Por que este dataset existe
 *
 * O IDEB sozinho pune a escola errada: uma nota 4,2 num INSE Nível II é outra
 * história que a mesma nota num Nível VI. Cruzar contexto e resultado separa
 * a escola fraca da escola de contexto duro que performa — e aponta onde o
 * abandono e a distorção estão fabricando a reprovação da Condicionalidade I
 * do VAAR (indicador de fluxo) anos antes de ela aparecer na portaria.
 *
 * ## Armadilhas dos arquivos do INEP (aprendidas na prática)
 *
 * - O `sharedStrings.xml` do AFD tem entradas rich-text (`<si>` com vários
 *   `<r><t>`). Contar cada `<t>` como uma string desloca todos os índices
 *   seguintes e espalha o nome do município pelas colunas numéricas — o parse
 *   correto agrupa por `<si>` e concatena os `<t>` internos.
 * - "--" é ausência (escola sem a etapa), não zero.
 * - ICG não tem linha de cabeçalho técnico (`CO_ENTIDADE`); o mapa é
 *   posicional a partir da linha que começa com "Ano".
 *
 * ## Uso
 *
 *     npm run dados:indicadores-escolas    # baixa as cinco fontes do INEP
 *     node --use-system-ca scripts/dados/gerar-indicadores-escolas.mjs \
 *       <inse.xlsx> <icg.zip> <tdi.zip> <rend.zip> <afd.zip>   # ou local
 *
 * O certificado do download.inep.gov.br tem cadeia incompleta; o wrapper npm
 * já roda com `--use-system-ca`.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInflateRaw, inflateRawSync } from "node:zlib";
import { StringDecoder } from "node:string_decoder";

const ANOS = { inse: 2023, icg: 2021, tdi: 2024, rendimento: 2024, afd: 2024 };

const FONTES = [
  { chave: "inse", url: "https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/2023/nivel_socioeconomico/INSE_2023_escolas.xlsx" },
  { chave: "icg", url: "https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/2021/ICG_2021_ESCOLAS.zip" },
  { chave: "tdi", url: "https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/2024/TDI_2024_ESCOLAS.zip" },
  { chave: "rendimento", url: "https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/2024/tx_rend_escolas_2024.zip" },
  { chave: "afd", url: "https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/2024/AFD_2024_ESCOLAS.zip" },
];

const DESTINO = join(process.cwd(), "data", "inep", "indicadores-escolas.json");

function log(mensagem) {
  console.log(`[indicadores-escolas] ${mensagem}`);
}

// ── ZIP: leitura pelo diretório central ─────────────────────────────────────

function entradasZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66_000); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("EOCD não encontrado — o arquivo não é um ZIP válido");

  const cdOffset = buf.readUInt32LE(eocd + 16);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const entradas = new Map();
  let p = cdOffset;
  while (p + 46 <= cdOffset + cdSize && buf.readUInt32LE(p) === 0x02014b50) {
    const metodo = buf.readUInt16LE(p + 10);
    const comprimido = buf.readUInt32LE(p + 20);
    const nomeLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const comentLen = buf.readUInt16LE(p + 32);
    const offsetLocal = buf.readUInt32LE(p + 42);
    entradas.set(buf.toString("utf8", p + 46, p + 46 + nomeLen), { comprimido, offsetLocal, metodo });
    p += 46 + nomeLen + extraLen + comentLen;
  }
  return entradas;
}

function bytesComprimidosDe(buf, entrada) {
  const nomeLen = buf.readUInt16LE(entrada.offsetLocal + 26);
  const extraLen = buf.readUInt16LE(entrada.offsetLocal + 28);
  const inicio = entrada.offsetLocal + 30 + nomeLen + extraLen;
  return buf.subarray(inicio, inicio + entrada.comprimido);
}

function conteudoDe(buf, entrada) {
  const bytes = bytesComprimidosDe(buf, entrada);
  return entrada.metodo === 0 ? bytes : inflateRawSync(bytes);
}

// ── XLSX ────────────────────────────────────────────────────────────────────

function decodificarXml(texto) {
  return texto
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Uma string por `<si>`, concatenando os `<t>` internos — entradas rich-text
 * têm vários `<r><t>` e contá-los separadamente desloca todos os índices.
 */
function stringsCompartilhadas(xml) {
  const out = [];
  for (const m of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    out.push(decodificarXml([...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((x) => x[1]).join("")));
  }
  return out;
}

/** "BC11" → 54. Células vazias podem ser omitidas; a referência é a verdade. */
function colunaDeRef(ref) {
  let n = 0;
  for (let i = 0; i < ref.length; i++) {
    const c = ref.charCodeAt(i);
    if (c >= 65 && c <= 90) n = n * 26 + (c - 64);
    else break;
  }
  return n - 1;
}

const REGEX_CELULA = /<c\s+([^>]*?)\/?>(?:<v>([^<]*)<\/v>)?(?:<\/c>)?/g;

function celulasDaLinha(xml, strings) {
  const celulas = new Map();
  for (const m of xml.matchAll(REGEX_CELULA)) {
    const attrs = m[1];
    const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1];
    if (!ref) continue;
    const bruto = m[2] ?? "";
    const valor = /t="s"/.test(attrs) ? strings[Number(bruto)] ?? "" : bruto;
    celulas.set(colunaDeRef(ref), valor);
  }
  return celulas;
}

/** Percorre a sheet em stream — os XMLs chegam a centenas de MB inflados. */
async function porLinha(bytesComprimidos, aoEncontrarLinha) {
  await new Promise((resolver, rejeitar) => {
    const inflador = createInflateRaw();
    const decodificador = new StringDecoder("utf8");
    let resto = "";

    inflador.on("data", (pedaco) => {
      resto += decodificador.write(pedaco);
      let corte;
      while ((corte = resto.indexOf("</row>")) >= 0) {
        const inicio = resto.lastIndexOf("<row", corte);
        if (inicio >= 0) aoEncontrarLinha(resto.slice(inicio, corte));
        resto = resto.slice(corte + 6);
      }
      if (!resto.includes("<row")) resto = "";
    });
    inflador.on("end", resolver);
    inflador.on("error", rejeitar);
    inflador.end(bytesComprimidos);
  });
}

async function abrirPlanilha(caminhoLocal, url) {
  let buf;
  if (caminhoLocal) {
    buf = readFileSync(caminhoLocal);
  } else {
    log(`baixando ${url}…`);
    const resposta = await fetch(url, { signal: AbortSignal.timeout(600_000) });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status} em ${url}`);
    buf = Buffer.from(await resposta.arrayBuffer());
  }

  // ZIP externo (com .xlsx dentro) ou o próprio .xlsx (que também é um ZIP,
  // mas com xl/workbook.xml em vez de um .xlsx entre as entradas).
  let externas = entradasZip(buf);
  const nomeXlsx = [...externas.keys()].find((n) => n.toLowerCase().endsWith(".xlsx"));
  if (nomeXlsx) {
    buf = conteudoDe(buf, externas.get(nomeXlsx));
    externas = entradasZip(buf);
  }

  const stringsEntry = externas.get("xl/sharedStrings.xml");
  const strings = stringsEntry ? stringsCompartilhadas(conteudoDe(buf, stringsEntry).toString("utf8")) : [];
  const sheet = externas.get("xl/worksheets/sheet1.xml");
  if (!sheet) throw new Error("xl/worksheets/sheet1.xml ausente");
  return { comprimidos: bytesComprimidosDe(buf, sheet), inflar: sheet.metodo !== 0, strings };
}

// ── Valores ─────────────────────────────────────────────────────────────────

/** "--" é ausência (escola sem a etapa), não zero. */
function numero(bruto, casas = 1) {
  if (bruto === undefined || bruto === null) return null;
  const texto = String(bruto).trim();
  if (texto === "" || texto === "-" || texto === "--") return null;
  const n = Number(texto.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const fator = 10 ** casas;
  return Math.round(n * fator) / fator;
}

const ROMANOS = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8 };

/** "Nível IV" → 4 · "Nível 4" → 4. */
function nivelPara(texto) {
  const m = /Nível\s+([IVX]+|\d+)/i.exec(String(texto ?? ""));
  if (!m) return null;
  const bruto = m[1].toUpperCase();
  return ROMANOS[bruto] ?? (Number.isFinite(Number(bruto)) ? Number(bruto) : null);
}

// ── Fontes → registros ──────────────────────────────────────────────────────

function escolaDe(municipios, codigoMunicipio, codigoEscola, nome) {
  let municipio = municipios[codigoMunicipio];
  if (!municipio) {
    municipio = { escolas: {} };
    municipios[codigoMunicipio] = municipio;
  }
  let escola = municipio.escolas[codigoEscola];
  if (!escola) {
    escola = {};
    municipio.escolas[codigoEscola] = escola;
  }
  if (nome && !escola.nome) escola.nome = nome;
  return escola;
}

/** INSE: cabeçalho técnico na primeira linha; rede municipal é TP_TIPO_REDE 3. */
async function processarInse(planilha, municipios) {
  let colunas = null;
  let aproveitadas = 0;
  await porLinha(planilha.comprimidos, (linhaXml) => {
    const celulas = celulasDaLinha(linhaXml, planilha.strings);
    if (!colunas) {
      for (const [, valor] of celulas) {
        if (valor === "ID_ESCOLA") {
          colunas = new Map();
          for (const [i, v] of celulas) if (v) colunas.set(String(v), i);
          return;
        }
      }
      return;
    }
    const em = (nome) => celulas.get(colunas.get(nome));
    if (String(em("TP_TIPO_REDE") ?? "").trim() !== "3") return;
    const codigoMunicipio = String(em("CO_MUNICIPIO") ?? "").trim();
    const codigoEscola = String(em("ID_ESCOLA") ?? "").trim();
    if (!/^\d{7}$/.test(codigoMunicipio) || !codigoEscola) return;

    const media = numero(em("MEDIA_INSE"), 2);
    if (media === null) return;
    const escola = escolaDe(municipios, codigoMunicipio, codigoEscola, String(em("NO_ESCOLA") ?? "").trim());
    escola.inse = media;
    escola.inseNivel = nivelPara(em("INSE_CLASSIFICACAO"));
    escola.inseAlunos = numero(em("QTD_ALUNOS_INSE"), 0);
    aproveitadas += 1;
  });
  if (!colunas) throw new Error("cabeçalho ID_ESCOLA não encontrado no INSE");
  log(`inse: ${aproveitadas.toLocaleString("pt-BR")} escolas municipais`);
}

/** ICG: sem cabeçalho técnico — mapa posicional a partir da linha "Ano". */
async function processarIcg(planilha, municipios) {
  let dentroDosDados = false;
  let aproveitadas = 0;
  await porLinha(planilha.comprimidos, (linhaXml) => {
    const celulas = celulasDaLinha(linhaXml, planilha.strings);
    if (!dentroDosDados) {
      if (String(celulas.get(0) ?? "") === "Ano") dentroDosDados = true;
      return;
    }
    if (String(celulas.get(8) ?? "") !== "Municipal") return;
    const codigoMunicipio = String(celulas.get(3) ?? "").trim();
    const codigoEscola = String(celulas.get(5) ?? "").trim();
    if (!/^\d{7}$/.test(codigoMunicipio) || !/^\d+$/.test(codigoEscola)) return;

    const nivel = nivelPara(celulas.get(9));
    if (nivel === null) return;
    const escola = escolaDe(municipios, codigoMunicipio, codigoEscola, String(celulas.get(6) ?? "").trim());
    escola.icg = nivel;
    aproveitadas += 1;
  });
  if (!dentroDosDados) throw new Error("linha de cabeçalho 'Ano' não encontrada no ICG");
  log(`icg: ${aproveitadas.toLocaleString("pt-BR")} escolas municipais`);
}

/** TDI/rendimento/AFD: cabeçalho técnico com CO_ENTIDADE, filtro NO_DEPENDENCIA. */
function processadorPorNome(chave, campos) {
  return async function processar(planilha, municipios) {
    let colunas = null;
    let aproveitadas = 0;
    await porLinha(planilha.comprimidos, (linhaXml) => {
      const celulas = celulasDaLinha(linhaXml, planilha.strings);
      if (!colunas) {
        for (const [, valor] of celulas) {
          if (valor === "CO_ENTIDADE") {
            colunas = new Map();
            for (const [i, v] of celulas) if (v) colunas.set(String(v), i);
            return;
          }
        }
        return;
      }
      const em = (nome) => celulas.get(colunas.get(nome));
      if (String(em("NO_DEPENDENCIA") ?? "") !== "Municipal") return;
      const codigoMunicipio = String(em("CO_MUNICIPIO") ?? "").trim();
      const codigoEscola = String(em("CO_ENTIDADE") ?? "").trim();
      if (!/^\d{7}$/.test(codigoMunicipio) || !/^\d+$/.test(codigoEscola)) return;

      const valores = [];
      for (const [destino, origem] of Object.entries(campos)) {
        const v = numero(em(origem));
        if (v !== null) valores.push([destino, v]);
      }
      if (valores.length === 0) return;
      const escola = escolaDe(municipios, codigoMunicipio, codigoEscola, String(em("NO_ENTIDADE") ?? "").trim());
      for (const [destino, v] of valores) escola[destino] = v;
      aproveitadas += 1;
    });
    if (!colunas) throw new Error(`cabeçalho CO_ENTIDADE não encontrado em ${chave}`);
    log(`${chave}: ${aproveitadas.toLocaleString("pt-BR")} escolas municipais`);
  };
}

const PROCESSADORES = {
  inse: processarInse,
  icg: processarIcg,
  // FUN_CAT_0: distorção no fundamental (total da etapa).
  tdi: processadorPorNome("tdi", { tdiFund: "FUN_CAT_0" }),
  // 1_ = aprovação, 3_ = abandono; _CAT_FUN é o total do fundamental.
  rendimento: processadorPorNome("rendimento", { aprovacaoFund: "1_CAT_FUN", abandonoFund: "3_CAT_FUN" }),
  // FUN_CAT_1: % de docentes do fundamental no Grupo 1 (formação adequada).
  afd: processadorPorNome("afd", { docentesAdequadosFund: "FUN_CAT_1" }),
};

async function main() {
  const locais = process.argv.slice(2);
  const municipios = {};

  for (let i = 0; i < FONTES.length; i++) {
    const { chave, url } = FONTES[i];
    const planilha = await abrirPlanilha(locais[i], url);
    await PROCESSADORES[chave](planilha, municipios);
  }

  const totalMunicipios = Object.keys(municipios).length;
  const totalEscolas = Object.values(municipios).reduce((t, m) => t + Object.keys(m.escolas).length, 0);
  if (totalMunicipios < 5000) {
    throw new Error(`só ${totalMunicipios} municípios aproveitados — o layout de alguma fonte mudou.`);
  }

  const conteudo = {
    _comentario:
      "Gerado por scripts/dados/gerar-indicadores-escolas.mjs. Não editar à mão. Regerar com: npm run dados:indicadores-escolas",
    fonte: "INEP — INSE, ICG, TDI, taxas de rendimento e AFD por escola (rede municipal)",
    anos: ANOS,
    geradoEm: new Date().toISOString(),
    municipios,
  };

  mkdirSync(dirname(DESTINO), { recursive: true });
  const json = JSON.stringify(conteudo);
  writeFileSync(DESTINO, json, "utf8");
  log(
    `escrito ${DESTINO} — ${(json.length / 1024 / 1024).toFixed(2)} MB, ` +
      `${totalMunicipios.toLocaleString("pt-BR")} municípios, ${totalEscolas.toLocaleString("pt-BR")} escolas`,
  );
}

main().catch((erro) => {
  console.error(`[indicadores-escolas] falhou: ${erro.message}`);
  process.exit(1);
});
