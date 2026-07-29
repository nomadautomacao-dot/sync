#!/usr/bin/env node
/**
 * Gera `data/inep/alfabetizacao-municipios.json` — Indicador Criança
 * Alfabetizada (ICA) por município: série 2023–2025, metas anuais até 2030,
 * nível na escala do Compromisso e percentual de participação na avaliação.
 *
 * ## Por que este dataset existe (roadmap #24)
 *
 * O ICA é o indicador do **Compromisso Nacional Criança Alfabetizada**: mede
 * o percentual de alunos do 2º ano acima de 743 pontos na escala Saeb. Três
 * coisas o tornam central no dossiê:
 *
 * 1. **Meta por município, ano a ano até 2030** — é o único indicador federal
 *    de aprendizagem com trajetória pactuada individualmente. Dá para dizer
 *    se o município cumpriu a meta do ano e quanto falta para a próxima.
 * 2. **Alfabetizar no 2º ano é o que evita distorção e abandono adiante** —
 *    e distorção/abandono são a Condicionalidade I do VAAR (fluxo).
 * 3. **A participação é publicada** — resultado com participação baixa é
 *    frágil, do mesmo jeito que no Saeb (onde vira a Cond. II do VAAR).
 *
 * ## Fonte
 *
 * INEP — Avaliação da Alfabetização, planilhas "resultados e metas":
 * `resultados_e_metas_municipios_<ano>_v<n>.xlsx` e a de UFs, que entra como
 * régua estadual. Só a edição mais recente traz a série completa, porque a
 * própria planilha de 2025 já contém 2023 e 2024.
 *
 * ## Uso
 *
 *     npm run dados:alfabetizacao
 *     node scripts/dados/gerar-alfabetizacao-municipios.mjs <municipios.xlsx> <ufs.xlsx>
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { inflateRawSync } from "node:zlib";

const BASE = "https://download.inep.gov.br/avaliacao_da_alfabetizacao/resultados";
const ARQUIVO_MUNICIPIOS = "resultados_e_metas_municipios_2025_v2.xlsx";
const ARQUIVO_UFS = "resultados_e_metas_ufs_2025_v1.xlsx";
const DESTINO = join(process.cwd(), "data", "inep", "alfabetizacao-municipios.json");

/** Escala oficial do Compromisso, publicada na aba "Variáveis" da planilha. */
const NIVEIS = {
  0: "Abaixo do nível 1 (até 40%)",
  1: "Nível 1 (40% a 50%)",
  2: "Nível 2 (50% a 60%)",
  3: "Nível 3 (60% a 70%)",
  4: "Nível 4 (70% a 80%)",
  5: "Nível 5 (acima de 80%)",
};

function log(mensagem) {
  console.log(`[alfabetizacao] ${mensagem}`);
}

function entradasZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66_000); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("EOCD não encontrado — o arquivo não é um XLSX válido");
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
    entradas.set(buf.toString("utf8", p + 46, p + 46 + nomeLen), { metodo, comprimido, offsetLocal });
    p += 46 + nomeLen + extraLen + comentLen;
  }
  return entradas;
}

function lerEntrada(buf, entrada) {
  const nomeLen = buf.readUInt16LE(entrada.offsetLocal + 26);
  const extraLen = buf.readUInt16LE(entrada.offsetLocal + 28);
  const inicio = entrada.offsetLocal + 30 + nomeLen + extraLen;
  const bruto = buf.subarray(inicio, inicio + entrada.comprimido);
  // Método 0 = stored, 8 = deflate.
  return (entrada.metodo === 0 ? bruto : inflateRawSync(bruto)).toString("utf8");
}

function textoXml(valor) {
  return valor
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'");
}

/**
 * Lê uma planilha do XLSX como matriz de linhas indexadas por coluna (A, B…).
 * `sharedStrings` é resolvido por `<si>` inteiro: entrada com rich text tem
 * vários `<t>` e contá-los separadamente desloca todos os índices seguintes.
 */
function lerPlanilha(zip, entradas, nomeAba) {
  const ss = entradas.get("xl/sharedStrings.xml");
  const strings = ss
    ? [...lerEntrada(zip, ss).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
        textoXml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join("")),
      )
    : [];

  const workbook = lerEntrada(zip, entradas.get("xl/workbook.xml"));
  const abas = [...workbook.matchAll(/<sheet[^>]*name="([^"]*)"[^>]*r:id="(rId\d+)"/g)];
  const alvo = abas.find(([, nome]) => nome === nomeAba) ?? abas[0];
  const rels = lerEntrada(zip, entradas.get("xl/_rels/workbook.xml.rels"));
  const destino = new RegExp(`Id="${alvo[2]}"[^>]*Target="([^"]*)"`).exec(rels)?.[1];
  const caminho = destino
    ? `xl/${destino.replace(/^\/?xl\//, "").replace(/^\//, "")}`
    : "xl/worksheets/sheet1.xml";
  const xml = lerEntrada(zip, entradas.get(caminho));

  const linhas = [];
  for (const r of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const celulas = {};
    for (const c of r[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g)) {
      const attrs = c[1] ?? c[3] ?? "";
      const inner = c[2] ?? "";
      const coluna = /r="([A-Z]+)\d+"/.exec(attrs)?.[1];
      if (!coluna) continue;
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      if (/t="s"/.test(attrs)) {
        celulas[coluna] = strings[Number(v)] ?? "";
      } else if (/t="inlineStr"/.test(attrs)) {
        celulas[coluna] = textoXml(/<t[^>]*>([\s\S]*?)<\/t>/.exec(inner)?.[1] ?? "");
      } else {
        celulas[coluna] = v ?? "";
      }
    }
    linhas.push(celulas);
  }
  return linhas;
}

function numero(texto) {
  if (texto === undefined || texto === "") return null;
  const n = Number(String(texto).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Percentuais do INEP vêm com ruído de ponto flutuante (70.069999999999993). */
function arredondar(valor, casas = 2) {
  if (valor === null) return null;
  const f = 10 ** casas;
  return Math.round(valor * f) / f;
}

/**
 * As duas planilhas têm layouts diferentes: a de UFs não traz a coluna de nome
 * do município, então tudo anda uma casa à esquerda. Mapear por coluna fixa
 * sem separar os dois casos mistura meta de um ano com a do seguinte — foi
 * exatamente o que aconteceu na primeira geração (AM apareceu com meta 2030
 * de 86%, valor que só existe porque a coluna lida era outra).
 */
const LAYOUT_MUNICIPIOS = {
  resultados: [["2023", "G"], ["2024", "H"], ["2025", "I"]],
  metas: [["2024", "J"], ["2025", "K"], ["2026", "L"], ["2027", "M"], ["2028", "N"], ["2029", "O"], ["2030", "P"]],
  participacao: "R",
};
const LAYOUT_UFS = {
  resultados: [["2023", "F"], ["2024", "G"], ["2025", "H"]],
  metas: [["2024", "I"], ["2025", "J"], ["2026", "K"], ["2027", "L"], ["2028", "M"], ["2029", "N"], ["2030", "O"]],
  participacao: "P",
};

function extrairRegistro(linha, layout) {
  const resultados = {};
  for (const [ano, coluna] of layout.resultados) {
    const v = arredondar(numero(linha[coluna]), 1);
    if (v !== null) resultados[ano] = v;
  }
  const metas = {};
  for (const [ano, coluna] of layout.metas) {
    // A meta de 2030 é publicada como "> 80" (texto) nas UFs: é um patamar,
    // não um número, e entra como ausente em vez de virar zero.
    const v = arredondar(numero(linha[coluna]), 1);
    if (v !== null) metas[ano] = v;
  }
  return {
    resultados,
    metas,
    participacao: arredondar(numero(linha[layout.participacao]), 1),
  };
}

async function carregar(nomeArquivo, caminhoLocal) {
  if (caminhoLocal) return readFileSync(caminhoLocal);
  const url = `${BASE}/${nomeArquivo}`;
  log(`baixando ${url}…`);
  const resposta = await fetch(url, {
    signal: AbortSignal.timeout(300_000),
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status} em ${url}`);
  return Buffer.from(await resposta.arrayBuffer());
}

async function main() {
  const [localMunicipios, localUfs] = process.argv.slice(2);

  const zipMunicipios = await carregar(ARQUIVO_MUNICIPIOS, localMunicipios);
  const entradasMunicipios = entradasZip(zipMunicipios);
  const linhasMunicipios = lerPlanilha(zipMunicipios, entradasMunicipios, "Divulgação Alfabet Municipio");

  const municipios = {};
  let anoAvaliacao = null;
  const niveisVistos = new Set();
  for (const linha of linhasMunicipios) {
    const codigo = String(linha.D ?? "").trim();
    if (!/^\d{7}$/.test(codigo)) continue;
    anoAvaliacao ??= numero(linha.A);
    const { resultados, metas, participacao } = extrairRegistro(linha, LAYOUT_MUNICIPIOS);
    const nivel = numero(linha.Q);
    if (nivel !== null) niveisVistos.add(nivel);
    municipios[codigo] = {
      uf: String(linha.C ?? "").trim(),
      resultados,
      metas,
      nivel,
      participacao,
    };
  }

  const zipUfs = await carregar(ARQUIVO_UFS, localUfs);
  const entradasUfs = entradasZip(zipUfs);
  const linhasUfs = lerPlanilha(zipUfs, entradasUfs, "Divulgação Alfabet UF e Brasil");
  const ufs = {};
  for (const linha of linhasUfs) {
    const sigla = String(linha.C ?? "").trim();
    // Só entra linha com sigla de UF de verdade: a planilha tem uma linha de
    // Brasil com as células deslocadas, que cairia como UF fantasma.
    if (!/^[A-Z]{2}$/.test(sigla)) continue;
    const { resultados, metas, participacao } = extrairRegistro(linha, LAYOUT_UFS);
    if (!Object.keys(resultados).length) continue;
    ufs[sigla] = { resultados, metas, participacao };
  }

  mkdirSync(dirname(DESTINO), { recursive: true });
  writeFileSync(
    DESTINO,
    JSON.stringify({
      geradoEm: new Date().toISOString().slice(0, 10),
      fonte:
        "INEP — Indicador Criança Alfabetizada (Compromisso Nacional Criança Alfabetizada), resultados e metas por município. Percentual de alunos do 2º ano acima de 743 pontos na escala Saeb; rede municipal.",
      fonteUfs:
        "INEP — mesma divulgação, planilha de UFs. A série estadual é da rede PÚBLICA (sistemas estaduais de avaliação), universo mais amplo que a rede municipal: serve como régua, não como comparação exata.",
      anoAvaliacao,
      niveis: NIVEIS,
      municipios,
      ufs,
    }),
  );
  log(
    `${Object.keys(municipios).length.toLocaleString("pt-BR")} municípios · ${Object.keys(ufs).length} UFs · níveis vistos: ${[...niveisVistos].sort().join(", ")} · gravado em ${DESTINO}`,
  );
}

main().catch((erro) => {
  console.error(`[alfabetizacao] Falha: ${erro.message}`);
  process.exit(1);
});
