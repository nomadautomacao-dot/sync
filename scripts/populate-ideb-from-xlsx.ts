/**
 * Populate data/ideb-municipal-2023.json from INEP XLSX files.
 * Extracts IDEB observado, meta projetada, taxa de aprovação e indicador de rendimento
 * para os anos 2005-2023 para TODOS os 5.571 municípios.
 *
 * Usage: npx tsx scripts/populate-ideb-from-xlsx.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

// Saída: os JSONs derivados ficam em data/, versionados, porque o app os importa.
const DATA_DIR = path.join(process.cwd(), "data");
// Entrada: os XLSX de origem vivem fora do repositório. Ver DADOS_BRUTOS_DIR em
// docs/superpowers/specs/2026-07-22-reorganizacao-estrutura-design.md
const RAW_DIR = process.env.DADOS_BRUTOS_DIR?.trim()
  ? path.resolve(process.env.DADOS_BRUTOS_DIR.trim())
  : DATA_DIR;
const IDEB_YEARS = [2005, 2007, 2009, 2011, 2013, 2015, 2017, 2019, 2021, 2023] as const;

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function excelColumnToIndex(column: string) {
  let index = 0;
  for (const char of column) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index - 1;
}

function parseSharedStrings(xml: string) {
  return Array.from(xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)).map((item) =>
    Array.from(item[1].matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g))
      .map((m) => decodeXmlEntities(m[1]))
      .join(""),
  );
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
      row[index] = !rawValue ? "" : type === "s" ? sharedStrings[Number(rawValue)] ?? "" : rawValue;
    }
    return { rowNumber, values: row };
  });
}

async function parseWorkbookRows(filePath: string) {
  const buffer = await readFile(filePath);
  const zip = await JSZip.loadAsync(buffer);
  const ssXml = await zip.file("xl/sharedStrings.xml")?.async("string");
  const ss = ssXml ? parseSharedStrings(ssXml) : [];
  const sheetXml = await zip.file("xl/worksheets/sheet1.xml")?.async("string");
  if (!sheetXml) throw new Error(`Sheet1 not found in ${filePath}`);
  return parseWorksheetRows(sheetXml, ss);
}

function findColumnIndex(headerValues: string[], pattern: string): number {
  return headerValues.findIndex((h) => (h || "").toUpperCase() === pattern.toUpperCase());
}

function parseNum(value: string | undefined): number | null {
  if (!value || value.trim() === "" || value.trim() === "-" || value.trim().toUpperCase() === "ND") {
    return null;
  }
  const normalized = value.replace(",", ".").replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

interface IdebHistoryEntry {
  ano: number;
  idebObservado: number | null;
  metaProjetada: number | null;
}

interface IdebMunicipalFull {
  anosIniciaisPublica: number | null;
  anosFinaisPublica: number | null;
  ensinoMedioPublica: number | null;
  taxaAprovacaoIniciais: number | null;
  taxaAprovacaoFinais: number | null;
  historicoAnosIniciais: IdebHistoryEntry[];
  historicoAnosFinais: IdebHistoryEntry[];
}

async function main() {
  console.log("Parsing XLSX files...");

  const aiPath = path.join(RAW_DIR, "divulgacao_anos_iniciais_municipios_2023.xlsx");
  const afPath = path.join(RAW_DIR, "divulgacao_anos_finais_municipios_2023.xlsx");

  const aiRows = await parseWorkbookRows(aiPath);
  const afRows = await parseWorkbookRows(afPath);
  console.log(`  Anos Iniciais: ${aiRows.length} rows`);
  console.log(`  Anos Finais: ${afRows.length} rows`);

  // Find header row (row 10 in INEP files)
  const aiHeader = aiRows.find((r) => r.values.some((v) => v === "CO_MUNICIPIO"));
  const afHeader = afRows.find((r) => r.values.some((v) => v === "CO_MUNICIPIO"));
  if (!aiHeader || !afHeader) throw new Error("Header row not found");

  console.log(`AI header at row ${aiHeader.rowNumber}`);
  console.log(`AF header at row ${afHeader.rowNumber}`);

  // Build column maps
  function buildColMap(headerValues: string[]) {
    const map: Record<string, number> = {};
    map.codigo = findColumnIndex(headerValues, "CO_MUNICIPIO");
    map.rede = findColumnIndex(headerValues, "REDE");
    map.aprovacao2023 = findColumnIndex(headerValues, "VL_APROVACAO_2023_SI_4");
    map.indicadorRend2023 = findColumnIndex(headerValues, "VL_INDICADOR_REND_2023");
    map.notaMatematica2023 = findColumnIndex(headerValues, "VL_NOTA_MATEMATICA_2023");
    map.notaPortugues2023 = findColumnIndex(headerValues, "VL_NOTA_PORTUGUES_2023");
    map.notaMedia2023 = findColumnIndex(headerValues, "VL_NOTA_MEDIA_2023");

    for (const year of IDEB_YEARS) {
      map[`observado_${year}`] = findColumnIndex(headerValues, `VL_OBSERVADO_${year}`);
      map[`projecao_${year}`] = findColumnIndex(headerValues, `VL_PROJECAO_${year}`);
    }

    return map;
  }

  const aiCols = buildColMap(aiHeader.values);
  const afCols = buildColMap(afHeader.values);

  console.log(`AI: codigo=${aiCols.codigo}, rede=${aiCols.rede}, observado_2023=${aiCols.observado_2023}`);
  console.log(`AF: codigo=${afCols.codigo}, rede=${afCols.rede}, observado_2023=${afCols.observado_2023}`);

  const result: Record<string, IdebMunicipalFull> = {};

  function ensureEntry(codigo: string): IdebMunicipalFull {
    if (!result[codigo]) {
      result[codigo] = {
        anosIniciaisPublica: null,
        anosFinaisPublica: null,
        ensinoMedioPublica: null,
        taxaAprovacaoIniciais: null,
        taxaAprovacaoFinais: null,
        historicoAnosIniciais: [],
        historicoAnosFinais: [],
      };
    }
    return result[codigo];
  }

  // Process AI
  let aiProcessed = 0;
  for (const row of aiRows) {
    if (row.rowNumber <= aiHeader.rowNumber) continue;
    const codigo = (row.values[aiCols.codigo] ?? "").trim();
    if (!/^\d{7}$/.test(codigo)) continue;

    const rede = (row.values[aiCols.rede] ?? "").toUpperCase();
    const isMunicipal = rede.includes("MUNICIPAL");
    const isPublica = rede.includes("PUBLICA") || rede.includes("PÚBLIC");
    if (!isMunicipal && !isPublica) continue;

    const entry = ensureEntry(codigo);
    const ideb2023 = parseNum(row.values[aiCols.observado_2023]);
    const aprovacao = parseNum(row.values[aiCols.aprovacao2023]);

    if (isMunicipal || entry.anosIniciaisPublica === null) {
      entry.anosIniciaisPublica = ideb2023;
      entry.taxaAprovacaoIniciais = aprovacao;

      // Build history
      const history: IdebHistoryEntry[] = [];
      for (const year of IDEB_YEARS) {
        const obs = parseNum(row.values[aiCols[`observado_${year}`]]);
        const proj = parseNum(row.values[aiCols[`projecao_${year}`]]);
        history.push({ ano: year, idebObservado: obs, metaProjetada: proj });
      }
      entry.historicoAnosIniciais = history;
    }
    aiProcessed++;
  }

  // Process AF
  let afProcessed = 0;
  for (const row of afRows) {
    if (row.rowNumber <= afHeader.rowNumber) continue;
    const codigo = (row.values[afCols.codigo] ?? "").trim();
    if (!/^\d{7}$/.test(codigo)) continue;

    const rede = (row.values[afCols.rede] ?? "").toUpperCase();
    const isMunicipal = rede.includes("MUNICIPAL");
    const isPublica = rede.includes("PUBLICA") || rede.includes("PÚBLIC");
    if (!isMunicipal && !isPublica) continue;

    const entry = ensureEntry(codigo);
    const ideb2023 = parseNum(row.values[afCols.observado_2023]);
    const aprovacao = parseNum(row.values[afCols.aprovacao2023]);

    if (isMunicipal || entry.anosFinaisPublica === null) {
      entry.anosFinaisPublica = ideb2023;
      entry.taxaAprovacaoFinais = aprovacao;

      const history: IdebHistoryEntry[] = [];
      for (const year of IDEB_YEARS) {
        const obs = parseNum(row.values[afCols[`observado_${year}`]]);
        const proj = parseNum(row.values[afCols[`projecao_${year}`]]);
        history.push({ ano: year, idebObservado: obs, metaProjetada: proj });
      }
      entry.historicoAnosFinais = history;
    }
    afProcessed++;
  }

  console.log(`\nProcessed: ${aiProcessed} AI rows, ${afProcessed} AF rows`);
  console.log(`Total municipalities with data: ${Object.keys(result).length}`);

  // Check Salvador
  const salvador = result["2927408"];
  if (salvador) {
    console.log(`\nSalvador (2927408):`);
    console.log(`  IDEB AI 2023: ${salvador.anosIniciaisPublica}`);
    console.log(`  IDEB AF 2023: ${salvador.anosFinaisPublica}`);
    console.log(`  Histórico AI:`, salvador.historicoAnosIniciais.map((h) => `${h.ano}:${h.idebObservado ?? "-"}`).join(", "));
    console.log(`  Histórico AF:`, salvador.historicoAnosFinais.map((h) => `${h.ano}:${h.idebObservado ?? "-"}`).join(", "));
  }

  // Write output
  const outputPath = path.join(DATA_DIR, "ideb-municipal-2023.json");
  await writeFile(outputPath, JSON.stringify(result, null, 2));
  console.log(`\nWritten to ${outputPath} (${(JSON.stringify(result).length / 1024 / 1024).toFixed(1)} MB)`);

  // Stats
  let withAI = 0, withAF = 0, withHistory = 0;
  for (const entry of Object.values(result)) {
    if (entry.anosIniciaisPublica !== null) withAI++;
    if (entry.anosFinaisPublica !== null) withAF++;
    if (entry.historicoAnosIniciais.some((h) => h.idebObservado !== null)) withHistory++;
  }
  console.log(`With IDEB AI: ${withAI}`);
  console.log(`With IDEB AF: ${withAF}`);
  console.log(`With historical series: ${withHistory}`);
}

main().catch(console.error);
