import {
  formatDateTime,
  hydrateRelatorioFundeb,
  normalizarIBGE,
} from "@/modules/levantamento-fundeb/utils/calculos";
import type { FundebRelatorioParametros, RelatorioFundeb } from "@/modules/levantamento-fundeb/types";
import {
  getFundebReceitasOficiais,
  getFundebVaatContext,
  type FndeVaatContext,
} from "@/core/lib/fundeb-fnde";
import { getInepCensoMunicipalRecord, getInepCensoMunicipalHistory } from "@/core/lib/inep-censo";
import type { InepCensoMunicipalRecord } from "@/core/lib/inep-censo";
import { getIbgeCidadeIndicators } from "@/core/lib/ibge-cidade-indicators";
import { buildCensoEscolarFromInep, buildPerfilEProjecaoComercial } from "@/core/lib/fundeb-commercial";
import { estimateFundebReceitas } from "@/core/lib/fundeb-estimate";
import { getFndePublicEnrichment } from "@/core/lib/fnde-public";
import { buildFundebComparativeSnapshot } from "@/core/lib/fundeb-comparative";
import { getTsePrefeitoRecord } from "@/core/lib/tse-prefeitos";
import { getIdebMunicipalRecord, getIdebMetasNacionais, getIdebMunicipalHistorico } from "@/core/lib/ideb-municipal";
import { getQeduMunicipalIndicators } from "@/core/lib/qedu-indicators";
import { getQeduMunicipalApiSnapshot } from "@/core/lib/qedu-api";
import { getSiconfiFiscalRecord } from "@/core/lib/siconfi-fiscal";
import { getSimecObrasRecord } from "@/core/lib/simec-obras";
import { getValorAlunoAno } from "@/core/lib/fundeb-valor-aluno";
import { getEquidadeMunicipal } from "@/core/lib/inep-equidade";
import { getSituacaoVaar } from "@/core/lib/fundeb-vaar";
import { getPonderacaoMunicipal } from "@/core/lib/fundeb-ponderacao";
import { getConformidadeSiope } from "@/core/lib/siope-indicadores";

interface IbgeMunicipioResponse {
  id: number;
  nome: string;
  microrregiao?: {
    nome?: string;
    mesorregiao?: {
      nome?: string;
      UF?: {
        sigla?: string;
        nome?: string;
        regiao?: {
          nome?: string;
        };
      };
    };
  };
  ["regiao-imediata"]?: {
    ["regiao-intermediaria"]?: {
      nome?: string;
      UF?: {
        sigla?: string;
        nome?: string;
        regiao?: {
          nome?: string;
        };
      };
    };
  };
}

const MUNICIPIO_NOME_ALIASES: Record<string, string> = {
  "ALVORADA DO OESTE-RO": "Alvorada D'Oeste",
  "AMPARO DE SAO FRANCISCO-SE": "Amparo do São Francisco",
  "AREZ-RN": "Arês",
  "ASSU-RN": "Açu",
  "BARAO DE MONTE ALTO-MG": "Barão do Monte Alto",
  "BOA SAUDE-RN": "Januário Cicco",
  "DONA EUSEBIA-MG": "Dona Euzébia",
  "ELDORADO DOS CARAJAS-PA": "Eldorado do Carajás",
  "ESPIGAO DO OESTE-RO": "Espigão D'Oeste",
  "SANTA ISABEL DO PARA-PA": "Santa Izabel do Pará",
  "SANTO ANTONIO DO LEVERGER-MT": "Santo Antônio de Leverger",
  "SAO LUIS DO PARAITINGA-SP": "São Luiz do Paraitinga",
  "SAO THOME DAS LETRAS-MG": "São Tomé das Letras",
};

function normalizeMunicipioName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['`´\-.,/]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function getMunicipioUf(municipio: IbgeMunicipioResponse) {
  return (
    municipio.microrregiao?.mesorregiao?.UF?.sigla ??
    municipio["regiao-imediata"]?.["regiao-intermediaria"]?.UF?.sigla ??
    ""
  );
}

function getMunicipioRegiao(municipio: IbgeMunicipioResponse) {
  return (
    municipio.microrregiao?.mesorregiao?.UF?.regiao?.nome ??
    municipio["regiao-imediata"]?.["regiao-intermediaria"]?.UF?.regiao?.nome ??
    "Nao informado"
  );
}

function resolveMunicipioAlias(nome: string, uf?: string) {
  if (!uf) {
    return nome;
  }
  const key = `${normalizeMunicipioName(nome)}-${uf.trim().toUpperCase()}`;
  return MUNICIPIO_NOME_ALIASES[key] ?? nome;
}

interface GoviaMunicipioSuggestion {
  codigo_ibge: string;
  nome: string;
  uf: string;
  regiao: string;
  regiaoIntermediaria?: string;
}

interface GoviaBuscarMunicipioParams {
  codigo_ibge?: string;
  nome?: string;
  uf?: string;
  exercicio?: number;
  parametros?: FundebRelatorioParametros;
}

interface GoviaOpportunity {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string;
  valor_estimado: number;
  prazo_execucao: string;
  complexidade: string;
  escolas_relacionadas: string[];
  documentos_necessarios: string[];
  status: string;
  gatilho: string;
  prioridade?: string;
  score_prioridade?: number;
  estimativa_sucesso?: number;
  subtipo?: string;
  justificativa?: string;
  fonte_recurso?: string;
  programa_adequado?: string;
  prioridade_numerica?: number;
  fontes_dados?: string[];
  acao_imediata?: string;
}



let municipiosCache: IbgeMunicipioResponse[] | null = null;
let municipiosCacheTime = 0;

function sanitizeFundebParametros(value: unknown): FundebRelatorioParametros | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const result: FundebRelatorioParametros = {};
  for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
    const cleanKey = key.trim();
    if (!cleanKey || rawValue === undefined) {
      continue;
    }

    if (
      rawValue === null ||
      typeof rawValue === "string" ||
      typeof rawValue === "number" ||
      typeof rawValue === "boolean"
    ) {
      result[cleanKey] = typeof rawValue === "string" ? rawValue.trim() : rawValue;
      continue;
    }

    if (cleanKey === "camposAdicionais" && rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)) {
      result.camposAdicionais = Object.fromEntries(
        Object.entries(rawValue as Record<string, unknown>)
          .filter(([, item]) => item === null || ["string", "number", "boolean"].includes(typeof item))
          .map(([itemKey, item]) => [itemKey.trim(), typeof item === "string" ? item.trim() : item])
          .filter(([itemKey]) => itemKey),
      ) as Record<string, string | number | boolean | null>;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

async function fetchAllIbgeMunicipios(): Promise<IbgeMunicipioResponse[]> {
  const now = Date.now();
  if (municipiosCache && now - municipiosCacheTime < 1000 * 60 * 60 * 12) {
    return municipiosCache;
  }

  const response = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Nao foi possivel consultar a base do IBGE.");
  }

  municipiosCache = (await response.json()) as IbgeMunicipioResponse[];
  municipiosCacheTime = now;
  return municipiosCache;
}

export async function searchGoviaMunicipios(query: string, uf?: string): Promise<GoviaMunicipioSuggestion[]> {
  const normalizedQuery = normalizeMunicipioName(query);
  if (normalizedQuery.length < 2) {
    return [];
  }

  const municipios = await fetchAllIbgeMunicipios();
  const normalizedUf = uf?.trim().toUpperCase();
  const aliasQuery = normalizeMunicipioName(resolveMunicipioAlias(query, normalizedUf));
  const candidateQueries = new Set([normalizedQuery, aliasQuery]);

  return municipios
    .filter((municipio) => {
      const municipioUf = getMunicipioUf(municipio).toUpperCase();
      const municipioNome = normalizeMunicipioName(municipio.nome);
      return (
        Array.from(candidateQueries).some((candidate) => municipioNome.includes(candidate)) &&
        (!normalizedUf || municipioUf === normalizedUf)
      );
    })
    .slice(0, 20)
    .map((municipio) => ({
      codigo_ibge: String(municipio.id),
      nome: municipio.nome,
      uf: getMunicipioUf(municipio),
      regiao: getMunicipioRegiao(municipio),
    }));
}

interface GoviaMunicipioRegionalParams {
  uf: string;
  excludeCodigoIbge?: string;
  regiaoIntermediaria?: string;
  microrregiao?: string;
  mesorregiao?: string;
}

export async function listGoviaMunicipiosByRegionalContext(params: GoviaMunicipioRegionalParams): Promise<GoviaMunicipioSuggestion[]> {
  const municipios = await fetchAllIbgeMunicipios();
  const targetUf = params.uf.trim().toUpperCase();
  const excludeCode = params.excludeCodigoIbge?.replace(/\D/g, "") ?? "";

  return municipios
    .filter((municipio) => {
      const uf = getMunicipioUf(municipio).toUpperCase();
      if (uf !== targetUf) return false;
      if (String(municipio.id) === excludeCode) return false;

      // Prefer same intermediate region if available
      if (params.regiaoIntermediaria && params.regiaoIntermediaria !== "Não informado") {
        const regiaoInt = municipio["regiao-imediata"]?.["regiao-intermediaria"]?.nome ?? "";
        if (regiaoInt === params.regiaoIntermediaria) return true;
      }

      // Fallback to same mesorregion
      if (params.mesorregiao && params.mesorregiao !== "Não informado") {
        const meso = municipio.microrregiao?.mesorregiao?.nome ?? "";
        if (meso === params.mesorregiao) return true;
      }

      // Same state is already a valid match
      return true;
    })
    .slice(0, 20)
    .map((municipio) => ({
      codigo_ibge: String(municipio.id),
      nome: municipio.nome,
      uf: getMunicipioUf(municipio),
      regiao: getMunicipioRegiao(municipio),
      regiaoIntermediaria: municipio["regiao-imediata"]?.["regiao-intermediaria"]?.nome ?? "Não informado",
    }));
}

export async function findGoviaMunicipio(params: GoviaBuscarMunicipioParams): Promise<IbgeMunicipioResponse | null> {
  if (params.codigo_ibge) {
    const digits = params.codigo_ibge.replace(/\D/g, "");

    if (digits.length === 7) {
      const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${digits}`, {
        next: { revalidate: 60 * 60 * 12 },
      });

      if (response.ok) {
        // Código inexistente devolve HTTP 200 com `[]`, não 404. Um array vazio
        // é truthy: sem esta checagem ele viraria um "município" de id
        // undefined e o relatório sairia intitulado "undefined - UF".
        const dados = (await response.json().catch(() => null)) as unknown;
        if (dados && !Array.isArray(dados) && typeof (dados as IbgeMunicipioResponse).id === "number") {
          return dados as IbgeMunicipioResponse;
        }
      }

      // 7 dígitos que não existem são erro de digitação, não código curto. Cair
      // no prefixo aqui faria "2703209" virar Igreja Nova (2703205) — relatório
      // da cidade errada, que é pior do que nenhum relatório.
      return null;
    }

    // Só chega aqui com 6 dígitos (código sem o verificador), onde casar por
    // prefixo é o comportamento correto.
    const normalized = normalizarIBGE(digits);
    const municipios = await fetchAllIbgeMunicipios();
    return municipios.find((municipio) => String(municipio.id).startsWith(normalized)) ?? null;
  }

  if (params.nome && params.uf) {
    const municipios = await fetchAllIbgeMunicipios();
    const targetUf = params.uf.trim().toUpperCase();
    const resolvedNome = resolveMunicipioAlias(params.nome, targetUf);
    const nomeCandidates = new Set([
      normalizeMunicipioName(params.nome),
      normalizeMunicipioName(resolvedNome),
    ]);
    return (
      municipios.find((municipio) => {
        const municipioUf = getMunicipioUf(municipio).toUpperCase();
        return municipioUf === targetUf && nomeCandidates.has(normalizeMunicipioName(municipio.nome));
      }) ?? null
    );
  }

  return null;
}

function buildRelatorioBase(
  municipio: IbgeMunicipioResponse,
  exercicio: number,
  receitasOficiais?: {
    receitaContribuicaoMunicipal: number;
    complementacaoVAAF: number;
    complementacaoVAAT: number;
    complementacaoVAAR: number;
    totalReceitas: number;
    fonte: string;
  } | null,
  extras?: Partial<RelatorioFundeb>,
): RelatorioFundeb {
  const uf = getMunicipioUf(municipio) || "UF";
  const tseRecord = getTsePrefeitoRecord(String(municipio.id));

  return hydrateRelatorioFundeb({
    identificacao: {
      municipio: `${municipio.nome} - ${uf}`,
      municipioNome: municipio.nome,
      uf,
      codigoIBGE: String(municipio.id),
      prefeito: tseRecord?.nomeCompleto ?? tseRecord?.prefeito ?? "Não informado",
      partido: tseRecord?.partido ?? "Não informado",
      exercicio,
      fonte: receitasOficiais?.fonte ?? `Sync Next API / Portaria FUNDEB ${exercicio}`,
      mesorregiao: municipio.microrregiao?.mesorregiao?.nome ?? "Não informado",
      microrregiao: municipio.microrregiao?.nome ?? "Não informado",
      regiaoIntermediaria: municipio["regiao-imediata"]?.["regiao-intermediaria"]?.nome ?? "Não informado",
      regiao: getMunicipioRegiao(municipio),
    },
    receitas: receitasOficiais
      ? {
          receitaContribuicaoMunicipal: receitasOficiais.receitaContribuicaoMunicipal,
          complementacaoVAAF: receitasOficiais.complementacaoVAAF,
          complementacaoVAAT: receitasOficiais.complementacaoVAAT,
          complementacaoVAAR: receitasOficiais.complementacaoVAAR,
          totalReceitas: receitasOficiais.totalReceitas,
        }
      : undefined,
    ...extras,
  });
}

function buildGoviaOportunidades(relatorio: RelatorioFundeb) {
  const projection = relatorio.projecaoComercial ?? relatorio.projecaoRecuperavel ?? relatorio.projecao;
  const opportunities: GoviaOpportunity[] = [
    {
      id: "fundeb-total",
      tipo: "PROGRAM",
      titulo: "Reestruturação técnica do FUNDEB",
      descricao: "Levantamento inicial para saneamento de indicadores, bases e sistemas que impactam a composição do FUNDEB.",
      valor_estimado: projection.totalGanho,
      prazo_execucao: "3-6 meses",
      complexidade: "média",
      escolas_relacionadas: [],
      documentos_necessarios: [
        "Extratos FUNDEB do exercicio",
        "Base do Censo Escolar",
        "Validacoes MEC/FNDE",
      ],
      status: "identificada",
      gatilho: "projecao_total_fundeb",
      prioridade: projection.totalGanho > 0 ? "ALTA" : "MEDIA",
      score_prioridade: projection.ganhoPercentual > 25 ? 88 : 62,
      estimativa_sucesso: projection.totalGanho > 0 ? 74 : 45,
      subtipo: "FUNDEB",
      justificativa: "Potencial estimado a partir das fórmulas validadas no documento técnico.",
      fonte_recurso: "FUNDEB",
      programa_adequado: "Otimização de VAAF, VAAT e VAAR",
      prioridade_numerica: projection.totalGanho > 0 ? 8 : 5,
      fontes_dados: ["IBGE", "Modelo de cálculo FUNDEB Sync"],
      acao_imediata: "Validar receitas atuais e iniciar conferência de sistemas MEC/FNDE.",
    },
  ];

  if (projection.vaafGanho > 0) {
    opportunities.push({
      id: "fundeb-vaaf",
      tipo: "VAAF",
      titulo: "Otimizacao da fatia VAAF",
      descricao: "Ajuste tecnico da composicao VAAF com base nas regras do Novo FUNDEB.",
      valor_estimado: projection.vaafGanho,
      prazo_execucao: "2-4 meses",
      complexidade: "media",
      escolas_relacionadas: [],
      documentos_necessarios: ["SIOPE", "Censo Escolar", "Demonstrativos FUNDEB"],
      status: "identificada",
      gatilho: "ganho_vaaf",
    });
  }

  if (projection.vaatGanho > 0) {
    opportunities.push({
      id: "fundeb-vaat",
      tipo: "VAAT",
      titulo: "Revisao da complementacao VAAT",
      descricao: "Conferência de indicadores de educação infantil e despesa para ganho potencial em VAAT.",
      valor_estimado: projection.vaatGanho,
      prazo_execucao: "2-4 meses",
      complexidade: "alta",
      escolas_relacionadas: [],
      documentos_necessarios: ["Despesa educacional consolidada", "Censo Escolar", "Base FNDE"],
      status: "identificada",
      gatilho: "ganho_vaat",
    });
  }

  if (projection.vaarGanho > 0) {
    opportunities.push({
      id: "fundeb-vaar",
      tipo: "VAAR",
      titulo: "Revisao da complementacao VAAR",
      descricao: "Mapeamento de condicionalidades e aderencia a indicadores de resultado.",
      valor_estimado: projection.vaarGanho,
      prazo_execucao: "4-8 meses",
      complexidade: "alta",
      escolas_relacionadas: [],
      documentos_necessarios: ["Indicadores de resultado", "Bases INEP", "Validacoes MEC"],
      status: "identificada",
      gatilho: "ganho_vaar",
    });
  }

  return opportunities;
}

function buildAnaliseExecutiva(relatorio: RelatorioFundeb) {
  const projection = relatorio.projecaoComercial ?? relatorio.projecaoRecuperavel ?? relatorio.projecao;
  const recuperavel = relatorio.projecaoRecuperavel ?? relatorio.projecao;
  const municipality = relatorio.identificacao.municipio;
  const current = projection.totalAtual;
  const projected = projection.totalProjetado;
  const gain = projection.totalGanho;
  const complement = projection.possuiComplementacao ? "com complementacao da Uniao" : "sem complementacao declarada da Uniao";
  const recuperavelText =
    relatorio.projecaoComercial && recuperavel.totalGanho > 0
      ? ` A camada recuperável já evidenciada nas bases atuais soma ${recuperavel.totalGanho.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })}, dependente de validacao documental, regularizacao sistêmica e eventual recálculo oficial.`
      : "";

  return `O município de ${municipality} foi carregado automaticamente a partir do IBGE e apresenta um cenário inicial ${complement}. A linha de base considerada soma ${current.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })}, com projeção técnica de ${projected.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })}. O ganho potencial estimado nesta fase e de ${gain.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })}, com base na metodologia comercial histórica do levantamento Rocha Prime e sujeito à validação documental das bases do FUNDEB e dos sistemas MEC/FNDE.${recuperavelText}`;
}

function buildScoreViabilidade(relatorio: RelatorioFundeb) {
  const projection = relatorio.projecaoComercial ?? relatorio.projecaoRecuperavel ?? relatorio.projecao;
  const base = projection.ganhoPercentual > 0 ? 55 : 35;
  const complementBonus = projection.possuiComplementacao ? 10 : 0;
  const gainBonus = Math.min(25, Math.round(projection.ganhoPercentual / 4));
  return Math.max(10, Math.min(96, base + complementBonus + gainBonus));
}

function buildInfraestruturaEscolarPayload(inepRecord: ReturnType<typeof getInepCensoMunicipalRecord>) {
  return {
    total_escolas_publicas_avaliadas: inepRecord?.escolasInfraPublicasTotal ?? 0,
    escolas_com_agua_potavel: inepRecord?.escolasComAguaPotavel ?? 0,
    escolas_com_agua_potavel_pct: inepRecord?.escolasComAguaPotavelPct ?? 0,
    escolas_sem_agua: inepRecord?.escolasSemAgua ?? 0,
    escolas_sem_agua_pct: inepRecord?.escolasSemAguaPct ?? 0,
    escolas_com_esgoto_rede_publica: inepRecord?.escolasComEsgoto ?? 0,
    escolas_com_esgoto_rede_publica_pct: inepRecord?.escolasComEsgotoPct ?? 0,
    escolas_sem_esgoto: inepRecord?.escolasSemEsgoto ?? 0,
    escolas_sem_esgoto_pct: inepRecord?.escolasSemEsgotoPct ?? 0,
    escolas_com_cozinha: inepRecord?.escolasComCozinha ?? 0,
    escolas_com_cozinha_pct: inepRecord?.escolasComCozinhaPct ?? 0,
    escolas_sem_cozinha: inepRecord?.escolasSemCozinha ?? 0,
    escolas_sem_cozinha_pct: inepRecord?.escolasSemCozinhaPct ?? 0,
    escolas_com_internet: inepRecord?.escolasComInternet ?? 0,
    escolas_com_internet_pct: inepRecord?.escolasComInternetPct ?? 0,
    escolas_com_banda_larga: inepRecord?.escolasComBandaLarga ?? 0,
    escolas_com_banda_larga_pct: inepRecord?.escolasComBandaLargaPct ?? 0,
    escolas_com_lab_informatica: inepRecord?.escolasComLaboratorioInformatica ?? 0,
    escolas_com_lab_informatica_pct: inepRecord?.escolasComLaboratorioInformaticaPct ?? 0,
    escolas_com_lab_ciencias: inepRecord?.escolasComLaboratorioCiencias ?? 0,
    escolas_com_lab_ciencias_pct: inepRecord?.escolasComLaboratorioCienciasPct ?? 0,
    escolas_com_quadra: inepRecord?.escolasComQuadra ?? 0,
    escolas_com_quadra_pct: inepRecord?.escolasComQuadraPct ?? 0,
    escolas_com_alimentacao: inepRecord?.escolasComAlimentacao ?? 0,
    escolas_com_alimentacao_pct: inepRecord?.escolasComAlimentacaoPct ?? 0,
    escolas_com_acessibilidade: inepRecord?.escolasComAcessibilidade ?? 0,
    escolas_com_acessibilidade_pct: inepRecord?.escolasComAcessibilidadePct ?? 0,
    escolas_sem_acessibilidade: inepRecord?.escolasSemAcessibilidade ?? 0,
    escolas_sem_acessibilidade_pct: inepRecord?.escolasSemAcessibilidadePct ?? 0,
  };
}

function buildAprendizagemPayload(qeduIndicators: Awaited<ReturnType<typeof getQeduMunicipalIndicators>>) {
  return {
    disponivel: Boolean(qeduIndicators),
    ano_referencia: qeduIndicators?.anoReferencia ?? null,
    recorte_rede: qeduIndicators?.recorteRede ?? "Nao informado",
    fonte: qeduIndicators?.fonte ?? "Nao informado",
    fonte_distorcao: qeduIndicators?.fonteDistorcao ?? "Nao informado",
    anos_iniciais: qeduIndicators?.anosIniciais ?? null,
    anos_finais: qeduIndicators?.anosFinais ?? null,
    distorcao_idade_serie: qeduIndicators?.distorcaoIdadeSerie ?? null,
  };
}

function uniqueOperationalNotes(items: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];
  const lowValuePatterns = [
    /^PDDE Info localizou \d+ escola\(s\)/i,
    /^PDDE \d{4}: valor pago total consolidado automaticamente/i,
    /^SIGARPWEB identificou a entidade interessada /i,
    /^SIGARPWEB localizou tambem /i,
    /^SIGARPWEB nao retornou solicitacoes publicas de Caminho da Escola/i,
  ];

  for (const item of items) {
    const normalized = item?.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    if (lowValuePatterns.some((pattern) => pattern.test(normalized))) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

/**
 * Build a complete relatorio_dirigido_base from existing data sources.
 * This feeds the Flutter Parte IV (annual comparison) and executive summary.
 */
function buildRelatorioDirigidoBase({
  relatorio,
  comparativo,
  censoHistory,
  ibgeIndicators,
  qeduIndicators,
  inepRecord,
  siconfiFiscal,
  vaatContext,
}: {
  relatorio: RelatorioFundeb;
  comparativo: Awaited<ReturnType<typeof buildFundebComparativeSnapshot>>;
  censoHistory: InepCensoMunicipalRecord[];
  ibgeIndicators: Awaited<ReturnType<typeof getIbgeCidadeIndicators>> | null;
  qeduIndicators: Awaited<ReturnType<typeof getQeduMunicipalIndicators>> | null;
  inepRecord: InepCensoMunicipalRecord | null;
  siconfiFiscal: Awaited<ReturnType<typeof getSiconfiFiscalRecord>> | null;
  vaatContext: FndeVaatContext | null;
}) {
  const ident = relatorio.identificacao;
  const exercicio = ident.exercicio;
  const tseRecord = getTsePrefeitoRecord(ident.codigoIBGE);
  const isPlaceholderText = (value: string | null | undefined) => {
    const normalized = (value ?? "").trim().toLowerCase();
    if (!normalized) return true;
    return (
      normalized === "undefined" ||
      normalized === "null" ||
      normalized === "nan" ||
      normalized === "-" ||
      normalized === "uf" ||
      normalized === "undefined/uf" ||
      normalized === "undefined - uf" ||
      normalized === "null/uf" ||
      normalized === "null - uf" ||
      normalized.includes("undefined") && normalized.includes("uf") ||
      normalized.includes("null") && normalized.includes("uf")
    );
  };
  const cleanDisplayText = (value: string | null | undefined, fallback = "") => {
    if (isPlaceholderText(value)) return fallback;
    return (value ?? "").trim();
  };
  const municipioNome = cleanDisplayText(ident.municipioNome);
  const municipioCompleto = cleanDisplayText(ident.municipio);
  const uf = cleanDisplayText(ident.uf, "UF");
  const municipioLabel = municipioNome || municipioCompleto || "Município";
  const municipioResumo =
    municipioLabel.toUpperCase().includes(`/${uf.toUpperCase()}`) ||
    municipioLabel.toUpperCase().includes(` - ${uf.toUpperCase()}`)
      ? municipioLabel
      : `${municipioLabel}/${uf}`;

  // Build census data lookup by year
  const censoByYear = new Map<number, InepCensoMunicipalRecord>();
  for (const record of censoHistory) {
    censoByYear.set(record.anoReferencia, record);
  }

  // Helper: calculate tempo integral — REDE MUNICIPAL apenas
  function getTempoIntegralFromRecord(record: InepCensoMunicipalRecord | undefined | null): number | null {
    if (!record) return null;
    if (record.tempoIntegralBasicaMunicipal != null) return record.tempoIntegralBasicaMunicipal;
    if (record.tempoIntegralBasicaPublica != null) return record.tempoIntegralBasicaPublica;
    // Sum subtypes as fallback (prefer Municipal)
    const sum =
      (record.tempoIntegralEducacaoInfantilMunicipal ?? record.tempoIntegralEducacaoInfantilPublica ?? record.tempoIntegralEducacaoInfantilTotal ?? 0) +
      (record.tempoIntegralEnsinoFundamentalMunicipal ?? record.tempoIntegralEnsinoFundamentalPublica ?? record.tempoIntegralEnsinoFundamentalTotal ?? 0) +
      (record.tempoIntegralEnsinoMedioMunicipal ?? 0) +
      (record.tempoIntegralEjaMunicipal ?? record.tempoIntegralEjaPublica ?? record.tempoIntegralEjaTotal ?? 0) +
      (record.tempoIntegralEducacaoEspecialMunicipal ?? record.tempoIntegralEducacaoEspecialPublica ?? record.tempoIntegralEducacaoEspecialTotal ?? 0);
    return sum > 0 ? sum : null;
  }

  // Helper: get matrículas municipais SEM ensino médio
  function getMatriculasMunicipaisSemEM(record: InepCensoMunicipalRecord | undefined | null): number | null {
    if (!record) return null;
    const total = record.matriculasMunicipaisTotal ?? null;
    if (total == null) return null;
    const em = record.ensinoMedioMunicipal ?? 0;
    return total - em;
  }

  // Build historical years from receitas + censo
  const anos = comparativo.receitasHistoricas.map((receita) => {
    const censoRecord = censoByYear.get(receita.ano);
    const matriculasMunicipais = getMatriculasMunicipaisSemEM(censoRecord);

    // Validate revenue decomposition: components must sum ≈ total.
    // If the breakdown is inconsistent (swapped columns, DCA fallback issues, etc.),
    // null-out the components to avoid displaying wrong values in the PDF.
    const total = receita.totalReceitas ?? 0;
    const contrib = receita.receitaContribuicaoMunicipal ?? 0;
    const vaaf = receita.complementacaoVAAF ?? 0;
    const vaat = receita.complementacaoVAAT ?? 0;
    const vaar = receita.complementacaoVAAR ?? 0;
    const componentsSum = contrib + vaaf + vaat + vaar;
    const decompositionValid =
      total > 0 &&
      componentsSum > 0 &&
      // Components sum within 5% of total
      Math.abs(componentsSum - total) / total < 0.05 &&
      // No single component exceeds total
      contrib <= total &&
      vaaf <= total &&
      vaat <= total &&
      vaar <= total &&
      // Complement total should not exceed total revenue
      (vaaf + vaat + vaar) <= total;

    return {
      ano: receita.ano,
      anoBaseCenso: censoRecord?.anoReferencia ?? null,
      totalReceitasFundeb: receita.totalReceitas,
      contribuicaoMunicipal: decompositionValid ? contrib : null,
      complementacaoVAAF: decompositionValid ? vaaf : null,
      complementacaoVAAT: decompositionValid ? vaat : null,
      complementacaoVAAR: decompositionValid ? vaar : null,
      totalMatriculasMunicipais: matriculasMunicipais,
      totalEscolas: censoRecord?.escolasMunicipaisTotal ?? null,
      tempoIntegral: getTempoIntegralFromRecord(censoRecord),
      educacaoEspecial: censoRecord?.educacaoEspecialMunicipal ?? censoRecord?.educacaoEspecialTotal ?? null,
      eja: censoRecord?.ejaMunicipal ?? censoRecord?.ejaTotal ?? null,
      fonteReceita: receita.fonte ?? (receita.ano === exercicio ? "Portaria FNDE" : "Histórico FNDE"),
      recursoPorAluno: (matriculasMunicipais && receita.totalReceitas)
        ? Math.round(receita.totalReceitas / matriculasMunicipais * 100) / 100
        : null,
    };
  });

  // Add census-only years not covered by receitas
  const receitaYears = new Set(comparativo.receitasHistoricas.map((r) => r.ano));
  for (const record of censoHistory) {
    if (!receitaYears.has(record.anoReferencia)) {
      const matriculasMunicipais = getMatriculasMunicipaisSemEM(record);
      anos.push({
        ano: record.anoReferencia,
        anoBaseCenso: record.anoReferencia,
        totalReceitasFundeb: null as unknown as number,
        contribuicaoMunicipal: null as unknown as number,
        complementacaoVAAF: null as unknown as number,
        complementacaoVAAT: null as unknown as number,
        complementacaoVAAR: null as unknown as number,
        totalMatriculasMunicipais: matriculasMunicipais,
        totalEscolas: record.escolasMunicipaisTotal ?? null,
        tempoIntegral: getTempoIntegralFromRecord(record),
        educacaoEspecial: record.educacaoEspecialMunicipal ?? record.educacaoEspecialTotal ?? null,
        eja: record.ejaMunicipal ?? record.ejaTotal ?? null,
        fonteReceita: "Censo INEP",
        recursoPorAluno: null,
      });
    }
  }

  // Sort by year
  anos.sort((a, b) => a.ano - b.ano);

  const firstYear = anos.at(0)?.ano ?? exercicio;
  const lastYear = anos.at(-1)?.ano ?? exercicio;
  const resumoHistorico = anos.length > 1
    ? `Serie historica com ${anos.length} exercicios (${firstYear}-${lastYear}) via SICONFI/Tesouro. Base escolar enriquecida com Censo INEP.`
    : anos.length === 1
      ? `Exercicio ${firstYear} disponivel no SICONFI.`
      : `Nenhum exercicio historico disponivel.`;

  return {
    municipio: municipioCompleto || municipioNome || "Município",
    uf,
    codigoIbge: ident.codigoIBGE,
    geradoEm: new Date().toISOString(),
    modo: "autonomo_completo",
    modeloPrincipal: "sync_next_govia",
    resumoExecutivo: `Levantamento FUNDEB completo para ${municipioResumo}, exercicio ${exercicio}. ` +
      `${anos.length} exercicio(s) na serie historica.`,
    searchQueries: [],
    itens: [],
    pendenciasHumanas: [
      "Validar receitas atuais do FUNDEB",
      "Levantar status dos sistemas MEC/FNDE",
      "Conferir bases do Censo Escolar e indicadores da rede municipal",
    ],
    alertasJuridicos: [
      "Os valores projetados têm caráter estimativo e dependem de validação documental.",
    ],
    proximosPassos: [
      "Validar receitas atuais do FUNDEB",
      "Levantar status dos sistemas MEC/FNDE",
      "Conferir bases do Censo Escolar e indicadores da rede municipal",
    ],
    prontidao: {
      status: "completo",
      score: 85,
      resumo: `Dados financeiros e educacionais consolidados para ${municipioLabel}.`,
      bloqueios: [],
      avisos: [],
      criterios: [
        "Receitas FUNDEB validadas",
        "Projecao Rocha Prime aplicada",
        "Geografia IBGE confirmada",
        "Censo Escolar INEP integrado",
      ],
    },
    perfilMunicipio: {
      populacao: ibgeIndicators?.populacaoEstimada ?? null,
      populacaoAnoReferencia: ibgeIndicators?.populacaoAnoReferencia ?? null,
    },
    contextoPolitico: {
      prefeitoAtual: tseRecord?.prefeito ?? ident.prefeito ?? "Consultar TSE/DivulgaCand",
      partidoAtual: tseRecord?.partido ?? ident.partido ?? "-",
      classificacaoMandato: tseRecord ? "primeiro mandato" : "Nao classificado",
      detalheMandato: tseRecord
        ? `${tseRecord.prefeito} (${tseRecord.partido}), mandato 2025-2028.`
        : "Mandato 2025-2028.",
      estrategiaComercial: "Abordagem direta com secretaria de educacao.",
      resumoComparativoGestao: comparativo.comparativaPdfInput.texto_sintese ?? "",
    },
    historico: {
      anos,
      resumo: resumoHistorico,
    },
    benchmarkRegional: {
      criterio: "Mesma mesorregiao e faixa populacional",
      resumo: "Benchmark regional em construcao.",
      municipios: [],
    },
    indicadoresAprendizagem: qeduIndicators ? {
      disponivel: true,
      anoReferencia: qeduIndicators.anoReferencia,
      recorteRede: qeduIndicators.recorteRede,
      fonte: qeduIndicators.fonte,
      fonteDistorcao: qeduIndicators.fonteDistorcao,
      anosIniciais: qeduIndicators.anosIniciais ? {
        idebObservado: qeduIndicators.anosIniciais.idebObservado,
        notaPortugues: qeduIndicators.anosIniciais.notaPortugues,
        notaMatematica: qeduIndicators.anosIniciais.notaMatematica,
        notaMedia: qeduIndicators.anosIniciais.notaMedia,
        taxaAprovacao: qeduIndicators.anosIniciais.taxaAprovacao,
        indicadorRendimento: qeduIndicators.anosIniciais.indicadorRendimento,
      } : null,
      anosFinais: qeduIndicators.anosFinais ? {
        idebObservado: qeduIndicators.anosFinais.idebObservado,
        notaPortugues: qeduIndicators.anosFinais.notaPortugues,
        notaMatematica: qeduIndicators.anosFinais.notaMatematica,
        notaMedia: qeduIndicators.anosFinais.notaMedia,
        taxaAprovacao: qeduIndicators.anosFinais.taxaAprovacao,
        indicadorRendimento: qeduIndicators.anosFinais.indicadorRendimento,
      } : null,
      distorcaoIdadeSerie: qeduIndicators.distorcaoIdadeSerie,
    } : {
      disponivel: false,
      anoReferencia: null,
      recorteRede: null,
      fonte: null,
      fonteDistorcao: null,
      anosIniciais: null,
      anosFinais: null,
      distorcaoIdadeSerie: null,
    },
    infraestruturaEscolar: inepRecord ? {
      disponivel: true,
      anoReferencia: inepRecord.anoReferencia,
      totalEscolasPublicas: inepRecord.escolasPublicasTotal ?? inepRecord.escolasMunicipaisTotal,
      indicadores: [
        { nome: "Água potável", percentual: inepRecord.escolasComAguaPotavelPct ?? null, total: inepRecord.escolasComAguaPotavel ?? null },
        { nome: "Esgoto sanitário", percentual: inepRecord.escolasComEsgotoPct ?? null, total: inepRecord.escolasComEsgoto ?? null },
        { nome: "Cozinha/refeitório", percentual: inepRecord.escolasComCozinhaPct ?? null, total: inepRecord.escolasComCozinha ?? null },
        { nome: "Internet", percentual: inepRecord.escolasComInternetPct ?? null, total: inepRecord.escolasComInternet ?? null },
        { nome: "Banda larga", percentual: inepRecord.escolasComBandaLargaPct ?? null, total: inepRecord.escolasComBandaLarga ?? null },
        { nome: "Lab. informática", percentual: inepRecord.escolasComLaboratorioInformaticaPct ?? null, total: inepRecord.escolasComLaboratorioInformatica ?? null },
        { nome: "Lab. ciências", percentual: inepRecord.escolasComLaboratorioCienciasPct ?? null, total: inepRecord.escolasComLaboratorioCiencias ?? null },
        { nome: "Quadra esportiva", percentual: inepRecord.escolasComQuadraPct ?? null, total: inepRecord.escolasComQuadra ?? null },
        { nome: "Alimentação escolar", percentual: inepRecord.escolasComAlimentacaoPct ?? null, total: inepRecord.escolasComAlimentacao ?? null },
        { nome: "Acessibilidade", percentual: inepRecord.escolasComAcessibilidadePct ?? null, total: inepRecord.escolasComAcessibilidade ?? null },
      ],
    } : { disponivel: false, anoReferencia: null, totalEscolasPublicas: null, indicadores: [] },
    narrativas: {
      textoSintese: comparativo.comparativaPdfInput.texto_sintese ?? null,
      textoQedu: comparativo.comparativaPdfInput.texto_qedu ?? null,
      textoMovimentosRelevantes: comparativo.comparativaPdfInput.texto_movimentos_relevantes ?? null,
      textoComoRochaPrimeEntra: comparativo.comparativaPdfInput.texto_como_rocha_prime_entra ?? null,
      textoConclusao: comparativo.comparativaPdfInput.texto_conclusao ?? null,
    },
    saudeFiscal: siconfiFiscal ? {
      disponivel: true,
      anoReferencia: siconfiFiscal.anoReferencia,
      rcl: siconfiFiscal.rcl,
      rclAjustada: siconfiFiscal.rclAjustada,
      despesaPessoalTotal: siconfiFiscal.despesaPessoalTotal,
      percentualDespesaPessoal: siconfiFiscal.percentualDespesaPessoal,
      limiteMaximoPessoal: siconfiFiscal.limiteMaximoPessoal,
      limitePrudencialPessoal: siconfiFiscal.limitePrudencialPessoal,
      limiteAlertaPessoal: siconfiFiscal.limiteAlertaPessoal,
      espacoFiscalPessoal: siconfiFiscal.espacoFiscalPessoal,
      situacaoLrf: siconfiFiscal.situacaoLrf,
      receitaTotalRealizada: siconfiFiscal.receitaTotalRealizada,
      caixaEquivalentes: siconfiFiscal.caixaEquivalentes,
      patrimonioLiquido: siconfiFiscal.patrimonioLiquido,
    } : { disponivel: false },
    /**
     * Cor/raça e localização diferenciada da rede. Leitura local, sem rede —
     * ver `core/lib/inep-equidade.ts` para por que isto condiciona o FUNDEB.
     */
    equidade: getEquidadeMunicipal(ident.codigoIBGE),
    /**
     * Situação no VAAR. Também leitura local: o FNDE publica o status por
     * município num CSV que já baixamos para `data/fnde/vaar-2026.json`.
     */
    vaar: getSituacaoVaar(ident.codigoIBGE),
    /**
     * Matrícula ponderada — o denominador que a receita do fundo realmente
     * usa. Ver `core/lib/fundeb-ponderacao.ts`.
     */
    ponderacao: getPonderacaoMunicipal(ident.codigoIBGE),
    /**
     * Vinculações da educação como o SIOPE as apura — 25% MDE, 70%
     * remuneração, 15% capital do VAAT, IEI, teto de 10% não aplicado.
     * Ver `core/lib/siope-indicadores.ts`.
     */
    conformidade: getConformidadeSiope(ident.codigoIBGE),
    /**
     * Leitura prospectiva do VAAT.
     *
     * A complementação VAAT é equalização por insuficiência: a União completa
     * cada rede até o VAAT-MIN, então quem arrecada mais recebe menos, por
     * construção. Quando o VAAT próprio alcança o mínimo, a complementação
     * vai a zero — e o art. 15, II manda calcular sobre as receitas do
     * **penúltimo** exercício, o que torna a saída da faixa previsível com
     * dois anos de antecedência.
     */
    vaat: vaatContext
      ? (() => {
          const proprio = vaatContext.vaatAnterior;
          const minimo = vaatContext.vaatComComplementacao;
          const complementacao = vaatContext.complementacaoVAAT;
          return {
            exercicio,
            /** VAAT do município antes da complementação. */
            proprio,
            /** VAAT-MIN do exercício — o patamar que a União garante. */
            minimo,
            complementacao,
            /** Quanto falta para o VAAT próprio alcançar o mínimo, em %. */
            distanciaPercentual: minimo > 0 ? ((minimo - proprio) / minimo) * 100 : null,
            /**
             * Exercício cuja arrecadação define este VAAT (art. 15, II:
             * penúltimo exercício anterior).
             */
            exercicioBaseReceita: exercicio - 2,
            habilitacao: vaatContext.habilitacao,
            pendencia: vaatContext.pendencia,
            ieiPercentual: vaatContext.ieiPercentual,
          };
        })()
      : null,
    perfilIBGE: ibgeIndicators ? {
      disponivel: true,
      populacaoEstimada: ibgeIndicators.populacaoEstimada,
      populacaoAnoReferencia: ibgeIndicators.populacaoAnoReferencia,
      populacaoUltimoCenso: ibgeIndicators.populacaoUltimoCenso,
      pibPerCapita: ibgeIndicators.pibPerCapita,
      pibAnoReferencia: ibgeIndicators.pibAnoReferencia,
      areaTerritorial: ibgeIndicators.areaTerritorial,
      escolarizacao614: ibgeIndicators.escolarizacao614,
      receitasBrutasMunicipais: ibgeIndicators.receitasBrutasMunicipais,
    } : { disponivel: false },
    obrasPAC2: relatorio.obrasPAC2 ?? [],
    caminhoEscola: relatorio.caminhoEscola ?? [],
    cenarioEstruturacao: comparativo.comparativaPdfInput.cenarioEstruturacao ?? null,
    recursosPorAluno: (() => {
      const receita = relatorio.receitas.totalReceitas;
      const matMun = inepRecord?.matriculasMunicipaisTotal ?? 0;
      const em = inepRecord?.ensinoMedioMunicipal ?? 0;
      const alunosMun = matMun - em;
      if (alunosMun <= 0) return null;
      return {
        valor: Math.round(receita / alunosMun * 100) / 100,
        receitaBase: receita,
        totalAlunosMunicipais: alunosMun,
        anoReferencia: exercicio,
      };
    })(),
    valorAlunoOficial: (() => {
      const ufCode = ident.uf;
      if (!ufCode) return null;
      const vaaf = getValorAlunoAno(ufCode);
      if (!vaaf) return null;
      return {
        uf: ufCode,
        fundamentalAnosIniciais: vaaf.fundamentalParcialAnosIniciais,
        fundamentalAnosFinais: vaaf.fundamentalParcialAnosFinais,
        fundamentalIntegral: vaaf.fundamentalIntegral,
        crecheIntegralPublica: vaaf.crecheIntegralPublica,
        crecheParcialPublica: vaaf.crecheParcialPublica,
        preEscolaIntegralPublica: vaaf.preEscolaIntegralPublica,
        preEscolaParcialPublica: vaaf.preEscolaParcialPublica,
        eja: vaaf.eja,
        receitaEstadosMunicipios: vaaf.receitaEstadosMunicipios,
        complementacaoVAAF: vaaf.complementacaoVAAF,
        totalReceitasVAAF: vaaf.totalReceitasVAAF,
      };
    })(),
  };
}

export async function buildGoviaMunicipioCompleto(params: GoviaBuscarMunicipioParams) {
  const exercicio = params.exercicio && params.exercicio > 2000 ? params.exercicio : new Date().getFullYear();
  const parametros = sanitizeFundebParametros(params.parametros);
  const municipio = await findGoviaMunicipio(params);

  if (!municipio) {
    return null;
  }

  const municipioUf = getMunicipioUf(municipio) || "UF";

  let receitasOficiais: Awaited<ReturnType<typeof getFundebReceitasOficiais>> = null;
  try {
    receitasOficiais = await getFundebReceitasOficiais(String(municipio.id), exercicio);
  } catch (e) {
    console.warn(`[govia] FNDE receitas fetch failed for ${exercicio}:`, e instanceof Error ? e.message : e);
  }
  const [vaatContext, ibgeIndicators, inepRecord, fndePublic, qeduIndicators, siconfiFiscal, simecObras, qeduApiSnapshot] =
    await Promise.all([
    getFundebVaatContext(String(municipio.id), exercicio).catch(() => null),
    getIbgeCidadeIndicators(municipio.nome, municipioUf, String(municipio.id)).catch(() => null),
    Promise.resolve(getInepCensoMunicipalRecord(String(municipio.id))),
    getFndePublicEnrichment({
      municipio: municipio.nome,
      uf: municipioUf,
      exercicio,
    }).catch(() => null),
      getQeduMunicipalIndicators(String(municipio.id)).catch(() => null),
      getSiconfiFiscalRecord(String(municipio.id), exercicio).catch(() => null),
      getSimecObrasRecord(String(municipio.id)).catch(() => null),
      getQeduMunicipalApiSnapshot(String(municipio.id)).catch(() => null),
    ]);
  const receitasBase =
    receitasOficiais ??
    estimateFundebReceitas({
      codigoIBGE: String(municipio.id),
      municipio: municipio.nome,
      uf: municipioUf,
      exercicio,
      ibgeIndicators,
      inepRecord,
      vaatContext,
    });

  const censoEscolar = buildCensoEscolarFromInep(inepRecord);
  const comercial = buildPerfilEProjecaoComercial({
    receitas:
      receitasBase ?? {
        receitaContribuicaoMunicipal: 0,
        complementacaoVAAF: 0,
        complementacaoVAAT: 0,
        complementacaoVAAR: 0,
        totalReceitas: 0,
      },
    ibgeIndicators,
    inepRecord,
    vaatContext,
  });

  const idebRecord = getIdebMunicipalRecord(String(municipio.id));

  const relatorio = buildRelatorioBase(municipio, exercicio, receitasBase, {
    ...(parametros ? { parametros } : {}),
    censoEscolar,
    perfilComercial: comercial.perfil,
    projecaoComercial: comercial.projecao,
    sistemas: fndePublic?.sistemas,
    obrasPAC2: fndePublic?.obrasPAC2,
    situacaoPAR: fndePublic?.situacaoPAR,
    caminhoEscola: fndePublic?.caminhoEscola,
    pdde: fndePublic?.pdde,
    observacoesOperacionais: uniqueOperationalNotes([
      ...(fndePublic?.observacoes ?? []),
      ...(siconfiFiscal?.observacoes ?? []),
      ...(simecObras?.observacoes ?? []),
    ]),
    idebAnosIniciais: (() => {
      const apiHistory = qeduApiSnapshot?.historicoIdeb?.anosIniciais;
      const localHistorico = getIdebMunicipalHistorico(String(municipio.id));
      const localVerificado = qeduIndicators?.anosIniciais?.idebObservado ?? idebRecord?.anosIniciaisPublica ?? null;
      const localAnoRef = idebRecord?.anoReferencia ?? 2023;
      const metasNacionais = getIdebMetasNacionais();

      if (apiHistory?.length) {
        const latestApiVerificado = [...apiHistory]
          .filter((a) => a.idebVerificado != null)
          .sort((a, b) => b.ano - a.ano)[0];
        const effectiveLocal = localVerificado ?? latestApiVerificado?.idebVerificado ?? null;
        const effectiveAnoRef = localVerificado ? localAnoRef : (latestApiVerificado?.ano ?? localAnoRef);

        return metasNacionais.anosIniciais.map((entry) => {
          const apiEntry = apiHistory.find((a) => a.ano === entry.ano);
          return {
            ano: entry.ano,
            metaProjetada: apiEntry?.metaProjetada ?? entry.meta,
            // O INEP só projetou metas por rede até 2021; de lá para cá o que
            // existe é a referência nacional. Quem exibe precisa distinguir.
            metaOrigem: apiEntry?.metaProjetada != null ? ("municipal" as const) : ("nacional" as const),
            idebVerificado: apiEntry?.idebVerificado ?? (entry.ano === effectiveAnoRef ? effectiveLocal : null),
          };
        });
      }

      // Fallback: use local historical dataset (pre-cached from QEdu)
      if (localHistorico?.anosIniciais?.length) {
        return metasNacionais.anosIniciais.map((entry) => {
          const localEntry = localHistorico.anosIniciais.find((a) => a.ano === entry.ano);
          return {
            ano: entry.ano,
            metaProjetada: entry.meta,
            metaOrigem: "nacional" as const,
            idebVerificado: localEntry?.ideb ?? (entry.ano === localAnoRef ? localVerificado : null),
          };
        });
      }

      if (!localVerificado) return undefined;
      return metasNacionais.anosIniciais.map((entry) => ({
        ano: entry.ano,
        metaProjetada: entry.meta,
        metaOrigem: "nacional" as const,
        idebVerificado: entry.ano === localAnoRef ? localVerificado : null,
      }));
    })(),
    idebAnosFinais: (() => {
      const apiHistory = qeduApiSnapshot?.historicoIdeb?.anosFinais;
      const localHistorico = getIdebMunicipalHistorico(String(municipio.id));
      const localVerificado = qeduIndicators?.anosFinais?.idebObservado ?? idebRecord?.anosFinaisPublica ?? null;
      const localAnoRef = idebRecord?.anoReferencia ?? 2023;
      const metasNacionais = getIdebMetasNacionais();

      if (apiHistory?.length) {
        const latestApiVerificado = [...apiHistory]
          .filter((a) => a.idebVerificado != null)
          .sort((a, b) => b.ano - a.ano)[0];
        const effectiveLocal = localVerificado ?? latestApiVerificado?.idebVerificado ?? null;
        const effectiveAnoRef = localVerificado ? localAnoRef : (latestApiVerificado?.ano ?? localAnoRef);

        return metasNacionais.anosFinais.map((entry) => {
          const apiEntry = apiHistory.find((a) => a.ano === entry.ano);
          return {
            ano: entry.ano,
            metaProjetada: apiEntry?.metaProjetada ?? entry.meta,
            // O INEP só projetou metas por rede até 2021; de lá para cá o que
            // existe é a referência nacional. Quem exibe precisa distinguir.
            metaOrigem: apiEntry?.metaProjetada != null ? ("municipal" as const) : ("nacional" as const),
            idebVerificado: apiEntry?.idebVerificado ?? (entry.ano === effectiveAnoRef ? effectiveLocal : null),
          };
        });
      }

      // Fallback: use local historical dataset (pre-cached from QEdu)
      if (localHistorico?.anosFinais?.length) {
        return metasNacionais.anosFinais.map((entry) => {
          const localEntry = localHistorico.anosFinais.find((a) => a.ano === entry.ano);
          return {
            ano: entry.ano,
            metaProjetada: entry.meta,
            metaOrigem: "nacional" as const,
            idebVerificado: localEntry?.ideb ?? (entry.ano === localAnoRef ? localVerificado : null),
          };
        });
      }

      if (!localVerificado) return undefined;
      return metasNacionais.anosFinais.map((entry) => ({
        ano: entry.ano,
        metaProjetada: entry.meta,
        metaOrigem: "nacional" as const,
        idebVerificado: entry.ano === localAnoRef ? localVerificado : null,
      }));
    })(),
    idebEnsinoMedio: (() => {
      const apiHistory = qeduApiSnapshot?.historicoIdeb?.ensinoMedio;
      const localVerificado = idebRecord?.ensinoMedioPublica ?? null;
      const localAnoRef = idebRecord?.anoReferencia ?? 2023;
      const metasNacionais = getIdebMetasNacionais();

      if (apiHistory?.length) {
        const latestApiVerificado = [...apiHistory]
          .filter((a) => a.idebVerificado != null)
          .sort((a, b) => b.ano - a.ano)[0];
        const effectiveLocal = localVerificado ?? latestApiVerificado?.idebVerificado ?? null;
        const effectiveAnoRef = localVerificado ? localAnoRef : (latestApiVerificado?.ano ?? localAnoRef);

        return metasNacionais.ensinoMedio.map((entry) => {
          const apiEntry = apiHistory.find((a) => a.ano === entry.ano);
          return {
            ano: entry.ano,
            metaProjetada: apiEntry?.metaProjetada ?? entry.meta,
            // O INEP só projetou metas por rede até 2021; de lá para cá o que
            // existe é a referência nacional. Quem exibe precisa distinguir.
            metaOrigem: apiEntry?.metaProjetada != null ? ("municipal" as const) : ("nacional" as const),
            idebVerificado: apiEntry?.idebVerificado ?? (entry.ano === effectiveAnoRef ? effectiveLocal : null),
          };
        });
      }

      // Even without API data, show the EM section with metas (informational)
      return metasNacionais.ensinoMedio.map((entry) => ({
        ano: entry.ano,
        metaProjetada: entry.meta,
        metaOrigem: "nacional" as const,
        idebVerificado: entry.ano === localAnoRef ? localVerificado : null,
      }));
    })(),
  });
  const oportunidades = buildGoviaOportunidades(relatorio);
  const analiseExecutiva = buildAnaliseExecutiva(relatorio);
  const comparativo = await buildFundebComparativeSnapshot(relatorio);
  const fontes = [
    "IBGE Localidades",
    "Sync Next API",
    "Modelo técnico de levantamento FUNDEB",
  ];

  if (receitasBase) {
    fontes.splice(1, 0, receitasBase.fonte);
  }
  if (vaatContext) {
    fontes.splice(2, 0, "FNDE VAAT 2026");
  }
  if (inepRecord) {
    fontes.push(`INEP Sinopse Educação Básica ${inepRecord.anoReferencia}`);
  }
  if ((inepRecord?.escolasInfraPublicasTotal ?? 0) > 0) {
    fontes.push(`INEP Microdados de Escola ${inepRecord?.anoReferencia}`);
  }
  if (qeduIndicators) {
    fontes.push(qeduIndicators.fonte, qeduIndicators.fonteDistorcao);
  }
  if (ibgeIndicators?.populacaoEstimada || ibgeIndicators?.receitasBrutasMunicipais) {
    fontes.push("IBGE Cidades e Estados");
  }
  if (fndePublic?.fontes?.length) {
    fontes.push(...fndePublic.fontes);
  }
  if (simecObras?.fontes?.length) {
    fontes.push(...simecObras.fontes);
  }
  if (siconfiFiscal?.fontes?.length) {
    fontes.push(...siconfiFiscal.fontes);
  }

  const infraestruturaEscolar = buildInfraestruturaEscolarPayload(inepRecord);
  const aprendizagemPayload = buildAprendizagemPayload(qeduIndicators);
  const fontesDedupe = Array.from(new Set(fontes));
  const pendenciasFiscais = [];

  if (siconfiFiscal?.situacaoLrf && /acima/i.test(siconfiFiscal.situacaoLrf)) {
    pendenciasFiscais.push({
      tipo: "lrf_pessoal",
      severidade: /maximo/i.test(siconfiFiscal.situacaoLrf) ? "critica" : "alerta",
      descricao: `Despesa total com pessoal em ${siconfiFiscal.percentualDespesaPessoal?.toFixed(2) ?? "0"}% da RCL ajustada.`,
    });
  }

  const payload = {
    metadata: {
      data_coleta: new Date().toISOString(),
      versao_servico: "sync-next-govia-1.0",
      fontes: fontesDedupe,
      timestamp: formatDateTime(new Date()),
      cache: true,
      parametros_relatorio: parametros ?? null,
    },
    dados_basicos: {
      codigo_ibge: relatorio.identificacao.codigoIBGE,
      nome: relatorio.identificacao.municipioNome,
      uf: relatorio.identificacao.uf,
      regiao: relatorio.identificacao.regiao,
    },
    prefeito: relatorio.identificacao.prefeito,
    partido: relatorio.identificacao.partido,
    secretario_educacao: {
      nome: "Nao informado",
      email: "",
      telefone: "",
      formacao: "",
      tempo_cargo: "",
    },
    demografia: {
      populacao: ibgeIndicators?.populacaoEstimada ?? ibgeIndicators?.populacaoUltimoCenso ?? 0,
      populacao_ano_referencia: ibgeIndicators?.populacaoAnoReferencia ?? "Nao informado",
      idh: 0,
      idh_ano_referencia: "Nao informado",
      populacao_0_17: 0,
    },
    educacao: {
      total_escolas: relatorio.censoEscolar?.totalEscolas ?? 0,
      total_matriculas: relatorio.censoEscolar?.totalMatriculas ?? 0,
      total_escolas_publica: relatorio.censoEscolar?.dadosPublicosTotal?.totalEscolas ?? 0,
      total_matriculas_publica: relatorio.censoEscolar?.dadosPublicosTotal?.totalMatriculas ?? 0,
      publica_infantil: relatorio.censoEscolar?.dadosPublicosTotal?.infantil ?? 0,
      publica_fundamental_medio: relatorio.censoEscolar?.dadosPublicosTotal?.fundamentalMedio ?? 0,
      publica_eja: relatorio.censoEscolar?.dadosPublicosTotal?.eja ?? 0,
      publica_especial: relatorio.censoEscolar?.dadosPublicosTotal?.especial ?? 0,
      matriculas_creche: inepRecord?.crechePublica ?? inepRecord?.crecheTotal ?? 0,
      matriculas_pre_escola: inepRecord?.preEscolaPublica ?? inepRecord?.preEscolaTotal ?? 0,
      matriculas_fundamental_ai: relatorio.censoEscolar?.matriculasDetalhadas.anosIniciais ?? 0,
      matriculas_fundamental_af: relatorio.censoEscolar?.matriculasDetalhadas.anosFinais ?? 0,
      matriculas_eja: relatorio.censoEscolar?.matriculasEtapa.eja ?? 0,
      matriculas_ensino_medio: relatorio.censoEscolar?.matriculasEtapa.ensinoMedio ?? 0,
      matriculas_ensino_medio_rede_publica: inepRecord?.ensinoMedioPublica ?? null,
      matriculas_ensino_medio_total: inepRecord?.ensinoMedioTotal ?? null,
      matriculas_educacao_especial: relatorio.censoEscolar?.matriculasEtapa.educacaoEspecial ?? 0,
      matriculas_tempo_integral: relatorio.censoEscolar?.tempoIntegral.total ?? 0,
      // Taxas, notas e indices NUNCA caem para zero: zero e uma afirmacao ("IDEB 0,0",
      // "nenhum aluno abandonou"), enquanto a fonte muda (QEdu/INEP fora do ar, municipio
      // sem divulgacao por sigilo estatistico) significa apenas "nao sabemos". O template
      // imprime "N/D" para null e "0,0" para zero -- confundir os dois inverte o diagnostico.
      ideb_anos_iniciais: qeduIndicators?.anosIniciais?.idebObservado ?? idebRecord?.anosIniciaisPublica ?? null,
      ideb_anos_finais: qeduIndicators?.anosFinais?.idebObservado ?? idebRecord?.anosFinaisPublica ?? null,
      taxa_aprovacao: qeduIndicators?.anosIniciais?.taxaAprovacao ?? idebRecord?.taxaAprovacaoIniciais ?? null,
      taxa_aprovacao_anos_finais: qeduIndicators?.anosFinais?.taxaAprovacao ?? idebRecord?.taxaAprovacaoFinais ?? null,
      taxa_reprovacao: qeduIndicators?.taxasRendimento?.reprovacao?.total ?? null,
      taxa_abandono: qeduIndicators?.taxasRendimento?.abandono?.total ?? null,
      taxa_abandono_anos_finais: qeduIndicators?.taxasRendimento?.abandono?.anosFinais ?? null,
      nota_portugues_anos_iniciais: qeduIndicators?.anosIniciais?.notaPortugues ?? null,
      nota_matematica_anos_iniciais: qeduIndicators?.anosIniciais?.notaMatematica ?? null,
      nota_media_anos_iniciais: qeduIndicators?.anosIniciais?.notaMedia ?? null,
      nota_portugues_anos_finais: qeduIndicators?.anosFinais?.notaPortugues ?? null,
      nota_matematica_anos_finais: qeduIndicators?.anosFinais?.notaMatematica ?? null,
      nota_media_anos_finais: qeduIndicators?.anosFinais?.notaMedia ?? null,
      distorcao_idade_serie_total: qeduIndicators?.distorcaoIdadeSerie?.fundamentalTotal ?? null,
      distorcao_idade_serie_anos_iniciais: qeduIndicators?.distorcaoIdadeSerie?.anosIniciais ?? null,
      distorcao_idade_serie_anos_finais: qeduIndicators?.distorcaoIdadeSerie?.anosFinais ?? null,
      escolas_sem_agua: infraestruturaEscolar.escolas_sem_agua,
      escolas_sem_esgoto: infraestruturaEscolar.escolas_sem_esgoto,
      escolas_sem_cozinha: infraestruturaEscolar.escolas_sem_cozinha,
      escolas_sem_acessibilidade: infraestruturaEscolar.escolas_sem_acessibilidade,
      // Infraestrutura predial e transporte escolar nao sao coletados por nenhuma fonte
      // deste pipeline. Zero aqui afirmaria "o municipio nao aluga escola / nao tem frota",
      // o oposto do real na maioria dos municipios rurais. Ausencia = null.
      escolas_alugadas: null as number | null,
      alunos_transporte_escolar: null as number | null,
      frota_propria: null as number | null,
      frota_terceirizada: null as number | null,
      idade_media_frota: null as number | null,
      infraestrutura_rede_publica: infraestruturaEscolar,
      indicadores_aprendizagem: aprendizagemPayload,
      escolas: [],
      fontes: fontesDedupe,
      censo_ano: inepRecord?.anoReferencia ?? exercicio - 1,
    },
    fiscal: {
      pendencias: pendenciasFiscais,
      historico_repasses: comparativo.historicoRepasses,
      fonte: siconfiFiscal?.fontes[0] ?? "Sync Next API",
      fontes: fontesDedupe,
      total_pendencias: pendenciasFiscais.length,
      pendencias_criticas: pendenciasFiscais.filter((item) => item.severidade === "critica").length,
      fundeb: {
        disponivel: Boolean(receitasBase),
        ano_referencia: exercicio,
        fonte: receitasBase?.fonte ?? "Modelo tecnico interno",
        codigo_ibge: relatorio.identificacao.codigoIBGE,
        uf: relatorio.identificacao.uf,
        ente: relatorio.identificacao.municipio,
        receita: {
          contribuicao_estados_municipios: relatorio.receitas.receitaContribuicaoMunicipal,
          complementacao_vaaf: relatorio.receitas.complementacaoVAAF,
          complementacao_vaat: relatorio.receitas.complementacaoVAAT,
          complementacao_vaar: relatorio.receitas.complementacaoVAAR,
          complementacao_uniao_total:
            relatorio.receitas.complementacaoVAAF +
            relatorio.receitas.complementacaoVAAT +
            relatorio.receitas.complementacaoVAAR,
          receita_total_prevista: relatorio.receitas.totalReceitas,
        },
        cronograma: {
          vaaf: Object.fromEntries(
            relatorio.cronogramaVAAF.map((item) => [item.mes.toLowerCase(), item.valorProjetado]),
          ),
        },
        resumo: {
          complementacao_uniao_total:
            relatorio.receitas.complementacaoVAAF +
            relatorio.receitas.complementacaoVAAT +
            relatorio.receitas.complementacaoVAAR,
          media_mensal_complementacao:
            (relatorio.receitas.complementacaoVAAF +
              relatorio.receitas.complementacaoVAAT +
              relatorio.receitas.complementacaoVAAR) /
            12,
        },
      },
      siconfi: {
        disponivel: siconfiFiscal?.disponivel ?? false,
        ano_referencia: siconfiFiscal?.anoReferencia ?? null,
        instituicao: siconfiFiscal?.instituicao ?? "Nao informado",
        situacao_lrf: siconfiFiscal?.situacaoLrf ?? "Nao informado",
        rcl: siconfiFiscal?.rcl ?? null,
        rcl_ajustada: siconfiFiscal?.rclAjustada ?? null,
        despesa_pessoal_total: siconfiFiscal?.despesaPessoalTotal ?? null,
        percentual_despesa_pessoal: siconfiFiscal?.percentualDespesaPessoal ?? null,
        limite_maximo_pessoal: siconfiFiscal?.limiteMaximoPessoal ?? null,
        limite_prudencial_pessoal: siconfiFiscal?.limitePrudencialPessoal ?? null,
        limite_alerta_pessoal: siconfiFiscal?.limiteAlertaPessoal ?? null,
        espaco_fiscal_pessoal: siconfiFiscal?.espacoFiscalPessoal ?? null,
        receita_total_prevista: siconfiFiscal?.receitaTotalPrevista ?? null,
        receita_total_realizada: siconfiFiscal?.receitaTotalRealizada ?? null,
        receitas_correntes_realizadas: siconfiFiscal?.receitasCorrentesRealizadas ?? null,
        caixa_equivalentes: siconfiFiscal?.caixaEquivalentes ?? null,
        divida_ativa_tributaria: siconfiFiscal?.dividaAtivaTributaria ?? null,
        passivo_circulante: siconfiFiscal?.passivoCirculante ?? null,
        passivo_nao_circulante: siconfiFiscal?.passivoNaoCirculante ?? null,
        patrimonio_liquido: siconfiFiscal?.patrimonioLiquido ?? null,
        resultado_exercicio: siconfiFiscal?.resultadoExercicio ?? null,
        entregas: siconfiFiscal?.entregas ?? { dca: null, rgf: null, rreo: null },
        observacoes: siconfiFiscal?.observacoes ?? [],
      },
      situacao_lrf: siconfiFiscal?.situacaoLrf ?? "Nao informado",
      receita_total:
        siconfiFiscal?.receitaTotalRealizada ??
        ibgeIndicators?.receitasBrutasMunicipais ??
        relatorio.receitas.totalReceitas,
      despesa_pessoal: siconfiFiscal?.despesaPessoalTotal ?? 0,
      pib_per_capita: ibgeIndicators?.pibPerCapita ?? 0,
    },
    simec_obras_publicas: {
      disponivel: Boolean(simecObras),
      situacao: simecObras?.situacao ?? "indisponivel",
      total_obras: simecObras?.totalObras ?? 0,
      valor_estimado_repactuacao: simecObras?.valorEstimadoRepactuacao ?? null,
      valor_pago_infraestrutura: simecObras?.valorPagoInfraestrutura ?? null,
      obras_pac2: simecObras?.obrasPAC2 ?? [],
      fontes: simecObras?.fontes ?? [],
      observacoes: simecObras?.observacoes ?? [],
    },
    oportunidades,
    analise_ia: {
      diagnostico_executivo: analiseExecutiva,
      proximos_passos: [
        "Validar receitas atuais do FUNDEB",
        "Levantar status dos sistemas MEC/FNDE",
        "Conferir bases do Censo Escolar e indicadores da rede municipal",
      ],
      melhores_programas: oportunidades.slice(0, 3).map((item) => item.titulo),
      score_prioridade: buildScoreViabilidade(relatorio),
      metodologia:
        relatorio.perfilComercial?.metodologia ?? "Heuristica local baseada no relatorio tecnico FUNDEB do Sync.",
      fonte: "Sync Next API",
    },
    score_viabilidade: buildScoreViabilidade(relatorio),
    comparativo_fundeb: {
      ano_base_1: comparativo.comparativaPdfInput.ano_base_1,
      ano_base_2: comparativo.comparativaPdfInput.ano_base_2,
      receitas: comparativo.comparativaPdfInput.receitasComparativas,
      matriculas: comparativo.comparativaPdfInput.matriculasComparativas,
    },
    fontes_utilizadas: fontesDedupe,
    relatorio_fundeb: relatorio,
    relatorio_dirigido_base: buildRelatorioDirigidoBase({
      relatorio,
      comparativo,
      censoHistory: getInepCensoMunicipalHistory(String(municipio.id)),
      ibgeIndicators,
      qeduIndicators,
      inepRecord,
      siconfiFiscal,
      vaatContext,
    }),
  };

  return {
    municipio,
    relatorio,
    payload,
    oportunidades,
  };
}
