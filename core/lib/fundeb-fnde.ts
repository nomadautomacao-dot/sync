import { normalizarIBGE } from "@/modules/levantamento-fundeb/utils/calculos";
import type { ReceitasFundeb } from "@/modules/levantamento-fundeb/types";
import { readFileSync } from "fs";
import { join } from "path";

export interface FndeFundebReceitas extends ReceitasFundeb {
  codigoIBGE: string;
  municipio: string;
  uf: string;
  fonte: string;
}

export interface FndeVaatContext {
  codigoIBGE: string;
  uf: string;
  ente: string;
  vaatAnterior: number;
  vaatComComplementacao: number;
  complementacaoVAAT: number;
  ieiPercentual: number | null;
  habilitacao: string;
  pendencia: string | null;
}

type FndeReceitasSource =
  | {
      kind: "csv";
      url: string;
      sourceLabel: string;
    }
  | {
      kind: "pdf";
      url: string;
      sourceLabel: string;
    }
  | {
      kind: "pdf-vaaf";
      url: string;
      sourceLabel: string;
    };

const FNDE_RECEITAS_SOURCES: Record<number, FndeReceitasSource> = {
  2022: {
    kind: "csv",
    url: "https://www.gov.br/fnde/pt-br/acesso-a-informacao/acoes-e-programas/financiamento/fundeb/novo-fundeb/2022/copy2_of_ReceitaeComplementaoporentefederadoFundeb2022.pdf",
    sourceLabel: "Portaria FNDE / MEC - VAAF FUNDEB 2022 (3a publicacao)",
  },
  2023: {
    kind: "csv",
    url: "https://www.gov.br/fnde/pt-br/acesso-a-informacao/acoes-e-programas/financiamento/fundeb/vaaf/copy2_of_ReceitaeComplementaoporentefederadoFundeb2023.pdf",
    sourceLabel: "Portaria FNDE / MEC - VAAF FUNDEB 2023 (4a publicacao)",
  },
  2024: {
    kind: "csv",
    url: "https://www.gov.br/fnde/pt-br/acesso-a-informacao/acoes-e-programas/financiamento/fundeb/2024/ReceitaTotalporEnteFederado.pdf",
    sourceLabel: "Portaria FNDE / MEC - FUNDEB 2024",
  },
  2025: {
    kind: "csv",
    url: "https://www.gov.br/fnde/pt-br/acesso-a-informacao/acoes-e-programas/financiamento/fundeb/2025-1/5a-publicacao-2013-portaria-mec-mf-no-13-de-29-de-dezembro-de-2025/1-receita-total-do-fundeb-por-ente-federado.pdf",
    sourceLabel: "Portaria FNDE / MEC - FUNDEB 2025",
  },
  2026: {
    kind: "csv",
    url: "https://www.gov.br/fnde/pt-br/acesso-a-informacao/acoes-e-programas/financiamento/fundeb/2026-1/publicacoes-2026/1-receita-total-do-fundeb-por-ente-federado-iii-1.csv",
    sourceLabel: "Portaria FNDE / MEC - FUNDEB 2026",
  },
};

const FNDE_VAAT_URLS: Record<number, string> = {
  2026:
    "https://www.gov.br/fnde/pt-br/acesso-a-informacao/acoes-e-programas/financiamento/fundeb/2026-1/publicacoes-2026/3-vaat-vaat-min-e-complementacao-vaat-por-ente-federado-iii.csv",
};

const FNDE_VAAT_HABILITACAO_URLS: Record<number, string> = {
  2026:
    "https://www.gov.br/fnde/pt-br/acesso-a-informacao/acoes-e-programas/financiamento/fundeb/vaat/lista-dos-entes-habilitados-e-inabilitados-ao-vaat-2026-posicao-final-com-ajuste-de-decisao-judicial-edit-csv.csv/@@download/file",
};

// Local CSV fallback files bundled in the project
const FNDE_LOCAL_RECEITAS: Record<number, string> = {
  2022: "data/fnde/receitas-2022.csv",
  2023: "data/fnde/receitas-2023.csv",
  2024: "data/fnde/receitas-2024.csv",
  2025: "data/fnde/receitas-2025.csv",
  2026: "data/fnde/receitas-2026.csv",
};

const FNDE_LOCAL_VAAT: Record<number, string> = {
  2026: "data/fnde/vaat-2026.csv",
};

const receitasCache = new Map<number, Promise<Map<string, FndeFundebReceitas>>>();
const vaatCache = new Map<number, Promise<Map<string, Omit<FndeVaatContext, "habilitacao" | "pendencia">>>>();
const habilitacaoCache = new Map<number, Promise<Map<string, Pick<FndeVaatContext, "habilitacao" | "pendencia">>>>();

function parseBrazilianNumber(value: string) {
  const normalized = value
    .replace(/\u00a0/g, " ")
    .trim()
    .replace(/^-$/, "0")
    .replace(/^-\s*$/, "0")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parsePercent(value: string) {
  const normalized = value.replace("%", "").trim().replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function readLocalCsv(relativePath: string): string | null {
  try {
    const fullPath = join(process.cwd(), relativePath);
    const bytes = readFileSync(fullPath);
    const utf8Text = new TextDecoder("utf-8").decode(bytes);
    if (utf8Text.includes("UF") || utf8Text.includes("IBGE") || utf8Text.includes("ANEXO")) {
      return utf8Text;
    }
    return new TextDecoder("latin1").decode(bytes);
  } catch {
    return null;
  }
}

async function fetchCsv(url: string, localFallback?: string) {
  // Try local bundled CSV FIRST when available — this avoids downloading PDFs
  // from gov.br which are blocked in Cloud Run and return binary content
  if (localFallback) {
    const local = readLocalCsv(localFallback);
    if (local) {
      console.info(`[FNDE] Using local CSV: ${localFallback}`);
      return local;
    }
  }

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/csv,application/octet-stream,*/*",
        "User-Agent": "Mozilla/5.0",
        Referer: "https://www.gov.br/fnde/pt-br/acesso-a-informacao/acoes-e-programas/financiamento/fundeb/",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`FNDE HTTP ${response.status}`);
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    const utf8Text = new TextDecoder("utf-8").decode(bytes);
    return utf8Text.includes("UF;") && utf8Text.includes("IBGE")
      ? utf8Text
      : new TextDecoder("latin1").decode(bytes);
  } catch (e) {
    throw new Error(`[FNDE] CSV fetch failed for ${url}: ${e instanceof Error ? e.message : e}`);
  }
}

async function fetchPdfText(url: string): Promise<string> {
  let PDFParse: any;
  try {
    // Use eval to bypass Next.js static module analysis — pdf-parse requires DOMMatrix
    // which is unavailable in serverless. This ensures the module is only loaded at call time.
    const dynamicRequire = eval("require") as NodeRequire;
    const mod = dynamicRequire("pdf-parse");
    PDFParse = mod.PDFParse ?? mod.default ?? mod;
  } catch (e) {
    throw new Error(`pdf-parse unavailable: ${e instanceof Error ? e.message : e}`);
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/pdf,*/*",
      "User-Agent": "Mozilla/5.0",
      Referer: "https://www.gov.br/fnde/pt-br/acesso-a-informacao/acoes-e-programas/financiamento/fundeb/",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Falha ao carregar PDF oficial do FNDE (${response.status}).`);
  }

  const parser = new PDFParse({ data: Buffer.from(await response.arrayBuffer()) });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

function parseFundebReceitasCsv(csvText: string, sourceLabel: string) {
  const rows = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[A-Z]{2};\d{7};/.test(line));

  const map = new Map<string, FndeFundebReceitas>();

  for (const row of rows) {
    const columns = row.split(";").map((value) => value.trim());
    const [uf, codigoIBGE, municipio, receitaBruta, vAAF, vAAT, vAAR, , total] = columns;

    if (!codigoIBGE || !municipio) {
      continue;
    }

    map.set(codigoIBGE, {
      codigoIBGE,
      municipio,
      uf,
      receitaContribuicaoMunicipal: parseBrazilianNumber(receitaBruta),
      complementacaoVAAF: parseBrazilianNumber(vAAF),
      complementacaoVAAT: parseBrazilianNumber(vAAT),
      complementacaoVAAR: parseBrazilianNumber(vAAR),
      totalReceitas: parseBrazilianNumber(total),
      fonte: sourceLabel,
    });
  }

  return map;
}

function parseFundebReceitasPdf(pdfText: string, sourceLabel: string) {
  const lines = pdfText
    .split(/\r?\n/)
    .map((line) => line.replace(/\t+/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const map = new Map<string, FndeFundebReceitas>();
  const rowRegex =
    /^([A-Z]{2})\s+(\d{7})\s+(.+?)\s+((?:-|\d[\d.,]*)\s+(?:-|\d[\d.,]*)\s+(?:-|\d[\d.,]*)\s+(?:-|\d[\d.,]*)\s+(?:-|\d[\d.,]*)\s+(?:-|\d[\d.,]*))$/;

  for (const line of lines) {
    const match = line.match(rowRegex);
    if (!match) {
      continue;
    }

    const [, uf, codigoIBGE, municipio, rawValues] = match;
    const values = rawValues.split(/\s+/).map(parseBrazilianNumber);

    if (values.length !== 6) {
      continue;
    }

    const receitaContrib = values[0];
    const cVAAF = values[1];
    const cVAAT = values[2];
    const cVAAR = values[3];
    // values[4] = complementação total (skip), values[5] = receita total
    const receitaTotal = values[5];

    // Sanity check: total should be >= each component, and components should sum ≈ total
    const compSum = receitaContrib + cVAAF + cVAAT + cVAAR;
    const valid =
      receitaTotal > 0 &&
      receitaContrib <= receitaTotal &&
      cVAAF <= receitaTotal &&
      cVAAT <= receitaTotal &&
      cVAAR <= receitaTotal &&
      (compSum === 0 || Math.abs(compSum - receitaTotal) / receitaTotal < 0.10);

    map.set(codigoIBGE, {
      codigoIBGE,
      municipio: municipio.trim(),
      uf,
      receitaContribuicaoMunicipal: valid ? receitaContrib : 0,
      complementacaoVAAF: valid ? cVAAF : 0,
      complementacaoVAAT: valid ? cVAAT : 0,
      complementacaoVAAR: valid ? cVAAR : 0,
      totalReceitas: receitaTotal,
      fonte: sourceLabel,
    });
  }

  return map;
}

/**
 * Parser for the older VAAF-style "Receita e Complementação da União-VAAF
 * por ente federado" PDFs (2021–2023). These have 3 value columns:
 *   Receita da contribuição | Complementação VAAF | Total
 * VAAT and VAAR were not separately published in this format.
 */
function parseFundebReceitasVaafPdf(pdfText: string, sourceLabel: string) {
  const lines = pdfText
    .split(/\r?\n/)
    .map((line) => line.replace(/\t+/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const map = new Map<string, FndeFundebReceitas>();

  // Try 3-column format: UF IBGE Nome Receita VAAF Total
  const rowRegex3 =
    /^([A-Z]{2})\s+(\d{7})\s+(.+?)\s+((?:-|\d[\d.,]*)\s+(?:-|\d[\d.,]*)\s+(?:-|\d[\d.,]*))$/;
  // Fallback 4-column: UF IBGE Nome Receita VAAF [algo] Total
  const rowRegex4 =
    /^([A-Z]{2})\s+(\d{7})\s+(.+?)\s+((?:-|\d[\d.,]*)\s+(?:-|\d[\d.,]*)\s+(?:-|\d[\d.,]*)\s+(?:-|\d[\d.,]*))$/;

  for (const line of lines) {
    let uf: string, codigoIBGE: string, municipio: string;
    let receitaContribuicao = 0;
    let complementacaoVAAF = 0;
    let totalReceitas = 0;

    const match3 = line.match(rowRegex3);
    if (match3) {
      const values = match3[4].split(/\s+/).map(parseBrazilianNumber);
      if (values.length === 3) {
        [uf, codigoIBGE, municipio] = [match3[1], match3[2], match3[3]];
        [receitaContribuicao, complementacaoVAAF, totalReceitas] = values;
      } else {
        continue;
      }
    } else {
      const match4 = line.match(rowRegex4);
      if (match4) {
        const values = match4[4].split(/\s+/).map(parseBrazilianNumber);
        if (values.length === 4) {
          [uf, codigoIBGE, municipio] = [match4[1], match4[2], match4[3]];
          receitaContribuicao = values[0];
          complementacaoVAAF = values[1];
          totalReceitas = values[3]; // last column is total
        } else {
          continue;
        }
      } else {
        continue;
      }
    }

    // Derive total: prefer the explicit total column; fallback to sum of components
    const derivedTotal = totalReceitas || (receitaContribuicao + complementacaoVAAF);

    // Sanity check: components should be <= total and sum ≈ total
    const compSumVaaf = receitaContribuicao + complementacaoVAAF;
    const validVaaf =
      derivedTotal > 0 &&
      receitaContribuicao <= derivedTotal &&
      complementacaoVAAF <= derivedTotal &&
      (compSumVaaf === 0 || Math.abs(compSumVaaf - derivedTotal) / derivedTotal < 0.10);

    map.set(codigoIBGE, {
      codigoIBGE,
      municipio: municipio.trim(),
      uf,
      receitaContribuicaoMunicipal: validVaaf ? receitaContribuicao : 0,
      complementacaoVAAF: validVaaf ? complementacaoVAAF : 0,
      complementacaoVAAT: 0,
      complementacaoVAAR: 0,
      totalReceitas: derivedTotal,
      fonte: sourceLabel,
    });
  }

  return map;
}

function parseVaatCsv(csvText: string) {
  const rows = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[A-Z]{2};.+;\d{7};/.test(line));

  const map = new Map<string, Omit<FndeVaatContext, "habilitacao" | "pendencia">>();

  for (const row of rows) {
    const columns = row.split(";").map((value) => value.trim());
    const [uf, ente, codigoIBGE, vaatAnterior, vaatComComplementacao, complementacaoVAAT, ieiPercentual] = columns;

    if (!codigoIBGE || !ente) {
      continue;
    }

    map.set(codigoIBGE, {
      codigoIBGE,
      uf,
      ente,
      vaatAnterior: parseBrazilianNumber(vaatAnterior),
      vaatComComplementacao: parseBrazilianNumber(vaatComComplementacao),
      complementacaoVAAT: parseBrazilianNumber(complementacaoVAAT),
      ieiPercentual: parsePercent(ieiPercentual),
    });
  }

  return map;
}

function parseHabilitacaoCsv(csvText: string) {
  const rows = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[A-Z]{2};.+;\d{7};/.test(line));

  const map = new Map<string, Pick<FndeVaatContext, "habilitacao" | "pendencia">>();

  for (const row of rows) {
    const columns = row.split(";").map((value) => value.trim());
    const [, , codigoIBGE, habilitacao, pendencia] = columns;

    if (!codigoIBGE) {
      continue;
    }

    map.set(codigoIBGE, {
      habilitacao: habilitacao || "Nao informado",
      pendencia: pendencia || null,
    });
  }

  return map;
}

async function loadFundebReceitasByYear(exercicio: number) {
  const cached = receitasCache.get(exercicio);
  if (cached) {
    return cached;
  }

  const source = FNDE_RECEITAS_SOURCES[exercicio];
  if (!source) {
    return null;
  }

  const promise = (async () => {
    try {
      if (source.kind === "csv") {
        return parseFundebReceitasCsv(await fetchCsv(source.url, FNDE_LOCAL_RECEITAS[exercicio]), source.sourceLabel);
      }

      if (source.kind === "pdf-vaaf") {
        return parseFundebReceitasVaafPdf(await fetchPdfText(source.url), source.sourceLabel);
      }

      return parseFundebReceitasPdf(await fetchPdfText(source.url), source.sourceLabel);
    } catch (error) {
      receitasCache.delete(exercicio);
      throw error;
    }
  })();

  receitasCache.set(exercicio, promise);
  return promise;
}

async function loadVaatByYear(exercicio: number) {
  const cached = vaatCache.get(exercicio);
  if (cached) {
    return cached;
  }

  const url = FNDE_VAAT_URLS[exercicio];
  if (!url) {
    return null;
  }

  const promise = (async () => {
    try {
      return parseVaatCsv(await fetchCsv(url, FNDE_LOCAL_VAAT[exercicio]));
    } catch (error) {
      vaatCache.delete(exercicio);
      throw error;
    }
  })();

  vaatCache.set(exercicio, promise);
  return promise;
}

async function loadHabilitacaoByYear(exercicio: number) {
  const cached = habilitacaoCache.get(exercicio);
  if (cached) {
    return cached;
  }

  const url = FNDE_VAAT_HABILITACAO_URLS[exercicio];
  if (!url) {
    return null;
  }

  const promise = (async () => {
    try {
      return parseHabilitacaoCsv(await fetchCsv(url, FNDE_LOCAL_VAAT[exercicio]));
    } catch (error) {
      habilitacaoCache.delete(exercicio);
      throw error;
    }
  })();

  habilitacaoCache.set(exercicio, promise);
  return promise;
}

export async function getFundebReceitasOficiais(
  codigoIBGE: string,
  exercicio: number,
): Promise<FndeFundebReceitas | null> {
  const table = await loadFundebReceitasByYear(exercicio);
  if (!table) {
    return null;
  }

  const digits = codigoIBGE.replace(/\D/g, "");
  const exactMatch = table.get(digits);
  if (exactMatch) {
    return exactMatch;
  }

  const normalized = normalizarIBGE(digits);

  for (const [rowCodigo, row] of table.entries()) {
    if (rowCodigo.startsWith(normalized)) {
      return row;
    }
  }

  return null;
}

export async function getFundebVaatContext(
  codigoIBGE: string,
  exercicio: number,
): Promise<FndeVaatContext | null> {
  const [vaatTable, habilitacaoTable] = await Promise.all([
    loadVaatByYear(exercicio),
    loadHabilitacaoByYear(exercicio),
  ]);

  if (!vaatTable && !habilitacaoTable) {
    return null;
  }

  const digits = codigoIBGE.replace(/\D/g, "");
  const normalized = normalizarIBGE(digits);

  const vaat =
    vaatTable?.get(digits) ??
    [...(vaatTable?.entries() ?? [])].find(([rowCodigo]) => rowCodigo.startsWith(normalized))?.[1] ??
    null;
  const habilitacao =
    habilitacaoTable?.get(digits) ??
    [...(habilitacaoTable?.entries() ?? [])].find(([rowCodigo]) => rowCodigo.startsWith(normalized))?.[1] ??
    null;

  if (!vaat && !habilitacao) {
    return null;
  }

  return {
    codigoIBGE: vaat?.codigoIBGE ?? digits,
    uf: vaat?.uf ?? "",
    ente: vaat?.ente ?? "",
    vaatAnterior: vaat?.vaatAnterior ?? 0,
    vaatComComplementacao: vaat?.vaatComComplementacao ?? 0,
    complementacaoVAAT: vaat?.complementacaoVAAT ?? 0,
    ieiPercentual: vaat?.ieiPercentual ?? null,
    habilitacao: habilitacao?.habilitacao ?? "Nao informado",
    pendencia: habilitacao?.pendencia ?? null,
  };
}

/**
 * Fallback: fetch FUNDEB revenue from SICONFI DCA (Tesouro Nacional) when FNDE portarias are unavailable.
 * Uses DCA Anexo I-C (Receitas Orçamentárias) to find FUNDEB-related accounts.
 *
 * Account mapping (PCASP / DCA Anexo I-C):
 *   1.7.5.1.xx.x.x — Transferências recebidas do FUNDEB (redistribuição estadual/municipal)
 *   1.7.1.5.xx.x.x — Transferências da União – Complementação ao FUNDEB (VAAF + VAAT + VAAR)
 *
 * IMPORTANT: The DCA does NOT break down the federal complement into VAAF/VAAT/VAAR.
 * We only get: (a) total redistributed FUNDEB transfers, (b) total federal complement.
 * If the decomposition is inconsistent (e.g. complement > total, or components don't sum
 * to total), we keep the total but null out the component breakdown to avoid showing
 * swapped or incorrect values in the historical revenue table.
 */
async function getFundebReceitasSiconfiDCA(
  codigoIBGE: string,
  exercicio: number,
): Promise<FndeFundebReceitas | null> {
  const ibge7 = normalizarIBGE(codigoIBGE);
  const url = `https://apidatalake.tesouro.gov.br/ords/siconfi/tt/dca?an_exercicio=${exercicio}&id_ente=${ibge7}&no_anexo=DCA-Anexo%20I-C&co_tipo_demonstrativo=DCA`;

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) return null;
    const data = await response.json() as { items?: Array<{ conta: string; coluna: string; valor: number }> };
    const items = data.items ?? [];

    // Filter to "Receitas Realizadas" column when available; DCA rows may have
    // multiple columns (previsão inicial, previsão atualizada, realizadas, etc.)
    const realized = items.filter(
      (i) => !i.coluna || /realizad|arrecadad|Receitas Brutas Realizadas/i.test(i.coluna),
    );
    const source = realized.length > 0 ? realized : items;

    // 1.7.5.1 — FUNDEB redistribution transfers (state+municipal contribution through the fund).
    // Pick the most specific top-level account match (e.g. 1.7.5.1.00.0.0 preferred over sub-accounts).
    const transferencias = pickBestAccountValue(source, "1.7.5.1");

    // 1.7.1.5 — Federal complementation to FUNDEB (VAAF + VAAT + VAAR combined).
    const complementacao = pickBestAccountValue(source, "1.7.1.5");

    // Some municipalities report a single total FUNDEB line at 1.7.5.0 or 1.7.5.x
    const totalFundebLine = pickBestAccountValue(source, "1.7.5.0");

    // Determine the most reliable total
    const componentsSum = transferencias + complementacao;
    const totalReceitas =
      totalFundebLine > 0 && totalFundebLine >= componentsSum
        ? totalFundebLine
        : componentsSum > 0
          ? componentsSum
          : 0;

    if (totalReceitas <= 0) return null;

    // Validate decomposition: components must be non-negative and sum ≈ total
    const decompositionValid =
      transferencias > 0 &&
      complementacao >= 0 &&
      componentsSum > 0 &&
      // Allow 5% tolerance for rounding
      Math.abs(componentsSum - totalReceitas) / totalReceitas < 0.05 &&
      // Complement should not exceed total (it's a part of total)
      complementacao <= totalReceitas &&
      // For most municipalities, the contribution is the larger part
      // (only very small/poor municipalities get more complement than contribution)
      // We don't enforce this but we do validate the sum
      transferencias <= totalReceitas;

    return {
      codigoIBGE: ibge7,
      municipio: "",
      uf: "",
      totalReceitas,
      // Only expose breakdown when it's validated; otherwise null-out to avoid
      // showing swapped/wrong values in the PDF
      receitaContribuicaoMunicipal: decompositionValid ? transferencias : 0,
      complementacaoVAAF: decompositionValid ? complementacao : 0,
      complementacaoVAAT: 0,
      complementacaoVAAR: 0,
      fonte: `SICONFI / Tesouro Nacional - DCA ${exercicio}`,
    };
  } catch {
    return null;
  }
}

/**
 * Pick the best account value from DCA items for a given account prefix.
 * Prefers the top-level aggregation (e.g. "1.7.5.1.00.0.0") over sub-accounts.
 * If there are multiple matches, picks the one with the highest (most aggregated) value,
 * unless the ".00.0.0" suffix is found (which is the rollup line).
 */
function pickBestAccountValue(
  items: Array<{ conta: string; valor: number }>,
  prefix: string,
): number {
  const re = new RegExp(`^${prefix.replace(/\./g, "\\.")}`);
  const matches = items.filter((i) => re.test(i.conta));
  if (matches.length === 0) return 0;

  // Prefer the rollup line ending in .00.0.0 or .00.00.00
  const rollup = matches.find((i) =>
    /\.00\.0\.0$|\.00\.00\.00$/.test(i.conta),
  );
  if (rollup) return rollup.valor;

  // Otherwise pick the match with the highest absolute value (likely the rollup)
  return matches.reduce((best, item) =>
    Math.abs(item.valor) > Math.abs(best.valor) ? item : best,
  ).valor;
}

export async function getFundebReceitasHistoricas(
  codigoIBGE: string,
  exercicio: number,
  options?: {
    anosRetroativos?: number;
    atualOverride?: FndeFundebReceitas | null;
  },
) {
  const anosRetroativos = Math.max(1, options?.anosRetroativos ?? 2);
  const anos = Array.from({ length: anosRetroativos + 1 }, (_, index) => exercicio - anosRetroativos + index);

  const results = await Promise.all(
    anos.map(async (ano) => {
      if (ano === exercicio && options?.atualOverride) {
        return options.atualOverride;
      }

      try {
        const fnde = await getFundebReceitasOficiais(codigoIBGE, ano);
        if (fnde) return fnde;
      } catch {
        // FNDE portaria failed (403, timeout, etc.)
      }

      // Fallback: try SICONFI DCA for years without FNDE data
      try {
        return await getFundebReceitasSiconfiDCA(codigoIBGE, ano);
      } catch {
        return null;
      }
    }),
  );

  return anos
    .map((ano, index) => {
      const receita = results[index];
      if (!receita) {
        return null;
      }

      return {
        ano,
        ...receita,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}
