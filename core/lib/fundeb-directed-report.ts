import type {
  RelatorioDirigidoFonte,
  RelatorioDirigidoItem,
  RelatorioDirigidoMunicipio,
  RelatorioDirigidoProntidao,
  RelatorioDirigidoStatus,
  RelatorioFundeb,
} from "@/modules/levantamento-fundeb/types";
import { formatCurrency, formatDateTime, formatInteger } from "@/modules/levantamento-fundeb/utils/calculos";
import { normalizePtBrDeep, normalizePtBrText } from "@/modules/levantamento-fundeb/utils/ptbr";
import {
  buildDirectedHistoricalSeries,
  buildDirectedPoliticalContext,
  buildDirectedRegionalBenchmark,
} from "@/core/lib/fundeb-directed-context";

interface GoviaPayloadLike {
  dados_basicos?: {
    codigo_ibge?: string;
    nome?: string;
    uf?: string;
    regiao?: string;
  };
  prefeito?: string;
  partido?: string;
  demografia?: {
    populacao?: number;
    populacao_ano_referencia?: string | number;
    idh?: number;
    idh_ano_referencia?: string | number;
  };
  educacao?: {
    total_escolas?: number;
    total_matriculas?: number;
    matriculas_creche?: number;
    matriculas_pre_escola?: number;
    matriculas_fundamental_ai?: number;
    matriculas_fundamental_af?: number;
    matriculas_eja?: number;
    matriculas_ensino_medio?: number;
    matriculas_educacao_especial?: number;
    censo_ano?: number;
  };
  fiscal?: {
    pib_per_capita?: number;
    pib_ano_referencia?: string | number;
    fundeb?: {
      fonte?: string;
      receita?: {
        receita_total_prevista?: number;
      };
    };
  };
  analise_ia?: {
    diagnostico_executivo?: string;
    proximos_passos?: string[];
  };
  comparativo_fundeb?: {
    ano_base_1?: number;
    ano_base_2?: number;
  };
  fontes_utilizadas?: string[];
}

interface DirectedReportInput {
  relatorio: RelatorioFundeb;
  payload: GoviaPayloadLike;
}

function normalizeText(value: string | null | undefined) {
  return normalizePtBrText(typeof value === "string" ? value : "");
}

function clampConfidence(value: number | null | undefined, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(100, Math.round(Number(value))));
}

function isGoogleGroundingRedirect(url: string) {
  return /vertexaisearch\.cloud\.google\.com\/grounding-api-redirect/i.test(url);
}

function isLowSignalHomepage(url: string, title: string) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    const normalizedTitle = title.replace(/^https?:\/\//i, "").replace(/^www\./i, "").trim().toLowerCase();

    return (
      pathname === "/" &&
      (normalizedTitle === hostname || normalizedTitle === `www.${hostname}`) &&
      ["gov.br", "undime.org.br", "tesouro.gov.br", "fnde.gov.br"].includes(hostname)
    );
  } catch {
    return false;
  }
}

function normalizeFontes(fontes: RelatorioDirigidoFonte[]) {
  const seen = new Set<string>();
  const result: RelatorioDirigidoFonte[] = [];

  for (const fonte of fontes) {
    const url = normalizeText(fonte.url);
    const titulo = normalizeText(fonte.titulo) || url;
    const key = url || `base:${titulo}`;

    if (
      (!url && fonte.tipo !== "base_interna") ||
      isGoogleGroundingRedirect(url) ||
      isLowSignalHomepage(url, titulo) ||
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);
    result.push({
      url,
      titulo,
      tipo: fonte.tipo,
    });
  }

  return result.slice(0, 6);
}

function makeInternalSource(title: string): RelatorioDirigidoFonte {
  return {
    url: "",
    titulo: title,
    tipo: "base_interna",
  };
}

function buildBaseItem(input: {
  id: string;
  titulo: string;
  pergunta: string;
  resposta: string;
  status: RelatorioDirigidoStatus;
  confianca: number;
  observacoes?: string[];
  fontes?: RelatorioDirigidoFonte[];
}): RelatorioDirigidoItem {
  return {
    id: input.id,
    titulo: input.titulo,
    pergunta: input.pergunta,
    resposta: input.resposta,
    status: input.status,
    confianca: input.confianca,
    observacoes: input.observacoes ?? [],
    fontes: input.fontes ?? [],
  };
}

function buildEnsinoModalidades(payload: GoviaPayloadLike) {
  const educacao = payload.educacao;
  if (!educacao) {
    return "As modalidades ainda não foram consolidadas nas bases internas desta rodada.";
  }

  return [
    `Creche: ${formatInteger(educacao.matriculas_creche ?? 0)}`,
    `Pre-escola: ${formatInteger(educacao.matriculas_pre_escola ?? 0)}`,
    `Fundamental anos iniciais: ${formatInteger(educacao.matriculas_fundamental_ai ?? 0)}`,
    `Fundamental anos finais: ${formatInteger(educacao.matriculas_fundamental_af ?? 0)}`,
    `EJA: ${formatInteger(educacao.matriculas_eja ?? 0)}`,
    `Ensino médio: ${formatInteger(educacao.matriculas_ensino_medio ?? 0)}`,
    `Educação especial: ${formatInteger(educacao.matriculas_educacao_especial ?? 0)}`,
  ].join(" | ");
}

function buildEnsinoModalidadesList(payload: GoviaPayloadLike) {
  const educacao = payload.educacao;
  return [
    { label: "Creche", valor: educacao?.matriculas_creche ?? 0 },
    { label: "Pre-escola", valor: educacao?.matriculas_pre_escola ?? 0 },
    { label: "Fundamental anos iniciais", valor: educacao?.matriculas_fundamental_ai ?? 0 },
    { label: "Fundamental anos finais", valor: educacao?.matriculas_fundamental_af ?? 0 },
    { label: "EJA", valor: educacao?.matriculas_eja ?? 0 },
    { label: "Ensino médio", valor: educacao?.matriculas_ensino_medio ?? 0 },
    { label: "Educação especial", valor: educacao?.matriculas_educacao_especial ?? 0 },
  ];
}

function buildRochaPrimeProposal(report: RelatorioFundeb, municipio: string) {
  const projection = report.projecaoComercial ?? report.projecaoRecuperavel ?? report.projecao;
  return {
    headline: `A proposta da Rocha Prime é assumir a agenda técnica de ${municipio} com foco em recuperar, proteger e ampliar receita educacional.`,
    descricao:
      projection.totalGanho > 0
        ? `O levantamento identificou potencial técnico estimado de ${formatCurrency(projection.totalGanho)} sujeito a validação documental. A Rocha Prime entra para transformar esse potencial em plano de execução, saneamento de base e defesa institucional perante os sistemas do MEC/FNDE.`
        : "A Rocha Prime entra para organizar a base educacional, corrigir inconsistências, sustentar elegibilidade e evitar perda futura de receita.",
    entregas: [
      "Levantamento completo das bases educacionais, fiscais e operacionais do município.",
      "Cruzamento técnico entre Censo Escolar, FUNDEB, FNDE, MEC e normativos locais.",
      "Plano priorizado de correções para habilitação, recuperação e ampliação de receita.",
      "Acompanhamento executivo com roteiro de validação, cobrança e monitoramento.",
    ],
    etapas: [
      "Apresentação executiva ao gestor e alinhamento da tese técnica.",
      "Abertura da mesa técnica com secretaria, financeiro e responsáveis operacionais.",
      "Plano de ação Rocha Prime com cronograma, prioridades e metas de acompanhamento.",
    ],
    diferenciais: [
      "Atuação especializada em FUNDEB, Censo Escolar e sistemas FNDE.",
      "Leitura orientada a resultado, com foco em recuperação e defesa técnica da receita.",
      "Material executivo e acompanhamento institucional para apoiar a decisão do gestor.",
      "Histórico de trabalho em municípios com problemas de base, habilitação e monetização.",
    ],
  };
}

function buildFundebResourceLossSummary(relatorio: RelatorioFundeb) {
  const partes: string[] = [];
  const pendenciaVaat = normalizeText(relatorio.perfilComercial?.pendenciaVaat);
  const habilitacaoVaat = normalizeText(relatorio.perfilComercial?.habilitacaoVaat);
  const upsideVetores = relatorio.upsideCondicionado?.vetores ?? [];

  if ((relatorio.receitas.complementacaoVAAF ?? 0) <= 0) {
    partes.push("VAAF zerado na base atual, o que sugere revisar matrículas ponderadas, redistribuição intraestadual e consistência da base declarada.");
  }
  if ((relatorio.receitas.complementacaoVAAT ?? 0) <= 0) {
    if (pendenciaVaat) {
      partes.push(`VAAT zerado com pendência já indicada na base técnica: ${pendenciaVaat}.`);
    } else if (habilitacaoVaat && !/habilitado|ativa/i.test(habilitacaoVaat)) {
      partes.push(`VAAT zerado com status operacional relevante: ${habilitacaoVaat}.`);
    } else {
      partes.push("VAAT zerado na base atual, exigindo apuração sobre elegibilidade, regularidade informacional e critérios de habilitação.");
    }
  }
  if ((relatorio.receitas.complementacaoVAAR ?? 0) <= 0) {
    partes.push("VAAR zerado na base atual, o que normalmente exige leitura sobre condicionalidades, desempenho e regularidade das informações.");
  }
  if (upsideVetores.length) {
    partes.push(`Os vetores técnicos já sinalizados pelo levantamento incluem: ${upsideVetores.join(", ")}.`);
  }

  return partes.join(" ");
}

export async function buildDirectedFundebReportBase({
  relatorio,
  payload,
}: DirectedReportInput): Promise<RelatorioDirigidoMunicipio> {
  const municipio = payload.dados_basicos?.nome ?? relatorio.identificacao.municipioNome;
  const uf = payload.dados_basicos?.uf ?? relatorio.identificacao.uf;
  const codigoIbge = payload.dados_basicos?.codigo_ibge ?? relatorio.identificacao.codigoIBGE;
  const populacao = payload.demografia?.populacao ?? 0;
  const anoPopulacao = payload.demografia?.populacao_ano_referencia ?? "Não informado";
  const idh = payload.demografia?.idh ?? null;
  const idhAno = payload.demografia?.idh_ano_referencia ?? null;
  const pibPerCapita = payload.fiscal?.pib_per_capita ?? null;
  const pibAno = payload.fiscal?.pib_ano_referencia ?? null;
  const totalEscolas = payload.educacao?.total_escolas ?? relatorio.censoEscolar?.totalEscolas ?? 0;
  const totalMatriculas = payload.educacao?.total_matriculas ?? relatorio.censoEscolar?.totalMatriculas ?? 0;
  const censoAno = payload.educacao?.censo_ano ?? relatorio.censoEscolar?.anoReferencia ?? null;
  const transporteIdentificado = relatorio.caminhoEscola.some((item) => (item.valor ?? 0) > 0);
  const pendenciaVaat = normalizeText(relatorio.perfilComercial?.pendenciaVaat);
  const habilitacaoVaat = normalizeText(relatorio.perfilComercial?.habilitacaoVaat);
  const observacoesRelevantes = [
    payload.analise_ia?.diagnostico_executivo,
    ...relatorio.observacoesOperacionais.slice(0, 3),
  ]
    .map((item) => normalizeText(item))
    .filter(Boolean);

  const [contextoPolitico, historico, benchmarkRegional] = await Promise.all([
    buildDirectedPoliticalContext(relatorio),
    buildDirectedHistoricalSeries(relatorio),
    buildDirectedRegionalBenchmark(relatorio),
  ]);

  const itens: RelatorioDirigidoItem[] = [
    buildBaseItem({
      id: "observacoes_relevantes",
      titulo: "Observações relevantes sobre a cidade",
      pergunta: "Quais observações institucionais relevantes sobre a cidade aparecem nas bases atuais?",
      resposta:
        observacoesRelevantes.join(" ") ||
        "As bases internas indicam contexto inicial do município, mas a rodada de pesquisa pública ainda não foi executada.",
      status: observacoesRelevantes.length ? "confirmado" : "sinalizado",
      confianca: observacoesRelevantes.length ? 84 : 52,
      observacoes: [
        "Este item combina diagnóstico interno do Sync com observações operacionais públicas já coletadas.",
        "A redação final precisa servir de apoio para o apresentador conduzir a reunião com o gestor.",
      ],
      fontes: [makeInternalSource("Sync / GovIA payload interno")],
    }),
    buildBaseItem({
      id: "arranjo_educacional",
      titulo: "Modelo de governança da educação",
      pergunta: "A educação municipal opera em rede municipal, sistema municipal ou outro arranjo formal?",
      resposta:
        "As bases internas do levantamento não trazem uma declaração jurídico-formal conclusiva sobre rede ou sistema. Este ponto precisa de pesquisa dirigida em legislação municipal e normativos da secretaria.",
      status: "pendente_manual",
      confianca: 18,
      observacoes: ["Pesquisar lei do sistema municipal de ensino, organograma da secretaria e normativa local."],
      fontes: [makeInternalSource("Sync / base oficial interna")],
    }),
    buildBaseItem({
      id: "habitantes",
      titulo: "Habitantes e referência populacional",
      pergunta: "Qual a população mais recente disponível e qual o ano de referência?",
      resposta:
        populacao > 0
          ? `A base atual registra ${formatInteger(populacao)} habitantes, com ano de referência ${anoPopulacao}.`
          : "A população não veio consolidada nesta rodada e exige confirmação complementar.",
      status: populacao > 0 ? "confirmado" : "sinalizado",
      confianca: populacao > 0 ? 96 : 42,
      fontes: [makeInternalSource("IBGE / Sync")],
    }),
    buildBaseItem({
      id: "matriculas_modalidades",
      titulo: "Matrículas e modalidades",
      pergunta: "Quantas matrículas existem na rede e como se distribuem por modalidade?",
      resposta:
        totalMatriculas > 0
          ? `A base interna registra ${formatInteger(totalMatriculas)} matrículas. Distribuição: ${buildEnsinoModalidades(payload)}.`
          : "As matrículas da rede ainda não foram consolidadas nesta rodada.",
      status: totalMatriculas > 0 ? "confirmado" : "sinalizado",
      confianca: totalMatriculas > 0 ? 94 : 38,
      fontes: [makeInternalSource("INEP Censo Escolar / Sync")],
    }),
    buildBaseItem({
      id: "ultimo_censo_escolar",
      titulo: "Último censo escolar utilizado",
      pergunta: "Qual foi o último ano de Censo Escolar usado no relatório?",
      resposta:
        censoAno !== null
          ? `O recorte atual usa o Censo Escolar com ano de referência ${censoAno}.`
          : "O ano de referência do Censo Escolar não veio fechado nesta rodada.",
      status: censoAno !== null ? "confirmado" : "sinalizado",
      confianca: censoAno !== null ? 95 : 40,
      fontes: [makeInternalSource("INEP Censo Escolar / Sync")],
    }),
    buildBaseItem({
      id: "quantidade_escolas",
      titulo: "Quantidade de escolas",
      pergunta: "Quantas escolas existem no recorte municipal do relatório?",
      resposta:
        totalEscolas > 0
          ? `Foram consolidadas ${formatInteger(totalEscolas)} escolas no recorte atual do levantamento.`
          : "A quantidade de escolas não foi consolidada nas bases internas desta rodada.",
      status: totalEscolas > 0 ? "confirmado" : "sinalizado",
      confianca: totalEscolas > 0 ? 95 : 40,
      fontes: [makeInternalSource("INEP Censo Escolar / Sync")],
    }),
    buildBaseItem({
      id: "transporte_escolar",
      titulo: "Transporte escolar",
      pergunta: "Quanto o município está recebendo de transporte escolar?",
      resposta: transporteIdentificado
        ? `Foram identificados registros operacionais de Caminho da Escola na base atual. A monetização consolidada do transporte escolar ainda precisa ser fechada por pesquisa dirigida e validação documental.`
        : "A base atual não consolidou valor final de transporte escolar. Este item exige pesquisa dirigida em FNDE, portais oficiais e documentos municipais.",
      status: transporteIdentificado ? "sinalizado" : "pendente_manual",
      confianca: transporteIdentificado ? 54 : 20,
      observacoes: ["Separar frota, adesões, Caminho da Escola e eventual repasse do PNATE."],
      fontes: [makeInternalSource("FNDE operacional / Sync")],
    }),
    buildBaseItem({
      id: "incentivo_eja",
      titulo: "Incentivo à EJA",
      pergunta: "Existe projeto de lei, programa ou ação institucional de incentivo à EJA?",
      resposta:
        "As bases internas não possuem evidência normativa suficiente para afirmar a existência de incentivo à EJA. Este item depende de pesquisa em legislação municipal e notícias institucionais.",
      status: "pendente_manual",
      confianca: 15,
      fontes: [makeInternalSource("Sync / base oficial interna")],
    }),
    buildBaseItem({
      id: "bonificacao_boas_praticas",
      titulo: "Bonificação por boas práticas",
      pergunta: "Existe projeto de lei, programa ou normativa de bonificação por boas práticas para professores, diretores e alunos?",
      resposta:
        "Não há evidência suficiente nas bases internas para afirmar a existência dessa política. O item deve ser pesquisado em leis, decretos, planos de carreira e comunicados oficiais.",
      status: "pendente_manual",
      confianca: 12,
      fontes: [makeInternalSource("Sync / base oficial interna")],
    }),
    buildBaseItem({
      id: "formacao_capacitacao",
      titulo: "Formação e capacitação do quadro",
      pergunta: "Há evidências públicas de formação e capacitação do quadro da educação?",
      resposta:
        "A base interna não fecha histórico institucional de formação. Este item deve ser verificado em páginas da secretaria, diários oficiais e notícias de capacitação.",
      status: "pendente_manual",
      confianca: 18,
      fontes: [makeInternalSource("Sync / base oficial interna")],
    }),
    buildBaseItem({
      id: "parceria_assistencia_eja",
      titulo: "Parceria assistência social x educação para EJA",
      pergunta: "Há parceria entre assistência social e educação para ativação de base de EJA?",
      resposta:
        "Não há evidências suficientes nas bases internas. Este item exige pesquisa dirigida em programas intersetoriais do município.",
      status: "pendente_manual",
      confianca: 10,
      fontes: [makeInternalSource("Sync / base oficial interna")],
    }),
    buildBaseItem({
      id: "parceria_cultura_rua",
      titulo: "Parceria cultura x educação com ação de rua",
      pergunta: "Há parceria entre cultura e educação com apoio de profissional de rua ou ação equivalente?",
      resposta:
        "Não há evidência interna conclusiva sobre essa articulação. O item depende de pesquisa em notícias oficiais, projetos municipais e diários oficiais.",
      status: "pendente_manual",
      confianca: 10,
      fontes: [makeInternalSource("Sync / base oficial interna")],
    }),
    buildBaseItem({
      id: "icms_28_goias",
      titulo: "ICMS e os 28% em Goiás",
      pergunta: "O ponto dos 28% de ICMS aplicado ao desenvolvimento da educação também se aplica em Goiás?",
      resposta:
        "Este item é jurídico-tributário sensível. Não deve ser fechado automaticamente. Precisa de validação normativa específica do Estado de Goiás e confirmação com especialista.",
      status: "pendente_manual",
      confianca: 5,
      observacoes: ["Certificar com Dr. Douglas antes de transformar em afirmação de relatório final."],
      fontes: [makeInternalSource("Pendencia juridica do levantamento")],
    }),
    buildBaseItem({
      id: "perda_ou_nao_captura_recursos_fundeb",
      titulo: "Perda ou não captura dos recursos do FUNDEB",
      pergunta: "Existem evidências sobre perda ou não captura de VAAF, VAAT e VAAR, e quais os motivos objetivos de cada caso?",
      resposta:
        buildFundebResourceLossSummary(relatorio) ||
        "A base atual mostra potencial técnico e observações operacionais, mas ainda não fecha sozinha a narrativa causal sobre perda ou não captura de recursos específicos. Este item precisa de pesquisa dirigida e validação documental.",
      status: "sinalizado",
      confianca: 48,
      observacoes: [
        "A IA deve apurar separadamente VAAF, VAAT e VAAR.",
        "Quando não houver documento oficial suficiente, o texto deve distinguir entre evidência objetiva, hipótese técnica e pendência documental.",
      ],
      fontes: [makeInternalSource("Sync / observacoes operacionais, habilitacao VAAT e projecao tecnica")],
    }),
    buildBaseItem({
      id: "motivos_nao_captura_vaaf",
      titulo: "Motivos de não captura do VAAF",
      pergunta: "Se houver não captura de VAAF, quais evidências ou hipóteses técnicas explicam isso no município?",
      resposta:
        (relatorio.receitas.complementacaoVAAF ?? 0) <= 0
          ? "A base interna sugere investigar matrículas ponderadas, redistribuição intraestadual, composição da rede e consistência cadastral. A apuração final depende de fontes oficiais adicionais."
          : "O município registra VAAF na base atual; a análise deve focar manutenção ou ampliação dessa posição, e não perda total do componente.",
      status: "sinalizado",
      confianca: 42,
      fontes: [makeInternalSource("Sync / Fundeb tecnico interno")],
    }),
    buildBaseItem({
      id: "motivos_nao_captura_vaat",
      titulo: "Motivos de não captura do VAAT",
      pergunta: "Se houver não captura de VAAT, qual o motivo objetivo mais provável e quais evidências existem?",
      resposta:
        (relatorio.receitas.complementacaoVAAT ?? 0) <= 0
          ? pendenciaVaat
            ? `A base interna já sinaliza a seguinte pendência ligada ao VAAT: ${pendenciaVaat}. Isso precisa ser confirmado com fonte oficial e traduzido de forma executiva para o gestor.`
            : habilitacaoVaat
              ? `A base interna registra o seguinte status operacional relacionado ao VAAT: ${habilitacaoVaat}. A IA precisa confirmar em fontes oficiais se isso explica a não captura do recurso.`
              : "A base interna indica VAAT zerado, mas ainda sem motivo causal fechado. A IA deve investigar elegibilidade, habilitação e regularidade informacional."
          : "O município registra VAAT na base atual; a investigação deve focar riscos de perda futura ou oportunidades de ampliação.",
      status: "sinalizado",
      confianca: pendenciaVaat || habilitacaoVaat ? 58 : 35,
      fontes: [makeInternalSource("Sync / status operacional VAAT")],
    }),
    buildBaseItem({
      id: "motivos_nao_captura_vaar",
      titulo: "Motivos de não captura do VAAR",
      pergunta: "Se houver não captura de VAAR, quais fatores de desempenho, condicionalidade ou regularidade podem explicar isso?",
      resposta:
        (relatorio.receitas.complementacaoVAAR ?? 0) <= 0
          ? "A base interna aponta VAAR zerado. Em regra, isso exige leitura sobre condicionalidades, resultados e regularidade das informações. A IA deve buscar evidências normativas e institucionais antes da conclusão final."
          : "O município registra VAAR na base atual; a análise deve focar sustentação do componente e fatores de risco.",
      status: "sinalizado",
      confianca: 38,
      fontes: [makeInternalSource("Sync / Fundeb e indicadores educacionais")],
    }),
  ];

  const resumoExecutivo =
    payload.analise_ia?.diagnostico_executivo ||
    `O município de ${municipio}/${uf} já possui base oficial consolidada no Sync para receitas FUNDEB, Censo Escolar e contexto fiscal. Este documento deve ser preparado para o apresentador entregar ao gestor municipal, com máxima densidade factual, linguagem executiva e foco especial nos motivos de eventual perda ou não captura de recursos do FUNDEB.`;

  return normalizePtBrDeep({
    municipio,
    uf,
    codigoIbge,
    geradoEm: formatDateTime(new Date()),
    modo: "base_interna",
    modeloPrincipal: "sync-base-interna",
    modeloAuxiliar: null,
    resumoExecutivo,
    searchQueries: [],
    itens,
    pendenciasHumanas: [
      "Validar juridicamente o item do ICMS e dos 28% com especialista.",
      "Confirmar causas documentais de eventual perda ou não captura de VAAF, VAAT e VAAR.",
      "Pesquisar atos normativos locais sobre EJA, bonificação e parcerias intersetoriais.",
    ],
    alertasJuridicos: [
      "Não transformar tese jurídico-tributária em afirmação final sem base normativa estadual confirmada.",
      "Não atribuir perda de recurso a falha de gestão sem evidência oficial robusta.",
    ],
    proximosPassos: payload.analise_ia?.proximos_passos?.length
      ? payload.analise_ia.proximos_passos
      : [
          "Rodar a pesquisa dirigida com IA para legislação municipal, programas locais e causas objetivas de perda ou não captura de recursos.",
          "Classificar cada resposta entre confirmado, sinalizado e pendente manual.",
          "Gerar uma versão executiva pensada para apresentação ao gestor antes de partir para PDF final.",
        ],
    prontidao: {
      status: "bloqueado",
      score: 25,
      resumo: "A versão base interna ainda não deve ser entregue ao gestor sem rodada de pesquisa dirigida e revisão humana.",
      bloqueios: [
        "Relatório ainda sem consolidação web dirigida e sem fechamento dos itens críticos de recurso.",
      ],
      avisos: [
        "A base interna serve como âncora técnica inicial, não como documento final de apresentação.",
      ],
      criterios: [
        "Arranjo educacional formal sustentado por fonte externa.",
        "Diagnóstico de VAAF, VAAT e VAAR sem contradição interna.",
        "Item central de perda ou não captura do FUNDEB apoiado em evidência pública suficiente.",
        "Transporte escolar só entra no resumo com valor nominal quando houver lastro externo.",
        "Tema jurídico do ICMS em Goiás tratado sem extrapolar a base normativa.",
      ],
    },
    perfilMunicipio: {
      populacao: populacao > 0 ? populacao : null,
      populacaoAnoReferencia: anoPopulacao,
      idh,
      idhAnoReferencia: idhAno,
      pibPerCapita,
      pibAnoReferencia: pibAno,
    },
    diagnosticoEducacao: {
      censoAno,
      totalEscolas: totalEscolas > 0 ? totalEscolas : null,
      totalMatriculas: totalMatriculas > 0 ? totalMatriculas : null,
      modalidades: buildEnsinoModalidadesList(payload),
    },
    contextoPolitico,
    historico,
    benchmarkRegional,
    propostaEmpresa: buildRochaPrimeProposal(relatorio, municipio),
  } satisfies RelatorioDirigidoMunicipio);
}
