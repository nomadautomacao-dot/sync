import populacaoCenso2022 from "@/data/ibge-populacao-2022.json";

const populacaoDataset = populacaoCenso2022 as Record<string, number>;

function parseBrazilianNumber(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Parses numbers returned by the IBGE indicadores API.
 * The API returns values in American/international format: "13567.92", "98.1"
 * (dots are decimal separators, NOT thousand separators).
 *
 * If the string contains a comma, falls back to Brazilian format parsing.
 */
function parseApiNumber(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  // If comma exists → Brazilian format (e.g. "13.567,92")
  if (trimmed.includes(",")) {
    return parseBrazilianNumber(trimmed);
  }

  // Otherwise → international format (e.g. "13567.92", "98.1", "191.817")
  // In this context dots are DECIMAL separators, not thousand separators
  const cleaned = trimmed.replace(/[^\d.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export interface IbgeCidadeIndicators {
  populacaoEstimada: number | null;
  populacaoAnoReferencia: string | null;
  populacaoUltimoCenso: number | null;
  receitasBrutasMunicipais: number | null;
  receitasAnoReferencia: string | null;
  escolarizacao614: number | null;
  pibPerCapita: number | null;
  pibAnoReferencia: string | null;
  areaTerritorial: number | null;
}

// ---------------------------------------------------------------------------
// IBGE API helpers
// ---------------------------------------------------------------------------

/**
 * SIDRA API: returns JSON array where [0] is the header row and [1]+ are data rows.
 * Each data row has a `V` field with the value and `D2C` (period code like "2022").
 * Returns null if the value is "-", "...", "X", or missing.
 *
 * NOTE: "-" is *not* absence in IBGE notation — it means exactly zero (see
 * `core/lib/notacao-ibge.ts`). Collapsing it into null is deliberate here and
 * only here: this function reads population, GDP and territorial area, none of
 * which can legitimately be zero for a municipality, so both readings coincide
 * and swapping a tested behaviour would buy nothing. Do not copy this rule into
 * a reader where zero is a plausible value — use `numeroIbge` instead. That
 * mistake printed "N/D" for the rural population of every state capital.
 */
async function fetchSidraValue(
  tableId: string,
  codigoIBGE: string,
  variableId: string,
): Promise<{ value: number; period: string } | null> {
  const url =
    `https://apisidra.ibge.gov.br/values/t/${tableId}/n6/${codigoIBGE}/v/${variableId}/p/last%201`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(10_000),
    next: { revalidate: 60 * 60 * 24 * 7 },
  });
  if (!response.ok) return null;

  const data: Array<Record<string, string>> = await response.json();
  // data[0] is the header metadata row; data[1] is the actual result
  const row = data[1];
  if (!row) return null;

  const raw = row.V;
  if (!raw || raw === "-" || raw === "..." || raw === "X") return null;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;

  // D3C contains the year ("Ano (Código)"), D2C is the variable ID
  const period = row.D3C ?? row.D3N ?? "";
  return { value: parsed, period };
}

/**
 * IBGE servicodados indicadores API — fetches all research indicators for a
 * municipality at once. Response is an array of research objects, each
 * containing `res` with nested period→value maps.
 *
 * Endpoint: GET /api/v1/pesquisas/indicadores/{indicadorIds}/resultados/{codigoIBGE}
 *
 * Indicator IDs used by cidades-e-estados panorama:
 *  - 29171 = População estimada
 *  - 29167 = Área da unidade territorial (km²)
 *  - 47001 = PIB per capita
 *  - 30255 = IDHM (unused but kept for reference)
 *  - 60045 = Escolarização 6 a 14 anos
 *  - 28141 = Receitas orçamentárias brutas realizadas (R$)
 */
interface IndicadorResultEntry {
  localidade: string;
  res: Record<string, string>;
}

interface IndicadorResult {
  id: number | string;
  res: IndicadorResultEntry[] | null;
}

async function fetchIndicadoresApi(codigoIBGE: string): Promise<IbgeCidadeIndicators | null> {
  const indicadorIds = "29171|29167|47001|30255|60045|28141";
  const url =
    `https://servicodados.ibge.gov.br/api/v1/pesquisas/indicadores/${indicadorIds}/resultados/${codigoIBGE}`;

  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(15_000),
    next: { revalidate: 60 * 60 * 24 * 7 },
  });
  if (!response.ok) return null;

  const data: IndicadorResult[] = await response.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  /**
   * Each indicator result has `res` which is typically:
   *   { "<codigoIBGE>": { "<year>": "<value>", ... } }
   * We pick the most recent year with a non-empty value.
   */
  function extractLatest(indicadorId: string): { value: number; year: string } | null {
    const entry = data.find((d) => String(d.id) === indicadorId);
    if (!entry?.res || !Array.isArray(entry.res) || entry.res.length === 0) return null;

    // The res is an array of { localidade, res: { year: value } } objects.
    // localidade uses 6 digits (IBGE without check digit), our codigoIBGE has 7.
    const ibge6 = codigoIBGE.slice(0, 6);
    const municipioEntry = entry.res.find((e) => e.localidade === ibge6 || e.localidade === codigoIBGE)
      ?? entry.res[0];
    const municipioData = municipioEntry?.res;
    if (!municipioData || typeof municipioData !== "object") return null;

    // Find the most recent year with valid data
    const years = Object.keys(municipioData)
      .filter((y) => /^\d{4}$/.test(y))
      .sort((a, b) => Number(b) - Number(a));

    for (const year of years) {
      const raw = municipioData[year];
      if (!raw || raw === "-" || raw === "..." || raw === "X") continue;
      const parsed = parseApiNumber(raw);
      if (parsed != null) return { value: parsed, year };
    }
    return null;
  }

  const populacaoEstimada = extractLatest("29171");
  const areaTerritorial = extractLatest("29167");  // km²
  const pibPerCapita = extractLatest("47001");
  const idhm = extractLatest("30255"); // Still extracted but unused — kept for future reference
  // NOTE: indicator 60048 is NOT mortality — it's "Transferências correntes brutas (%)"
  // Mortality data comes from the HTML scraper fallback (DataSUS source)
  const escolarizacao614 = extractLatest("60045");
  const receitas = extractLatest("28141");  // Receitas orçamentárias brutas (R$)

  // Only consider it successful if we got at least population data
  if (!populacaoEstimada) return null;

  return {
    populacaoEstimada: populacaoEstimada?.value ?? null,
    populacaoAnoReferencia: populacaoEstimada?.year ?? null,
    populacaoUltimoCenso: null,  // Not available from this API source
    receitasBrutasMunicipais: receitas?.value ?? null,
    receitasAnoReferencia: receitas?.year ?? null,
    escolarizacao614: escolarizacao614?.value ?? null,
    pibPerCapita: pibPerCapita?.value ?? null,
    pibAnoReferencia: pibPerCapita?.year ?? null,
    areaTerritorial: areaTerritorial?.value ?? null,
  } satisfies IbgeCidadeIndicators;
}

/**
 * Fetches indicators from the SIDRA API (individual table queries).
 * Used as a secondary API fallback if the indicadores API fails.
 *
 * Tables:
 *  - 4714 (Censo 2022): v/93 = População residente
 *  - 6579 (Estimativas pop): v/9324 = População estimada
 *  - 5938 (PIB Municípios): v/37 = PIB total a preços correntes (Mil Reais)
 *  - 1301 (Área territorial): v/615 = Área em km²
 *
 * Note: SIDRA table 5938/v37 returns GDP total in "Mil Reais", NOT per capita.
 * We calculate per capita = (PIB_total * 1000) / população.
 */
async function fetchFromSidraApi(codigoIBGE: string): Promise<Partial<IbgeCidadeIndicators> | null> {
  const [populacao, popEstimada, pibTotal, area] = await Promise.allSettled([
    fetchSidraValue("4714", codigoIBGE, "93"),
    fetchSidraValue("6579", codigoIBGE, "9324"),
    fetchSidraValue("5938", codigoIBGE, "37"),
    fetchSidraValue("1301", codigoIBGE, "615"),
  ]);

  const pop = populacao.status === "fulfilled" ? populacao.value : null;
  const popEst = popEstimada.status === "fulfilled" ? popEstimada.value : null;
  const pibVal = pibTotal.status === "fulfilled" ? pibTotal.value : null;
  const areaVal = area.status === "fulfilled" ? area.value : null;

  // At least one population source must be present
  if (!pop && !popEst) return null;

  // Calculate PIB per capita: PIB is in "Mil Reais", so multiply by 1000 first
  const bestPop = popEst?.value ?? pop?.value ?? 0;
  const pibPerCapita = pibVal && bestPop > 0
    ? Math.round((pibVal.value * 1000) / bestPop * 100) / 100
    : null;

  return {
    populacaoEstimada: popEst?.value ?? null,
    populacaoAnoReferencia: popEst?.period ?? pop?.period ?? "2022",
    populacaoUltimoCenso: pop?.value ?? null,
    pibPerCapita,
    pibAnoReferencia: pibVal?.period ?? null,
    areaTerritorial: areaVal?.value ?? null,
  };
}

// ---------------------------------------------------------------------------
// Merge helper: fills nulls in `base` with values from `patch`
// ---------------------------------------------------------------------------

function mergeIndicators(
  base: IbgeCidadeIndicators,
  patch: Partial<IbgeCidadeIndicators>,
): IbgeCidadeIndicators {
  const merged = { ...base };
  for (const key of Object.keys(patch) as Array<keyof IbgeCidadeIndicators>) {
    if (merged[key] == null && patch[key] != null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (merged as any)[key] = patch[key];
    }
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

const cache = new Map<string, Promise<IbgeCidadeIndicators | null>>();

export async function getIbgeCidadeIndicators(
  municipioNome: string,
  uf: string,
  codigoIBGE?: string,
): Promise<IbgeCidadeIndicators | null> {
  const key = `${municipioNome}|${uf}`.toUpperCase();
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const ibgeCode = codigoIBGE?.replace(/\D/g, "") ?? "";

    // -----------------------------------------------------------------------
    // Step 1: Try the IBGE indicadores API (all indicators at once)
    // -----------------------------------------------------------------------
    if (ibgeCode) {
      try {
        const apiResult = await fetchIndicadoresApi(ibgeCode);
        if (apiResult) {
          console.info(`[ibge] API indicadores OK para ${municipioNome} (${ibgeCode})`);
          return apiResult;
        }
      } catch (error) {
        console.warn(
          `[ibge] API indicadores failed for ${municipioNome} (${ibgeCode}):`,
          error instanceof Error ? error.message : error,
        );
      }

      // -------------------------------------------------------------------
      // Step 2: Try the SIDRA API (individual tables, fewer indicators)
      // -------------------------------------------------------------------
      try {
        const sidraResult = await fetchFromSidraApi(ibgeCode);
        if (sidraResult) {
          console.info(`[ibge] API SIDRA OK para ${municipioNome} (${ibgeCode})`);
          // SIDRA doesn't have all indicators — return what we have, rest as null
          return {
            populacaoEstimada: sidraResult.populacaoEstimada ?? null,
            populacaoAnoReferencia: sidraResult.populacaoAnoReferencia ?? null,
            populacaoUltimoCenso: sidraResult.populacaoUltimoCenso ?? null,
            receitasBrutasMunicipais: sidraResult.receitasBrutasMunicipais ?? null,
            receitasAnoReferencia: sidraResult.receitasAnoReferencia ?? null,
            escolarizacao614: sidraResult.escolarizacao614 ?? null,
            pibPerCapita: sidraResult.pibPerCapita ?? null,
            pibAnoReferencia: sidraResult.pibAnoReferencia ?? null,
            areaTerritorial: sidraResult.areaTerritorial ?? null,
          } satisfies IbgeCidadeIndicators;
        }
      } catch (error) {
        console.warn(
          `[ibge] API SIDRA failed for ${municipioNome} (${ibgeCode}):`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    // O scraper de `ibge.gov.br/cidades-e-estados` foi removido: o IBGE passou
    // a responder 403 a qualquer User-Agent (bot protection), então o passo só
    // custava uma ida à rede antes de falhar. Mortalidade infantil e IDHM, que
    // vinham de lá, agora saem do coletor de saúde do Perfil Municipal.

    // -----------------------------------------------------------------------
    // Step 4: Fall back to local population dataset
    // -----------------------------------------------------------------------
    const populacaoLocal = ibgeCode ? populacaoDataset[ibgeCode] : undefined;
    if (populacaoLocal) {
      console.info(`[ibge] Usando fallback local para ${municipioNome} (${ibgeCode}): pop=${populacaoLocal}`);
      return {
        populacaoEstimada: null,
        populacaoAnoReferencia: "2022",
        populacaoUltimoCenso: populacaoLocal,
        receitasBrutasMunicipais: null,
        receitasAnoReferencia: null,
        escolarizacao614: null,
        pibPerCapita: null,
        pibAnoReferencia: null,
        areaTerritorial: null,
      } satisfies IbgeCidadeIndicators;
    }

    return null;
  })();

  cache.set(key, promise);
  return promise;
}
