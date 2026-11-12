export interface MunicipioIdentificacao {
  municipio: string;
  municipioNome: string;
  uf: string;
  codigoIBGE: string;
  prefeito: string;
  partido: string;
  exercicio: number;
  fonte: string;
  mesorregiao: string;
  microrregiao: string;
  regiaoIntermediaria: string;
  regiao: string;
}

export interface ReceitasFundeb {
  receitaContribuicaoMunicipal: number;
  complementacaoVAAF: number;
  complementacaoVAAT: number;
  complementacaoVAAR: number;
  totalReceitas: number;
}

/** Uma parcela do potencial, com a regra que a gerou. */
export interface ParcelaGanhoFundeb {
  chave: "vaar" | "lacunas" | "matriculas";
  titulo: string;
  valor: number;
  /** A conta em uma linha, pronta para impressão. */
  regra: string;
  /** Página do Levantamento onde a parcela se abre. */
  pagina: number;
  /**
   * `apurado`: sai de fator e valor oficiais sobre a matrícula do próprio
   * município. `referencia`: mediana de outros entes. `cenario`: meta de um ano.
   */
  natureza: "apurado" | "referencia" | "cenario";
}

/** Um horizonte do cenário otimista: o total e as parcelas que o somam. */
export interface HorizonteOtimistaFundeb {
  total: number;
  /** Sobre a receita atual, em %. */
  percentual: number;
  parcelas: ParcelaGanhoFundeb[];
}

/**
 * Até onde este município pode ir — as mesmas alavancas do potencial, com as
 * matrículas no ritmo que uma em cada dez redes do país alcançou.
 */
export interface CenarioOtimistaFundeb {
  umAno: HorizonteOtimistaFundeb;
  tresAnos: HorizonteOtimistaFundeb;
  /** Em três anos a rede cruza o VAAT-MIN e passa a receber complementação. */
  entraNoVaat: boolean;
  /**
   * `global`: ritmo dos municípios atendidos pela Global. `nacional`: decil de
   * cima do país — usado quando o padrão dos casos não pôde ser medido.
   */
  base?: "global" | "nacional";
  /** Exercícios em que o primeiro e o terceiro ciclo viram receita. */
  exercicioPrimeiro?: number;
  exercicioTerceiro?: number;
}

export interface ProjecaoFundeb {
  vaafAtual: number;
  vaafProjetado: number;
  vaafGanho: number;
  vaatAtual: number;
  vaatProjetado: number;
  vaatGanho: number;
  vaarAtual: number;
  vaarProjetado: number;
  vaarGanho: number;
  totalAtual: number;
  totalProjetado: number;
  totalGanho: number;
  ganhoPercentual: number;
  possuiComplementacao: boolean;
  metodologia?: string;
  multiplicadorAplicado?: number | null;
  natureza?: "recuperavel" | "benchmark" | "referencia" | "composta";
  /** As parcelas que somam `totalGanho`, quando a projeção é composta. */
  parcelas?: ParcelaGanhoFundeb[];
  /** O teto individual do município. Ausente em relatório anterior à composição. */
  otimista?: CenarioOtimistaFundeb | null;
  /** Exercício em que a parcela de matrícula começa a virar receita (depende do mês da emissão). */
  exercicioDoGanho?: number;
  ressalva?: string | null;
}

export interface UpsideCondicionadoFundeb {
  totalProjetado: number;
  ganhoAdicional: number;
  ganhoPercentual: number;
  metodologia: string;
  vetores: string[];
}

export interface CronogramaVAAF {
  mes: string;
  valorProjetado: number;
  percentual: number;
}

export interface SistemaHabilitacao {
  instituicao: string;
  sistema: string;
  situacao: string;
}

export interface ObraPAC2 {
  tipo: string;
  aprovadas: number | null;
  execucao: number | null;
  canceladas: number | null;
  concluidas: number | null;
  total: number | null;
}

export interface VeiculoCaminhoEscola {
  tipo: string;
  quantidade: number | null;
  valor: number | null;
}

export interface RepassePDDE {
  ano: number;
  valor: number;
}

export interface IDEBDado {
  ano: number;
  metaProjetada: number | null;
  idebVerificado: number | null;
  /**
   * Procedência da meta.
   *
   * O INEP projetou metas por rede **apenas até 2021** — o ciclo do IDEB
   * encerrou ali e a edição de 2023 saiu sem metas estipuladas. Quando não há
   * meta municipal, cai-se na referência nacional, e o relatório precisa
   * dizer isso: apresentar 6,0 como "a meta do município" é afirmar um
   * compromisso que o INEP não publicou.
   */
  metaOrigem?: "municipal" | "nacional" | null;
}

export interface CensoEscolar {
  /**
   * Totais da rede **pública** (municipal + estadual). É o recorte que o QEdu
   * usa na "Visão Geral", mantido aqui para o cliente conseguir comparar.
   *
   * Não use estes campos em conta de FUNDEB: o fundo municipal remunera a
   * rede municipal, e dividir a receita municipal por matrícula pública
   * subestima o recurso por aluno. Para isso existem os campos `*Municipais`
   * logo abaixo — e `matriculasEtapa`, que já é municipal.
   */
  totalEscolas: number;
  totalMatriculas: number;
  totalDocentes: number;
  /** Recorte municipal — a base correta para qualquer divisão por aluno. */
  totalEscolasMunicipais: number | null;
  totalMatriculasMunicipais: number | null;
  totalDocentesMunicipais: number | null;
  fonte: string;
  anoReferencia: number | null;
  /** Refere-se a `totalEscolas`/`totalMatriculas`/`totalDocentes`. */
  recorte: "publica" | "municipal" | "total";
  matriculasEtapa: {
    educacaoInfantil: number;
    ensinoFundamental: number;
    ensinoMedio: number;
    eja: number;
    educacaoEspecial: number;
    ensinoMedioPublica?: number | null;
    ensinoMedioTotal?: number | null;
  };
  matriculasDetalhadas: {
    creche: number;
    preEscola: number;
    anosIniciais: number;
    anosFinais: number;
    anosFinaisPublica?: number | null;
  };
  tempoIntegral: {
    total: number | null;
    educacaoInfantil: number | null;
    creche: number | null;
    preEscola: number | null;
    anosIniciais: number | null;
    anosFinais: number | null;
    anosFinaisPublica?: number | null;
    ensinoFundamental: number | null;
    ensinoMedio: number | null;
    ensinoMedioPublica?: number | null;
    eja: number | null;
    educacaoEspecial: number | null;
  };
  docentesCiclo: {
    fundamentalIniciaisFinais: number;
    ensinoMedio: number;
  };
  dadosPublicosTotal?: {
    totalEscolas: number;
    totalMatriculas: number;
    totalDocentes: number;
    infantil: number;
    fundamentalMedio: number;
    eja: number;
    especial: number;
  };
}

export interface FundebStateLayer {
  uf: string;
  fundoEstadual: string;
  amostraHistorica: number;
  residuoMedioHistorico: number | null;
  dispersaoHistorica: number | null;
  ajusteMultiplicadorSugerido: number | null;
  ajusteMultiplicadorAplicado: number;
  ajusteAtivo: boolean;
  observacao: string;
  variaveisOficiais: string[];
  proxiesAnaliticas: string[];
  ajustesComerciais: string[];
}

export interface PerfilComercialFundeb {
  score: number;
  faixa: "conservador" | "padrao" | "agressivo";
  multiplicador: number;
  confianca: number;
  metodologia: string;
  fatores: string[];
  populacaoEstimada: number | null;
  receitasBrutasMunicipais: number | null;
  fundebPerCapita: number | null;
  dependenciaFundebReceita: number | null;
  matriculasMunicipais: number;
  escolasMunicipais: number;
  educacaoInfantilMunicipal: number;
  crecheMunicipal: number;
  preEscolaMunicipal: number;
  matriculasMunicipaisPorHabitante: number | null;
  educacaoInfantilMunicipalPorHabitante: number | null;
  crecheMunicipalPorHabitante: number | null;
  vaatPercentualTotal: number;
  ieiPercentual: number | null;
  habilitacaoVaat: string;
  pendenciaVaat: string | null;
  regularizacaoPendente: boolean;
  camadaEstadual: FundebStateLayer;
}

export interface FundebRelatorioParametros {
  tituloRelatorio?: string;
  subtituloRelatorio?: string;
  responsavelTecnico?: string;
  orgaoDemandante?: string;
  secretarioEducacao?: string;
  numeroProcesso?: string;
  periodoReferencia?: string;
  cenarioAnalise?: string;
  fonteComplementar?: string;
  observacaoAnalise?: string;
  metodologiaComplementar?: string;
  camposAdicionais?: Record<string, string | number | boolean | null>;
  [key: string]: unknown;
}

export interface RelatorioFundeb {
  geradoEm: string;
  identificacao: MunicipioIdentificacao;
  parametros?: FundebRelatorioParametros;
  receitas: ReceitasFundeb;
  projecao: ProjecaoFundeb;
  projecaoRecuperavel: ProjecaoFundeb;
  projecaoComercial: ProjecaoFundeb | null;
  upsideCondicionado: UpsideCondicionadoFundeb | null;
  perfilComercial: PerfilComercialFundeb | null;
  cronogramaVAAF: CronogramaVAAF[];
  sistemas: SistemaHabilitacao[];
  obrasPAC2: ObraPAC2[];
  situacaoPAR: string;
  caminhoEscola: VeiculoCaminhoEscola[];
  pdde: RepassePDDE[];
  observacoesOperacionais: string[];
  idebAnosIniciais: IDEBDado[];
  idebAnosFinais: IDEBDado[];
  idebEnsinoMedio: IDEBDado[];
  censoEscolar: CensoEscolar | null;
}

type FonteStatus = "automatico" | "estimado" | "manual" | "indisponivel";

export interface FonteColetaStatus {
  id: string;
  label: string;
  status: FonteStatus;
  descricao: string;
}

export interface LevantamentoFundebPayload {
  relatorio: RelatorioFundeb;
  fontes: FonteColetaStatus[];
}
