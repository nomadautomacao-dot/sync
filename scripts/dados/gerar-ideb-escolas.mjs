#!/usr/bin/env node
/**
 * Gera `data/inep/ideb-escolas-<edição>.json` — Saeb e IDEB **por escola** da
 * rede municipal, a partir das planilhas de divulgação do INEP. A edição sai
 * da constante `ANO` abaixo; ao atualizá-la, trocar também `ARQUIVO` em
 * `core/lib/ideb-escolas.ts` (o caminho lá é literal de propósito — é o que o
 * rastreamento do Next enxerga para levar o arquivo ao standalone).
 *
 * ## Por que este dataset existe
 *
 * A Condicionalidade II do VAAR exige 80% de participação no Saeb por ano
 * escolar avaliado — e ela reprova a **rede**, mas quem falta à prova é a
 * **escola**. O relatório precisava nomear onde a participação morreu, e a
 * média municipal esconde exatamente isso.
 *
 * ## Por que a planilha de divulgação, e não o microdado
 *
 * O microdado do Saeb é anonimizado (pós-LGPD): `ID_MUNICIPIO` e
 * `ID_ESCOLA` são máscaras — verificado em 2026-07-29 no Saeb 2023, zero
 * códigos IBGE reais em 5.569 municípios. A planilha de divulgação do IDEB é a
 * via **identificada** oficial: código INEP e nome de cada escola, notas Saeb,
 * IDEB observado e a marca `ND` — resultado não divulgado por não atingir o
 * critério de participação mínima de 80%.
 *
 * A projeção (meta) só existe até 2021: o INEP não projetou metas para o
 * ciclo seguinte, e é por isso que o campo se chama `meta2021`.
 *
 * ## Uso
 *
 *     npm run dados:ideb-escolas            # baixa os dois ZIPs do INEP
 *     node --use-system-ca scripts/dados/gerar-ideb-escolas.mjs <ai.zip> <af.zip>
 *
 * O certificado do download.inep.gov.br tem cadeia incompleta; o wrapper npm
 * já roda com `--use-system-ca`.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { createInflateRaw, inflateRawSync } from "node:zlib";
import { StringDecoder } from "node:string_decoder";

const ANO = 2025;
const FONTES = [
  { etapa: "ai", url: `https://download.inep.gov.br/ideb/resultados/divulgacao_anos_iniciais_escolas_${ANO}.zip` },
  { etapa: "af", url: `https://download.inep.gov.br/ideb/resultados/divulgacao_anos_finais_escolas_${ANO}.zip` },
];

const DESTINO = join(process.cwd(), "data", "inep", `ideb-escolas-${ANO}.json`);

function log(mensagem) {
  console.log(`[ideb-escolas] ${mensagem}`);
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
    const comprimido = buf.readUInt32LE(p + 20);
    const nomeLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const comentLen = buf.readUInt16LE(p + 32);
    const offsetLocal = buf.readUInt32LE(p + 42);
    entradas.set(buf.toString("utf8", p + 46, p + 46 + nomeLen), { comprimido, offsetLocal });
    p += 46 + nomeLen + extraLen + comentLen;
  }
  return entradas;
}

function bytesDe(buf, entrada) {
  const nomeLen = buf.readUInt16LE(entrada.offsetLocal + 26);
  const extraLen = buf.readUInt16LE(entrada.offsetLocal + 28);
  const inicio = entrada.offsetLocal + 30 + nomeLen + extraLen;
  return buf.subarray(inicio, inicio + entrada.comprimido);
}

// ── XLSX ────────────────────────────────────────────────────────────────────

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

const REGEX_CELULA = /<c\s+([^>]*)>(?:<v>([^<]*)<\/v>)?(?:<\/c>)?/g;

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

/**
 * Percorre a sheet inteira em stream — os XMLs têm até ~320 MB e carregar
 * tudo numa string só para regexar seria pedir para o V8 reclamar.
 */
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
      // Sem "<row" pendente o resto é só ruído entre linhas — descarta para
      // não acumular os 300 MB que este stream existe para evitar.
      if (!resto.includes("<row")) resto = "";
    });
    inflador.on("end", resolver);
    inflador.on("error", rejeitar);
    inflador.end(bytesComprimidos);
  });
}

// ── Valores ─────────────────────────────────────────────────────────────────

/**
 * "-" é ausência (escola sem a etapa ou sem o ciclo); "ND" é **retenção por
 * critério de divulgação** — participação abaixo de 80% no Saeb. A distinção
 * é o coração do dataset: ND é sinal de Condicionalidade II, "-" não é nada.
 */
function valorNumerico(bruto) {
  if (bruto === undefined || bruto === null) return { valor: null, nd: false };
  const texto = String(bruto).trim();
  if (texto === "" || texto === "-" || texto === "--") return { valor: null, nd: false };
  if (/^ND/i.test(texto)) return { valor: null, nd: true };
  const numero = Number(texto.replace(",", "."));
  return Number.isFinite(numero) ? { valor: Math.round(numero * 100) / 100, nd: false } : { valor: null, nd: false };
}

// ── Fonte → registros ───────────────────────────────────────────────────────

async function baixar(url) {
  log(`baixando ${url}…`);
  const resposta = await fetch(url, { signal: AbortSignal.timeout(600_000) });
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status} em ${url}`);
  return Buffer.from(await resposta.arrayBuffer());
}

async function processarFonte({ etapa, url }, caminhoLocal, destino) {
  const zip = caminhoLocal ? readFileSync(caminhoLocal) : await baixar(url);
  const externas = entradasZip(zip);
  const nomeXlsx = [...externas.keys()].find((n) => n.endsWith(".xlsx"));
  if (!nomeXlsx) throw new Error(`nenhum .xlsx dentro de ${url}`);

  const xlsx = inflateRawSync(bytesDe(zip, externas.get(nomeXlsx)));
  const internas = entradasZip(xlsx);

  // Agrupar por <si>, não achatar os <t>: uma string rich text tem várias
  // runs <t> dentro do mesmo <si> (os cabeçalhos humanos de 2025 têm), e
  // achatá-las desloca o índice de todas as strings seguintes — a planilha
  // inteira sai com os nomes de coluna trocados, em silêncio.
  const strings = [...inflateRawSync(bytesDe(xlsx, internas.get("xl/sharedStrings.xml")))
    .toString("utf8")
    .matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((si) =>
    [...si[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => t[1]).join(""),
  );

  let colunas = null; // nome → índice, montado na linha "SG_UF"
  let aproveitadas = 0;

  await porLinha(bytesDe(xlsx, internas.get("xl/worksheets/sheet1.xml")), (linhaXml) => {
    const celulas = celulasDaLinha(linhaXml, strings);

    if (!colunas) {
      // O cabeçalho técnico é a primeira linha que contém SG_UF. Mapear por
      // nome (e não por posição fixa) protege contra o INEP inserir coluna.
      for (const [indice, valor] of celulas) {
        if (valor === "SG_UF") {
          colunas = new Map();
          for (const [i, v] of celulas) if (v) colunas.set(String(v), i);
          return;
        }
      }
      return;
    }

    const em = (nome) => celulas.get(colunas.get(nome));
    if ((em("REDE") ?? "") !== "Municipal") return;

    const codigoMunicipio = String(em("CO_MUNICIPIO") ?? "").trim();
    const codigoEscola = String(em("CO_ESCOLA") ?? em("ID_ESCOLA") ?? "").trim();
    const nomeEscola = String(em("NO_ESCOLA") ?? "").trim();
    if (!/^\d{7}$/.test(codigoMunicipio) || !codigoEscola) return;

    // A primeira coluna VL_APROVACAO_2023* é o agregado da etapa.
    const chaveAprovacao = [...colunas.keys()].find((n) => n.startsWith(`VL_APROVACAO_${ANO}`));

    const lp = valorNumerico(em(`VL_NOTA_PORTUGUES_${ANO}`));
    const mt = valorNumerico(em(`VL_NOTA_MATEMATICA_${ANO}`));
    const media = valorNumerico(em(`VL_NOTA_MEDIA_${ANO}`));
    const ideb = valorNumerico(em(`VL_OBSERVADO_${ANO}`));
    const registro = {
      aprovacao: valorNumerico(em(chaveAprovacao ?? "")).valor,
      rendimento: valorNumerico(em(`VL_INDICADOR_REND_${ANO}`)).valor,
      lp: lp.valor,
      mt: mt.valor,
      media: media.valor,
      ideb: ideb.valor,
      meta2021: valorNumerico(em("VL_PROJECAO_2021")).valor,
      // O INEP grava o "ND" nas colunas de proficiência (LP/MT); média e
      // IDEB da mesma escola saem como "-". Checar só a média deixava o país
      // inteiro com zero ND — o que é impossível num Saeb real.
      nd: lp.nd || mt.nd || media.nd || ideb.nd,
    };

    let municipio = destino[codigoMunicipio];
    if (!municipio) {
      municipio = { uf: String(em("SG_UF") ?? ""), escolas: {} };
      destino[codigoMunicipio] = municipio;
    }
    let escola = municipio.escolas[codigoEscola];
    if (!escola) {
      escola = { nome: nomeEscola };
      municipio.escolas[codigoEscola] = escola;
    }
    escola[etapa] = registro;
    aproveitadas += 1;
  });

  if (!colunas) throw new Error(`cabeçalho SG_UF não encontrado em ${nomeXlsx}`);
  log(`${etapa}: ${aproveitadas.toLocaleString("pt-BR")} escolas municipais`);
  return aproveitadas;
}

async function main() {
  const [aiLocal, afLocal] = process.argv.slice(2);
  const municipios = {};

  await processarFonte(FONTES[0], aiLocal, municipios);
  await processarFonte(FONTES[1], afLocal, municipios);

  const totalMunicipios = Object.keys(municipios).length;
  if (totalMunicipios === 0) throw new Error("nenhum município aproveitado — o layout mudou.");

  const conteudo = {
    _comentario:
      "Gerado por scripts/dados/gerar-ideb-escolas.mjs. Não editar à mão. Regerar com: npm run dados:ideb-escolas",
    fonte: "INEP — divulgação do IDEB por escola (resultados finais, rede municipal)",
    ano: ANO,
    legendaNd:
      "nd=true: resultado retido pelo critério de divulgação do INEP — participação abaixo de 80% no Saeb.",
    geradoEm: new Date().toISOString(),
    municipios,
  };

  mkdirSync(dirname(DESTINO), { recursive: true });
  const json = JSON.stringify(conteudo);
  writeFileSync(DESTINO, json, "utf8");
  log(
    `escrito ${DESTINO} — ${(json.length / 1024 / 1024).toFixed(2)} MB, ` +
      `${totalMunicipios.toLocaleString("pt-BR")} municípios`,
  );
}

main().catch((erro) => {
  console.error(`[ideb-escolas] falhou: ${erro.message}`);
  process.exit(1);
});
