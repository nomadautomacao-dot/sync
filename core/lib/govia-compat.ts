import {
  formatDateTime,
  hydrateRelatorioFundeb,
  normalizarIBGE,
} from "@/modules/levantamento-fundeb/utils/calculos";
import type { RelatorioFundeb } from "@/modules/levantamento-fundeb/types";
import { getFundebReceitasOficiais, getFundebVaatContext } from "@/core/lib/fundeb-fnde";
import { getInepCensoMunicipalRecord } from "@/core/lib/inep-censo";
import { getIbgeCidadeIndicators } from "@/core/lib/ibge-cidade-indicators";
import { buildCensoEscolarFromInep, buildPerfilEProjecaoComercial } from "@/core/lib/fundeb-commercial";
import { estimateFundebReceitas } from "@/core/lib/fundeb-estimate";
import { getFndePublicEnrichment } from "@/core/lib/fnde-public";
import { buildFundebComparativeSnapshot } from "@/core/lib/fundeb-comparative";
import { getTsePrefeitoRecord } from "@/core/lib/tse-prefeitos";
import { getIdebMunicipalRecord } from "@/core/lib/ideb-municipal";
import { getQeduMunicipalIndicators } from "@/core/lib/qedu-indicators";
import { getSiconfiFiscalRecord } from "@/core/lib/siconfi-fiscal";
import { getSimecObrasRecord } from "@/core/lib/simec-obras";

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

export interface GoviaMunicipioSuggestion {
  codigo_ibge: string;
  nome: string;
  uf: string;
  regiao: string;
}

export interface GoviaBuscarMunicipioParams {
  codigo_ibge?: string;
  nome?: string;
  uf?: string;
  exercicio?: number;
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

export interface GoviaMunicipioRegionalParams {
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
        return (await response.json()) as IbgeMunicipioResponse;
      }
    }

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

export async function buildGoviaMunicipioCompleto(params: GoviaBuscarMunicipioParams) {
  const exercicio = params.exercicio && params.exercicio > 2000 ? params.exercicio : new Date().getFullYear();
  const municipio = await findGoviaMunicipio(params);

  if (!municipio) {
    return null;
  }

  const municipioUf = getMunicipioUf(municipio) || "UF";

  const receitasOficiais = await getFundebReceitasOficiais(String(municipio.id), exercicio);
  const [vaatContext, ibgeIndicators, inepRecord, fndePublic, qeduIndicators, siconfiFiscal, simecObras] =
    await Promise.all([
    getFundebVaatContext(String(municipio.id), exercicio),
    getIbgeCidadeIndicators(municipio.nome, municipioUf),
    Promise.resolve(getInepCensoMunicipalRecord(String(municipio.id))),
    getFndePublicEnrichment({
      municipio: municipio.nome,
      uf: municipioUf,
      exercicio,
    }).catch(() => null),
      getQeduMunicipalIndicators(String(municipio.id)).catch(() => null),
      getSiconfiFiscalRecord(String(municipio.id), exercicio).catch(() => null),
      getSimecObrasRecord(String(municipio.id)).catch(() => null),
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
    idebAnosIniciais:
      qeduIndicators?.anosIniciais?.idebObservado || idebRecord?.anosIniciaisPublica
        ? [
            {
              ano: qeduIndicators?.anoReferencia ?? idebRecord?.anoReferencia ?? exercicio - 1,
              idebVerificado:
                qeduIndicators?.anosIniciais?.idebObservado ?? idebRecord?.anosIniciaisPublica ?? 0,
              metaProjetada: 0,
            },
          ]
        : undefined,
    idebAnosFinais:
      qeduIndicators?.anosFinais?.idebObservado || idebRecord?.anosFinaisPublica
        ? [
            {
              ano: qeduIndicators?.anoReferencia ?? idebRecord?.anoReferencia ?? exercicio - 1,
              idebVerificado:
                qeduIndicators?.anosFinais?.idebObservado ?? idebRecord?.anosFinaisPublica ?? 0,
              metaProjetada: 0,
            },
          ]
        : undefined,
  });
  const oportunidades = buildGoviaOportunidades(relatorio);
  const analiseExecutiva = buildAnaliseExecutiva(relatorio);
  const comparativo = await buildFundebComparativeSnapshot(relatorio);
  const fontes = [
    "IBGE Localidades",
    "Sync Next API",
    "Modelo tecnico de levantamento FUNDEB",
  ];

  if (receitasBase) {
    fontes.splice(1, 0, receitasBase.fonte);
  }
  if (vaatContext) {
    fontes.splice(2, 0, "FNDE VAAT 2026");
  }
  if (inepRecord) {
    fontes.push(`INEP Sinopse Educacao Basica ${inepRecord.anoReferencia}`);
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
      idh: ibgeIndicators?.idhm ?? 0,
      idh_ano_referencia: ibgeIndicators?.idhmAnoReferencia ?? "Nao informado",
      populacao_0_17: 0,
    },
    educacao: {
      total_escolas: relatorio.censoEscolar?.totalEscolas ?? 0,
      total_matriculas: relatorio.censoEscolar?.totalMatriculas ?? 0,
      matriculas_creche: inepRecord?.crechePublica ?? inepRecord?.crecheTotal ?? 0,
      matriculas_pre_escola: inepRecord?.preEscolaPublica ?? inepRecord?.preEscolaTotal ?? 0,
      matriculas_fundamental_ai: relatorio.censoEscolar?.matriculasDetalhadas.anosIniciais ?? 0,
      matriculas_fundamental_af: relatorio.censoEscolar?.matriculasDetalhadas.anosFinais ?? 0,
      matriculas_eja: relatorio.censoEscolar?.matriculasEtapa.eja ?? 0,
      matriculas_ensino_medio: relatorio.censoEscolar?.matriculasEtapa.ensinoMedio ?? 0,
      matriculas_educacao_especial: relatorio.censoEscolar?.matriculasEtapa.educacaoEspecial ?? 0,
      matriculas_tempo_integral: relatorio.censoEscolar?.tempoIntegral.total ?? 0,
      ideb_anos_iniciais: qeduIndicators?.anosIniciais?.idebObservado ?? idebRecord?.anosIniciaisPublica ?? 0,
      ideb_anos_finais: qeduIndicators?.anosFinais?.idebObservado ?? idebRecord?.anosFinaisPublica ?? 0,
      taxa_aprovacao: qeduIndicators?.anosIniciais?.taxaAprovacao ?? idebRecord?.taxaAprovacaoIniciais ?? 0,
      taxa_aprovacao_anos_finais: qeduIndicators?.anosFinais?.taxaAprovacao ?? idebRecord?.taxaAprovacaoFinais ?? 0,
      taxa_abandono: 0,
      nota_portugues_anos_iniciais: qeduIndicators?.anosIniciais?.notaPortugues ?? 0,
      nota_matematica_anos_iniciais: qeduIndicators?.anosIniciais?.notaMatematica ?? 0,
      nota_media_anos_iniciais: qeduIndicators?.anosIniciais?.notaMedia ?? 0,
      nota_portugues_anos_finais: qeduIndicators?.anosFinais?.notaPortugues ?? 0,
      nota_matematica_anos_finais: qeduIndicators?.anosFinais?.notaMatematica ?? 0,
      nota_media_anos_finais: qeduIndicators?.anosFinais?.notaMedia ?? 0,
      distorcao_idade_serie_total: qeduIndicators?.distorcaoIdadeSerie?.fundamentalTotal ?? 0,
      distorcao_idade_serie_anos_iniciais: qeduIndicators?.distorcaoIdadeSerie?.anosIniciais ?? 0,
      distorcao_idade_serie_anos_finais: qeduIndicators?.distorcaoIdadeSerie?.anosFinais ?? 0,
      escolas_sem_agua: infraestruturaEscolar.escolas_sem_agua,
      escolas_sem_esgoto: infraestruturaEscolar.escolas_sem_esgoto,
      escolas_sem_cozinha: infraestruturaEscolar.escolas_sem_cozinha,
      escolas_sem_acessibilidade: infraestruturaEscolar.escolas_sem_acessibilidade,
      escolas_alugadas: 0,
      alunos_transporte_escolar: 0,
      frota_propria: 0,
      frota_terceirizada: 0,
      idade_media_frota: 0,
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
  };

  return {
    municipio,
    relatorio,
    payload,
    oportunidades,
  };
}
