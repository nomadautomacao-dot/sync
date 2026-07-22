/**
 * Regenerate ideb-municipal-2023.json from the SAEB XLSX files.
 * Run: npx tsx scripts/regenerate-ideb.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

// Entrada: XLSX de origem, fora do repositório. Saída: JSON derivado, versionado.
const RAW_DIR = process.env.DADOS_BRUTOS_DIR?.trim()
  ? path.resolve(process.env.DADOS_BRUTOS_DIR.trim())
  : path.join(process.cwd(), "data");

const ANOS_INICIAIS_FILE = path.join(RAW_DIR, "divulgacao_anos_iniciais_municipios_2023.xlsx");
const ANOS_FINAIS_FILE = path.join(RAW_DIR, "divulgacao_anos_finais_municipios_2023.xlsx");
const OUTPUT_FILE = path.join(process.cwd(), "data", "ideb-municipal-2023.json");

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function excelColumnToIndex(column: string) {
  let index = 0;
  for (const char of column) { index = index * 26 + (char.charCodeAt(0) - 64); }
  return index - 1;
}

function parseSharedStrings(xml: string) {
  return Array.from(xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)).map((item) => {
    const texts = Array.from(item[1].matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)).map((m) => decodeXmlEntities(m[1]));
    return texts.join("");
  });
}

function parseWorksheetRows(xml: string, sharedStrings: string[]) {
  return Array.from(xml.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)).map((rowMatch) => {
    const rowNumber = Number(rowMatch[1]);
    const row: string[] = [];
    for (const cell of Array.from(rowMatch[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g))) {
      const ref = cell[1].match(/\br="([A-Z]+)\d+"/)?.[1];
      if (!ref) continue;
      const index = excelColumnToIndex(ref);
      const type = cell[1].match(/\bt="([^"]+)"/)?.[1];
      const rawValue = cell[2].match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
      row[index] = !rawValue ? "" : type === "s" ? sharedStrings[Number(rawValue)] ?? "" : decodeXmlEntities(rawValue);
    }
    return { rowNumber, values: row };
  });
}

async function parseWorkbook(filePath: string) {
  const zip = await JSZip.loadAsync(await readFile(filePath));
  const ssXml = await zip.file("xl/sharedStrings.xml")?.async("string");
  const wsXml = await zip.file("xl/worksheets/sheet1.xml")?.async("string");
  if (!ssXml || !wsXml) throw new Error(`Invalid XLSX: ${filePath}`);
  return parseWorksheetRows(wsXml, parseSharedStrings(ssXml));
}

function parseNum(v: string | undefined): number | null {
  if (!v) return null;
  const t = v.trim();
  if (!t || t === "-" || t === "--") return null;
  if (/^-?\d+(?:\.\d+)?$/.test(t)) { const n = Number(t); return Number.isFinite(n) ? n : null; }
  const n2 = Number(t.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n2) ? n2 : null;
}

interface IdebRecord {
  anosIniciaisPublica: number | null;
  anosFinaisPublica: number | null;
  ensinoMedioPublica: number | null;
  taxaAprovacaoIniciais: number | null;
  taxaAprovacaoFinais: number | null;
}

async function main() {
  console.log("Loading Anos Iniciais...");
  const aiRows = await parseWorkbook(ANOS_INICIAIS_FILE);
  console.log("Loading Anos Finais...");
  const afRows = await parseWorkbook(ANOS_FINAIS_FILE);

  const result: Record<string, IdebRecord> = {};

  // Process Anos Iniciais
  const aiHeader = aiRows.find((r) => r.rowNumber === 10)?.values;
  if (!aiHeader) throw new Error("Header not found in Anos Iniciais");

  const aiMunIdx = aiHeader.indexOf("CO_MUNICIPIO");
  const aiRedeIdx = aiHeader.indexOf("REDE");
  const aiIdebIdx = aiHeader.indexOf("VL_OBSERVADO_2023");
  const aiAprovIdx = aiHeader.indexOf("VL_APROVACAO_2023_SI") >= 0
    ? aiHeader.indexOf("VL_APROVACAO_2023_SI")
    : aiHeader.indexOf("VL_APROVACAO_2023_SI_4");

  for (const row of aiRows) {
    if (row.rowNumber <= 10) continue;
    const code = row.values[aiMunIdx]?.trim();
    if (!code || !/^\d{7}$/.test(code)) continue;
    const rede = (row.values[aiRedeIdx] ?? "").trim().toUpperCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (rede !== "MUNICIPAL" && rede !== "PUBLICA") continue;

    const ideb = parseNum(row.values[aiIdebIdx]);
    const aprov = parseNum(row.values[aiAprovIdx]);

    if (!result[code]) {
      result[code] = { anosIniciaisPublica: null, anosFinaisPublica: null, ensinoMedioPublica: null, taxaAprovacaoIniciais: null, taxaAprovacaoFinais: null };
    }
    // Prefer Municipal over Publica
    if (rede === "MUNICIPAL" || result[code].anosIniciaisPublica == null) {
      if (ideb != null) result[code].anosIniciaisPublica = ideb;
      if (aprov != null) result[code].taxaAprovacaoIniciais = aprov;
    }
  }

  // Process Anos Finais
  const afHeader = afRows.find((r) => r.rowNumber === 10)?.values;
  if (!afHeader) throw new Error("Header not found in Anos Finais");

  const afMunIdx = afHeader.indexOf("CO_MUNICIPIO");
  const afRedeIdx = afHeader.indexOf("REDE");
  const afIdebIdx = afHeader.indexOf("VL_OBSERVADO_2023");
  const afAprovIdx = afHeader.indexOf("VL_APROVACAO_2023_SI") >= 0
    ? afHeader.indexOf("VL_APROVACAO_2023_SI")
    : afHeader.indexOf("VL_APROVACAO_2023_SI_4");

  for (const row of afRows) {
    if (row.rowNumber <= 10) continue;
    const code = row.values[afMunIdx]?.trim();
    if (!code || !/^\d{7}$/.test(code)) continue;
    const rede = (row.values[afRedeIdx] ?? "").trim().toUpperCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (rede !== "MUNICIPAL" && rede !== "PUBLICA") continue;

    const ideb = parseNum(row.values[afIdebIdx]);
    const aprov = parseNum(row.values[afAprovIdx]);

    if (!result[code]) {
      result[code] = { anosIniciaisPublica: null, anosFinaisPublica: null, ensinoMedioPublica: null, taxaAprovacaoIniciais: null, taxaAprovacaoFinais: null };
    }
    if (rede === "MUNICIPAL" || result[code].anosFinaisPublica == null) {
      if (ideb != null) result[code].anosFinaisPublica = ideb;
      if (aprov != null) result[code].taxaAprovacaoFinais = aprov;
    }
  }

  const total = Object.keys(result).length;
  const withIdeb = Object.values(result).filter((r) => r.anosIniciaisPublica != null || r.anosFinaisPublica != null).length;
  console.log(`Total: ${total} municípios, ${withIdeb} com IDEB`);

  await writeFile(OUTPUT_FILE, JSON.stringify(result, null, 0));
  console.log(`Saved to ${OUTPUT_FILE}`);
}

main().catch(console.error);
