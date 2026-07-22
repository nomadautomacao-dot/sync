import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

const CACHE_TTL_MS = 1000 * 60 * 60 * 12;
const APRENDIZAGEM_ANOS_INICIAIS_FILE = path.join(
  process.cwd(),
  "data",
  "divulgacao_anos_iniciais_municipios_2023.xlsx",
);
const APRENDIZAGEM_ANOS_FINAIS_FILE = path.join(
  process.cwd(),
  "data",
  "divulgacao_anos_finais_municipios_2023.xlsx",
);
const DISTORCAO_MUNICIPIOS_URL =
  "https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/2023/TDI_2023_MUNICIPIOS.zip";

interface CacheEntry<T> {
  loadedAt: number;
  data: T;
}

interface AprendizagemSnapshot {
  codigoIBGE: string;
  municipio: string;
  uf: string;
  rede: string;
  taxaAprovacao: number | null;
  indicadorRendimento: number | null;
  notaMatematica: number | null;
  notaPortugues: number | null;
  notaMedia: number | null;
  idebObservado: number | null;
}

interface AprendizagemMunicipioMap {
  municipal?: AprendizagemSnapshot;
  publica?: AprendizagemSnapshot;
  total?: AprendizagemSnapshot;
}

interface DistorcaoSnapshot {
  codigoIBGE: string;
  municipio: string;
  uf: string;
  categoria: string;
  rede: string;
  fundamentalTotal: number | null;
  anosIniciais: number | null;
  anosFinais: number | null;
}

interface DistorcaoMunicipioMap {
  municipal?: DistorcaoSnapshot;
  publica?: DistorcaoSnapshot;
  total?: DistorcaoSnapshot;
}

interface QeduDataset {
  anosIniciais: Map<string, AprendizagemMunicipioMap>;
  anosFinais: Map<string, AprendizagemMunicipioMap>;
  distorcao: Map<string, DistorcaoMunicipioMap>;
}

interface QeduMunicipalIndicators {
  codigoIBGE: string;
  municipio: string;
  uf: string;
  anoReferencia: number;
  recorteRede: string;
  fonte: string;
  fonteDistorcao: string;
  anosIniciais: {
    taxaAprovacao: number | null;
    indicadorRendimento: number | null;
    notaMatematica: number | null;
    notaPortugues: number | null;
    notaMedia: number | null;
    idebObservado: number | null;
  } | null;
  anosFinais: {
    taxaAprovacao: number | null;
    indicadorRendimento: number | null;
    notaMatematica: number | null;
    notaPortugues: number | null;
    notaMedia: number | null;
    idebObservado: number | null;
  } | null;
  distorcaoIdadeSerie: {
    fundamentalTotal: number | null;
    anosIniciais: number | null;
    anosFinais: number | null;
  } | null;
}

let datasetCache: CacheEntry<QeduDataset> | null = null;

function withinCache<T>(cache: CacheEntry<T> | null) {
  return cache && Date.now() - cache.loadedAt < CACHE_TTL_MS;
}

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
  const items = Array.from(xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g));
  return items.map((item) => {
    const texts = Array.from(item[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)).map((match) =>
      decodeXmlEntities(match[1]),
    );
    return texts.join("");
  });
}

function parseWorksheetRows(xml: string, sharedStrings: string[]) {
  const rows = Array.from(xml.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g));
  return rows.map((rowMatch) => {
    const rowNumber = Number(rowMatch[1]);
    const row: string[] = [];
    const cells = Array.from(rowMatch[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g));

    for (const cell of cells) {
      const attrs = cell[1];
      const body = cell[2];
      const ref = attrs.match(/\br="([A-Z]+)\d+"/)?.[1];
      if (!ref) {
        continue;
      }

      const index = excelColumnToIndex(ref);
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const rawValue = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";

      if (!rawValue) {
        row[index] = "";
        continue;
      }

      row[index] = type === "s" ? sharedStrings[Number(rawValue)] ?? "" : decodeXmlEntities(rawValue);
    }

    return { rowNumber, values: row };
  });
}

async function parseWorkbookRowsFromBuffer(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const sharedStringsXml = await zip.file("xl/sharedStrings.xml")?.async("string");
  const worksheetXml = await zip.file("xl/worksheets/sheet1.xml")?.async("string");

  if (!sharedStringsXml || !worksheetXml) {
    throw new Error("Estrutura inesperada na planilha oficial do INEP.");
  }

  const sharedStrings = parseSharedStrings(sharedStringsXml);
  return parseWorksheetRows(worksheetXml, sharedStrings);
}

function parseNullableNumber(value: string | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed === "-" || trimmed === "--") {
    return null;
  }

  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    const direct = Number(trimmed);
    return Number.isFinite(direct) ? direct : null;
  }

  const normalized = trimmed.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeRede(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  if (normalized === "MUNICIPAL") {
    return "municipal" as const;
  }
  if (normalized === "PUBLICA" || normalized === "PUBICA" || normalized === "PUBLIC") {
    return "publica" as const;
  }
  return "total" as const;
}

function pickPreferredAprendizagem(record?: AprendizagemMunicipioMap | null) {
  return record?.municipal ?? record?.publica ?? record?.total ?? null;
}

function pickPreferredDistorcao(record?: DistorcaoMunicipioMap | null) {
  return record?.municipal ?? record?.publica ?? record?.total ?? null;
}

async function loadAprendizagemFile(filePath: string): Promise<Map<string, AprendizagemMunicipioMap>> {
  const rows = await parseWorkbookRowsFromBuffer(await readFile(filePath));
  const header = rows.find((item) => item.rowNumber === 10)?.values;

  if (!header) {
    throw new Error(`Cabecalho nao encontrado na planilha ${path.basename(filePath)}.`);
  }

  const municipioIndex = header.indexOf("CO_MUNICIPIO");
  const nomeIndex = header.indexOf("NO_MUNICIPIO");
  const ufIndex = header.indexOf("SG_UF");
  const redeIndex = header.indexOf("REDE");
  const taxaAprovacaoIndex =
    header.indexOf("VL_APROVACAO_2023_SI") >= 0
      ? header.indexOf("VL_APROVACAO_2023_SI")
      : header.indexOf("VL_APROVACAO_2023_SI_4");
  const indicadorRendimentoIndex = header.indexOf("VL_INDICADOR_REND_2023");
  const notaMatematicaIndex = header.indexOf("VL_NOTA_MATEMATICA_2023");
  const notaPortuguesIndex = header.indexOf("VL_NOTA_PORTUGUES_2023");
  const notaMediaIndex = header.indexOf("VL_NOTA_MEDIA_2023");
  const idebObservadoIndex = header.indexOf("VL_OBSERVADO_2023");

  const dataset = new Map<string, AprendizagemMunicipioMap>();

  for (const row of rows) {
    if (row.rowNumber <= 10) {
      continue;
    }

    const codigoIBGE = row.values[municipioIndex]?.trim();
    if (!codigoIBGE || !/^\d{7}$/.test(codigoIBGE)) {
      continue;
    }

    const snapshot: AprendizagemSnapshot = {
      codigoIBGE,
      municipio: row.values[nomeIndex]?.trim() ?? "",
      uf: row.values[ufIndex]?.trim() ?? "",
      rede: row.values[redeIndex]?.trim() ?? "Total",
      taxaAprovacao: parseNullableNumber(row.values[taxaAprovacaoIndex]),
      indicadorRendimento: parseNullableNumber(row.values[indicadorRendimentoIndex]),
      notaMatematica: parseNullableNumber(row.values[notaMatematicaIndex]),
      notaPortugues: parseNullableNumber(row.values[notaPortuguesIndex]),
      notaMedia: parseNullableNumber(row.values[notaMediaIndex]),
      idebObservado: parseNullableNumber(row.values[idebObservadoIndex]),
    };

    const key = normalizeRede(snapshot.rede);
    const current = dataset.get(codigoIBGE) ?? {};
    current[key] = snapshot;
    dataset.set(codigoIBGE, current);
  }

  return dataset;
}

async function loadDistorcaoMunicipalDataset(): Promise<Map<string, DistorcaoMunicipioMap>> {
  const response = await fetch(DISTORCAO_MUNICIPIOS_URL, {
    headers: { "User-Agent": "Sync/1.0" },
    next: { revalidate: 60 * 60 * 12 },
  });

  if (!response.ok) {
    throw new Error(`Falha ao consultar taxa de distorcao idade-serie: ${response.status}`);
  }

  const outerZip = await JSZip.loadAsync(await response.arrayBuffer());
  const workbookEntry = Object.keys(outerZip.files).find((item) => item.endsWith(".xlsx"));

  if (!workbookEntry) {
    throw new Error("Arquivo XLSX de distorcao idade-serie nao encontrado no pacote oficial.");
  }

  const workbookBuffer = await outerZip.file(workbookEntry)?.async("nodebuffer");
  if (!workbookBuffer) {
    throw new Error("Nao foi possivel carregar a planilha de distorcao idade-serie.");
  }

  const rows = await parseWorkbookRowsFromBuffer(workbookBuffer);
  const header = rows.find((item) => item.rowNumber === 9)?.values;

  if (!header) {
    throw new Error("Cabecalho nao encontrado na planilha de distorcao idade-serie.");
  }

  const anoIndex = header.indexOf("NU_ANO_CENSO");
  const municipioIndex = header.indexOf("CO_MUNICIPIO");
  const nomeIndex = header.indexOf("NO_MUNICIPIO");
  const ufIndex = header.indexOf("SG_UF");
  const categoriaIndex = header.indexOf("NO_CATEGORIA");
  const redeIndex = header.indexOf("NO_DEPENDENCIA");
  const fundamentalIndex = header.indexOf("FUN_CAT_0");
  const anosIniciaisIndex = header.indexOf("FUN_AI_CAT_0");
  const anosFinaisIndex = header.indexOf("FUN_AF_CAT_0");

  const dataset = new Map<string, DistorcaoMunicipioMap>();

  for (const row of rows) {
    if (row.rowNumber <= 9) {
      continue;
    }

    if (row.values[anoIndex] !== "2023") {
      continue;
    }

    if ((row.values[categoriaIndex] ?? "").trim().toUpperCase() !== "TOTAL") {
      continue;
    }

    const codigoIBGE = row.values[municipioIndex]?.trim();
    if (!codigoIBGE || !/^\d{7}$/.test(codigoIBGE)) {
      continue;
    }

    const snapshot: DistorcaoSnapshot = {
      codigoIBGE,
      municipio: row.values[nomeIndex]?.trim() ?? "",
      uf: row.values[ufIndex]?.trim() ?? "",
      categoria: row.values[categoriaIndex]?.trim() ?? "",
      rede: row.values[redeIndex]?.trim() ?? "Total",
      fundamentalTotal: parseNullableNumber(row.values[fundamentalIndex]),
      anosIniciais: parseNullableNumber(row.values[anosIniciaisIndex]),
      anosFinais: parseNullableNumber(row.values[anosFinaisIndex]),
    };

    const key = normalizeRede(snapshot.rede);
    const current = dataset.get(codigoIBGE) ?? {};
    current[key] = snapshot;
    dataset.set(codigoIBGE, current);
  }

  return dataset;
}

async function loadDataset(): Promise<QeduDataset> {
  if (withinCache(datasetCache) && datasetCache) {
    return datasetCache.data;
  }

  const [anosIniciais, anosFinais, distorcao] = await Promise.all([
    loadAprendizagemFile(APRENDIZAGEM_ANOS_INICIAIS_FILE),
    loadAprendizagemFile(APRENDIZAGEM_ANOS_FINAIS_FILE),
    loadDistorcaoMunicipalDataset(),
  ]);

  const dataset = { anosIniciais, anosFinais, distorcao };
  datasetCache = {
    loadedAt: Date.now(),
    data: dataset,
  };

  return dataset;
}

export async function getQeduMunicipalIndicators(codigoIBGE: string): Promise<QeduMunicipalIndicators | null> {
  const digits = codigoIBGE.replace(/\D/g, "");
  if (digits.length !== 7) {
    return null;
  }

  const dataset = await loadDataset();
  const anosIniciais = pickPreferredAprendizagem(dataset.anosIniciais.get(digits));
  const anosFinais = pickPreferredAprendizagem(dataset.anosFinais.get(digits));
  const distorcao = pickPreferredDistorcao(dataset.distorcao.get(digits));

  if (!anosIniciais && !anosFinais && !distorcao) {
    return null;
  }

  const recorteRede = anosIniciais?.rede ?? anosFinais?.rede ?? distorcao?.rede ?? "Total";
  const municipio = anosIniciais?.municipio ?? anosFinais?.municipio ?? distorcao?.municipio ?? "";
  const uf = anosIniciais?.uf ?? anosFinais?.uf ?? distorcao?.uf ?? "";

  return {
    codigoIBGE: digits,
    municipio,
    uf,
    anoReferencia: 2023,
    recorteRede,
    fonte: "INEP divulgacao municipal 2023 (aprendizagem, aprovacao e IDEB)",
    fonteDistorcao: "INEP taxa de distorcao idade-serie 2023",
    anosIniciais: anosIniciais
      ? {
          taxaAprovacao: anosIniciais.taxaAprovacao,
          indicadorRendimento: anosIniciais.indicadorRendimento,
          notaMatematica: anosIniciais.notaMatematica,
          notaPortugues: anosIniciais.notaPortugues,
          notaMedia: anosIniciais.notaMedia,
          idebObservado: anosIniciais.idebObservado,
        }
      : null,
    anosFinais: anosFinais
      ? {
          taxaAprovacao: anosFinais.taxaAprovacao,
          indicadorRendimento: anosFinais.indicadorRendimento,
          notaMatematica: anosFinais.notaMatematica,
          notaPortugues: anosFinais.notaPortugues,
          notaMedia: anosFinais.notaMedia,
          idebObservado: anosFinais.idebObservado,
        }
      : null,
    distorcaoIdadeSerie: distorcao
      ? {
          fundamentalTotal: distorcao.fundamentalTotal,
          anosIniciais: distorcao.anosIniciais,
          anosFinais: distorcao.anosFinais,
        }
      : null,
  };
}
