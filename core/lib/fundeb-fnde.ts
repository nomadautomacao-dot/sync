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
    };

const FNDE_RECEITAS_SOURCES: Record<number, FndeReceitasSource> = {
  2024: {
    kind: "pdf",
    url: "https://www.gov.br/fnde/pt-br/acesso-a-informacao/acoes-e-programas/financiamento/fundeb/2024/ReceitaTotalporEnteFederado.pdf",
    sourceLabel: "Portaria FNDE / MEC - FUNDEB 2024",
  },
  2025: {
    kind: "pdf",
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
    // Try local bundled CSV as fallback
    if (localFallback) {
      const local = readLocalCsv(localFallback);
      if (local) {
        console.warn(`[FNDE] Remote fetch failed, using local fallback: ${localFallback}`);
        return local;
      }
    }
    throw e;
  }
}

async function fetchPdfText(url: string) {
  const { PDFParse } = await import("pdf-parse");
  const response = await fetch(url, {
    headers: {
      Accept: "application/pdf,*/*",
      "User-Agent": "Mozilla/5.0",
      Referer: "https://www.gov.br/fnde/pt-br/acesso-a-informacao/acoes-e-programas/financiamento/fundeb/",
    },
    cache: "no-store",
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

    map.set(codigoIBGE, {
      codigoIBGE,
      municipio: municipio.trim(),
      uf,
      receitaContribuicaoMunicipal: values[0],
      complementacaoVAAF: values[1],
      complementacaoVAAT: values[2],
      complementacaoVAAR: values[3],
      totalReceitas: values[5],
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

      return await getFundebReceitasOficiais(codigoIBGE, ano);
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
