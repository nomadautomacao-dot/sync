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

export interface ProjecaoRochaPrime {
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
  natureza?: "recuperavel" | "benchmark";
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
}

export interface CensoEscolar {
  totalEscolas: number;
  totalMatriculas: number;
  totalDocentes: number;
  fonte: string;
  anoReferencia: number | null;
  recorte: "publica" | "municipal" | "total";
  matriculasEtapa: {
    educacaoInfantil: number;
    ensinoFundamental: number;
    ensinoMedio: number;
    eja: number;
    educacaoEspecial: number;
  };
  matriculasDetalhadas: {
    creche: number;
    preEscola: number;
    anosIniciais: number;
    anosFinais: number;
  };
  tempoIntegral: {
    total: number | null;
    educacaoInfantil: number | null;
    creche: number | null;
    preEscola: number | null;
    anosIniciais: number | null;
    anosFinais: number | null;
    ensinoFundamental: number | null;
    ensinoMedio: number | null;
    eja: number | null;
    educacaoEspecial: number | null;
  };
  docentesCiclo: {
    fundamentalIniciaisFinais: number;
    ensinoMedio: number;
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

export interface RelatorioFundeb {
  geradoEm: string;
  identificacao: MunicipioIdentificacao;
  receitas: ReceitasFundeb;
  projecao: ProjecaoRochaPrime;
  projecaoRecuperavel: ProjecaoRochaPrime;
  projecaoComercial: ProjecaoRochaPrime | null;
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
  censoEscolar: CensoEscolar | null;
}

export type FonteStatus = "automatico" | "estimado" | "manual" | "indisponivel";

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
