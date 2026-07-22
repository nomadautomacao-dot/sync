const CACHE_TTL_MS = 1000 * 60 * 60 * 12;
const SICONFI_BASE_URL = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt";

interface CacheEntry<T> {
  loadedAt: number;
  data: T;
}

interface SiconfiExtratoEntregaItem {
  exercicio: number;
  cod_ibge: number;
  populacao?: number;
  instituicao?: string;
  entregavel?: string;
  periodo?: number;
  periodicidade?: string;
  status_relatorio?: string | null;
  data_status?: string | null;
  forma_envio?: string | null;
  tipo_relatorio?: string | null;
}

interface SiconfiAccountItem {
  exercicio: number;
  instituicao?: string;
  cod_ibge?: number;
  uf?: string;
  populacao?: number;
  anexo?: string;
  rotulo?: string;
  coluna?: string;
  cod_conta?: string;
  conta?: string;
  valor?: number;
  periodo?: number;
  periodicidade?: string;
}

interface SiconfiEntregaSelecionada {
  tipo: "DCA" | "RGF" | "RREO";
  exercicio: number;
  periodo: number;
  periodicidade: string;
  instituicao: string;
  dataStatus: string | null;
}

interface SiconfiFiscalRecord {
  codigoIBGE: string;
  anoReferencia: number;
  instituicao: string;
  uf: string;
  populacao: number | null;
  disponivel: boolean;
  situacaoLrf: string;
  rcl: number | null;
  rclAjustada: number | null;
  despesaPessoalTotal: number | null;
  percentualDespesaPessoal: number | null;
  limiteMaximoPessoal: number | null;
  limitePrudencialPessoal: number | null;
  limiteAlertaPessoal: number | null;
  espacoFiscalPessoal: number | null;
  receitaTotalPrevista: number | null;
  receitaTotalRealizada: number | null;
  receitasCorrentesRealizadas: number | null;
  caixaEquivalentes: number | null;
  dividaAtivaTributaria: number | null;
  passivoCirculante: number | null;
  passivoNaoCirculante: number | null;
  patrimonioLiquido: number | null;
  resultadoExercicio: number | null;
  entregas: {
    dca: SiconfiEntregaSelecionada | null;
    rgf: SiconfiEntregaSelecionada | null;
    rreo: SiconfiEntregaSelecionada | null;
  };
  fontes: string[];
  observacoes: string[];
}

const fiscalCache = new Map<string, CacheEntry<SiconfiFiscalRecord | null>>();

function withinCache<T>(cache: CacheEntry<T> | null | undefined) {
  return cache && Date.now() - cache.loadedAt < CACHE_TTL_MS;
}

async function fetchSiconfiJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { "User-Agent": "Sync/1.0", Accept: "application/json" },
    next: { revalidate: 60 * 60 * 12 },
  });

  if (!response.ok) {
    throw new Error(`Falha ao consultar SICONFI: ${response.status}`);
  }

  return (await response.json()) as T;
}

function buildUrl(path: string, params: Record<string, string | number | null | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") {
      continue;
    }
    query.set(key, String(value));
  }
  return `${SICONFI_BASE_URL}/${path}?${query.toString()}`;
}

async function fetchExtratoEntregas(codigoIBGE: string, exercicio: number) {
  const url = buildUrl("extrato_entregas", {
    id_ente: codigoIBGE,
    an_referencia: exercicio,
  });
  const json = await fetchSiconfiJson<{ items?: SiconfiExtratoEntregaItem[] }>(url);
  return json.items ?? [];
}

function isPrefeituraInstitution(value?: string | null) {
  if (!value) {
    return false;
  }

  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return normalized.includes("prefeitura municipal") || !normalized.includes("camara de vereadores");
}

function pickLatestEntrega(
  entregasPorAno: Array<{ exercicio: number; items: SiconfiExtratoEntregaItem[] }>,
  tipo: "DCA" | "RGF" | "RREO",
) {
  const matcher =
    tipo === "DCA"
      ? /balan[cç]o anual \(dca\)/i
      : tipo === "RGF"
      ? /relat[oó]rio de gest[aã]o fiscal/i
      : /relat[oó]rio resumido de execu[cç][aã]o or[cç]ament[aá]ria/i;

  for (const ano of entregasPorAno) {
    const item = ano.items
      .filter((entry) => matcher.test(entry.entregavel ?? "") && isPrefeituraInstitution(entry.instituicao))
      .sort((left, right) => {
        const periodDiff = (right.periodo ?? 0) - (left.periodo ?? 0);
        if (periodDiff !== 0) {
          return periodDiff;
        }
        return (right.data_status ?? "").localeCompare(left.data_status ?? "");
      })[0];

    if (item) {
      return {
        tipo,
        exercicio: item.exercicio,
        periodo: item.periodo ?? 0,
        periodicidade: item.periodicidade ?? (tipo === "DCA" ? "A" : tipo === "RGF" ? "Q" : "B"),
        instituicao: item.instituicao ?? "Nao informado",
        dataStatus: item.data_status ?? null,
      } satisfies SiconfiEntregaSelecionada;
    }
  }

  return null;
}

async function resolveEntregas(codigoIBGE: string, exercicio: number) {
  const candidateYears = Array.from({ length: 4 }, (_, index) => exercicio - index).filter((year) => year >= 2021);
  const entregasPorAno = await Promise.all(
    candidateYears.map(async (year) => ({
      exercicio: year,
      items: await fetchExtratoEntregas(codigoIBGE, year).catch(() => []),
    })),
  );

  return {
    dca: pickLatestEntrega(entregasPorAno, "DCA"),
    rgf: pickLatestEntrega(entregasPorAno, "RGF"),
    rreo: pickLatestEntrega(entregasPorAno, "RREO"),
  };
}

async function fetchDca(codigoIBGE: string, exercicio: number) {
  const url = buildUrl("dca", {
    id_ente: codigoIBGE,
    an_exercicio: exercicio,
  });
  const json = await fetchSiconfiJson<{ items?: SiconfiAccountItem[] }>(url);
  return json.items ?? [];
}

async function fetchRgf(codigoIBGE: string, entrega: SiconfiEntregaSelecionada) {
  const url = buildUrl("rgf", {
    id_ente: codigoIBGE,
    an_exercicio: entrega.exercicio,
    in_periodicidade: entrega.periodicidade,
    nr_periodo: entrega.periodo,
    co_tipo_demonstrativo: "RGF",
    co_poder: "E",
    no_anexo: "RGF-Anexo 01",
  });
  const json = await fetchSiconfiJson<{ items?: SiconfiAccountItem[] }>(url);
  return json.items ?? [];
}

async function fetchRreo(codigoIBGE: string, entrega: SiconfiEntregaSelecionada) {
  const url = buildUrl("rreo", {
    id_ente: codigoIBGE,
    an_exercicio: entrega.exercicio,
    nr_periodo: entrega.periodo,
    co_tipo_demonstrativo: "RREO",
    no_anexo: "RREO-Anexo 01",
  });
  const json = await fetchSiconfiJson<{ items?: SiconfiAccountItem[] }>(url);
  return json.items ?? [];
}

function pickMetric(items: SiconfiAccountItem[], codConta: string, coluna = "Valor") {
  const target = items.find((item) => item.cod_conta === codConta && (item.coluna ?? "Valor") === coluna);
  return typeof target?.valor === "number" && Number.isFinite(target.valor) ? target.valor : null;
}

function deriveSituacaoLrf(params: {
  percentualDespesaPessoal: number | null;
  limiteAlertaPessoal: number | null;
  limitePrudencialPessoal: number | null;
  limiteMaximoPessoal: number | null;
}) {
  const percentual = params.percentualDespesaPessoal;
  if (percentual === null) {
    return "Nao informado";
  }

  if (params.limiteMaximoPessoal !== null && percentual > params.limiteMaximoPessoal) {
    return "Acima do limite maximo";
  }
  if (params.limitePrudencialPessoal !== null && percentual >= params.limitePrudencialPessoal) {
    return "Acima do limite prudencial";
  }
  if (params.limiteAlertaPessoal !== null && percentual >= params.limiteAlertaPessoal) {
    return "Acima do limite de alerta";
  }
  return "Abaixo do limite de alerta";
}

function buildFontes(entregas: SiconfiFiscalRecord["entregas"]) {
  const fontes: string[] = [];

  if (entregas.dca) {
    fontes.push(`SICONFI / Tesouro Nacional - DCA ${entregas.dca.exercicio}`);
  }
  if (entregas.rgf) {
    fontes.push(
      `SICONFI / Tesouro Nacional - RGF ${entregas.rgf.exercicio} periodo ${entregas.rgf.periodo}`,
    );
  }
  if (entregas.rreo) {
    fontes.push(
      `SICONFI / Tesouro Nacional - RREO ${entregas.rreo.exercicio} periodo ${entregas.rreo.periodo}`,
    );
  }

  return fontes;
}

export async function getSiconfiFiscalRecord(
  codigoIBGE: string,
  exercicio = new Date().getFullYear(),
): Promise<SiconfiFiscalRecord | null> {
  const digits = codigoIBGE.replace(/\D/g, "");
  if (digits.length !== 7) {
    return null;
  }

  const cacheKey = `${digits}:${exercicio}`;
  const cached = fiscalCache.get(cacheKey);
  if (withinCache(cached)) {
    return cached?.data ?? null;
  }

  const entregas = await resolveEntregas(digits, exercicio);

  if (!entregas.dca && !entregas.rgf && !entregas.rreo) {
    fiscalCache.set(cacheKey, { loadedAt: Date.now(), data: null });
    return null;
  }

  const [dcaItems, rgfItems, rreoItems] = await Promise.all([
    entregas.dca ? fetchDca(digits, entregas.dca.exercicio).catch(() => []) : Promise.resolve([]),
    entregas.rgf ? fetchRgf(digits, entregas.rgf).catch(() => []) : Promise.resolve([]),
    entregas.rreo ? fetchRreo(digits, entregas.rreo).catch(() => []) : Promise.resolve([]),
  ]);

  const instituicao =
    entregas.rgf?.instituicao ??
    entregas.rreo?.instituicao ??
    entregas.dca?.instituicao ??
    rgfItems[0]?.instituicao ??
    rreoItems[0]?.instituicao ??
    dcaItems[0]?.instituicao ??
    "Nao informado";
  const anoReferencia = Math.max(
    entregas.rgf?.exercicio ?? 0,
    entregas.rreo?.exercicio ?? 0,
    entregas.dca?.exercicio ?? 0,
  );
  const uf = rgfItems[0]?.uf ?? rreoItems[0]?.uf ?? dcaItems[0]?.uf ?? "";
  const populacao = rgfItems[0]?.populacao ?? rreoItems[0]?.populacao ?? dcaItems[0]?.populacao ?? null;

  const rcl = pickMetric(rgfItems, "ReceitaCorrenteLiquidaLimiteLegal");
  const rclAjustada = pickMetric(rgfItems, "ReceitaCorrenteLiquidaAjustada");
  const despesaPessoalTotal = pickMetric(rgfItems, "DespesaComPessoalTotal");
  const percentualDespesaPessoal = pickMetric(rgfItems, "DespesaComPessoalTotal", "% sobre a RCL Ajustada");
  const limiteMaximoPessoal = pickMetric(rgfItems, "LimiteMaximoDespesaComPessoalTotal", "% sobre a RCL Ajustada");
  const limitePrudencialPessoal = pickMetric(
    rgfItems,
    "LimitePrudencialDespesaComPessoalTotal",
    "% sobre a RCL Ajustada",
  );
  const limiteAlertaPessoal = pickMetric(
    rgfItems,
    "LimiteDeAlertaDespesaComPessoalTotal",
    "% sobre a RCL Ajustada",
  );
  const situacaoLrf = deriveSituacaoLrf({
    percentualDespesaPessoal,
    limiteAlertaPessoal,
    limitePrudencialPessoal,
    limiteMaximoPessoal,
  });
  const receitaTotalPrevista = pickMetric(rreoItems, "ReceitasExcetoIntraOrcamentarias", "PREVISAO ATUALIZADA (a)")
    ?? pickMetric(rreoItems, "ReceitasExcetoIntraOrcamentarias", "PREVISÃO ATUALIZADA (a)");
  const receitaTotalRealizada = pickMetric(rreoItems, "ReceitasExcetoIntraOrcamentarias", "Ate o Bimestre (c)")
    ?? pickMetric(rreoItems, "ReceitasExcetoIntraOrcamentarias", "Até o Bimestre (c)");
  const receitasCorrentesRealizadas = pickMetric(rreoItems, "ReceitasCorrentes", "Ate o Bimestre (c)")
    ?? pickMetric(rreoItems, "ReceitasCorrentes", "Até o Bimestre (c)");
  const caixaEquivalentes = pickMetric(dcaItems, "P1.1.1.0.0.00.00", "31/12/2024")
    ?? pickMetric(dcaItems, "P1.1.1.0.0.00.00", `31/12/${entregas.dca?.exercicio ?? exercicio}`);
  const dividaAtivaTributaria = pickMetric(dcaItems, "P1.1.2.5.0.00.00", `31/12/${entregas.dca?.exercicio ?? exercicio}`);
  const passivoCirculante = pickMetric(dcaItems, "P2.1.0.0.0.00.00", `31/12/${entregas.dca?.exercicio ?? exercicio}`);
  const passivoNaoCirculante = pickMetric(
    dcaItems,
    "P2.2.0.0.0.00.00",
    `31/12/${entregas.dca?.exercicio ?? exercicio}`,
  );
  const patrimonioLiquido = pickMetric(dcaItems, "P2.3.0.0.0.00.00", `31/12/${entregas.dca?.exercicio ?? exercicio}`);
  const resultadoExercicio = pickMetric(
    dcaItems,
    "P2.3.7.1.1.01.00",
    `31/12/${entregas.dca?.exercicio ?? exercicio}`,
  );

  const observacoes: string[] = [];
  const resumoEntregas = [
    entregas.dca ? `DCA ${entregas.dca.exercicio}` : null,
    entregas.rgf ? `RGF ${entregas.rgf.exercicio}/${entregas.rgf.periodo}` : null,
    entregas.rreo ? `RREO ${entregas.rreo.exercicio}/${entregas.rreo.periodo}` : null,
  ].filter((item): item is string => Boolean(item));

  if (resumoEntregas.length > 0 && anoReferencia < exercicio) {
    observacoes.push(`Base fiscal oficial mais recente no SICONFI: ${resumoEntregas.join(", ")}.`);
  } else if (entregas.rgf && entregas.rgf.periodo > 0) {
    observacoes.push(`Leitura LRF baseada no periodo ${entregas.rgf.periodo} do exercicio ${entregas.rgf.exercicio}.`);
  }

  const record: SiconfiFiscalRecord = {
    codigoIBGE: digits,
    anoReferencia: anoReferencia || exercicio,
    instituicao,
    uf,
    populacao,
    disponivel: Boolean(dcaItems.length || rgfItems.length || rreoItems.length),
    situacaoLrf,
    rcl,
    rclAjustada,
    despesaPessoalTotal,
    percentualDespesaPessoal,
    limiteMaximoPessoal,
    limitePrudencialPessoal,
    limiteAlertaPessoal,
    espacoFiscalPessoal:
      limiteMaximoPessoal !== null && percentualDespesaPessoal !== null
        ? limiteMaximoPessoal - percentualDespesaPessoal
        : null,
    receitaTotalPrevista,
    receitaTotalRealizada,
    receitasCorrentesRealizadas,
    caixaEquivalentes,
    dividaAtivaTributaria,
    passivoCirculante,
    passivoNaoCirculante,
    patrimonioLiquido,
    resultadoExercicio,
    entregas,
    fontes: buildFontes(entregas),
    observacoes,
  };

  fiscalCache.set(cacheKey, {
    loadedAt: Date.now(),
    data: record,
  });

  return record;
}
