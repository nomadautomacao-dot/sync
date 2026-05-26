export interface ContratoFundebIdentificacao {
  contratoNumero: string;
  dataAssinatura: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  processoNumero: string;
}

export interface ContratoFundebContratante {
  municipioNome: string;
  municipioEndereco: string;
  municipioCidade: string;
  municipioEstado: string;
  municipioCNPJ: string;
  municipioCEP: string;
  prefeitoNome: string;
  prefeitoNacionalidade: string;
  prefeitoRG: string;
  prefeitoCPF: string;
  prefeitoEndereco: string;
  prefeitoCEP: string;
  fundoMunicipalNome: string;
  fundoMunicipalEndereco: string;
  fundoMunicipalCNPJ: string;
}

export interface ContratoFundebContratado {
  empresaRazaoSocial: string;
  empresaCNPJ: string;
  empresaEndereco: string;
  empresaCidade: string;
  empresaCEP: string;
  representanteNome: string;
  representanteCPF: string;
  representanteQualificacao: string;
}

export interface ContratoFundebValor {
  valorTotal: number;
  valorMensal: number;
  quantidadeMeses: number;
  descricaoServico: string;
}

export interface ContratoFundebDotacaoOrcamentaria {
  unidadesExecutoras: string[];
  funcionais: string[];
  elementoDespesa: string;
  fontesRecursos: string[];
}

export interface ContratoFundebForo {
  comarca: string;
  estado: string;
}

export interface ContratoFundebDados {
  identificacao: ContratoFundebIdentificacao;
  contratante: ContratoFundebContratante;
  contratado: ContratoFundebContratado;
  valor: ContratoFundebValor;
  dotacaoOrcamentaria: ContratoFundebDotacaoOrcamentaria;
  foro: ContratoFundebForo;
}

export interface ContratoFundebGenerateRequest {
  municipioNome: string;
  codigoIbge?: string;
  uf?: string;
  exercicio?: number;
}

export interface ContratoFundebGenerateResponse {
  success: boolean;
  contrato?: ContratoFundebDados;
  metas?: ContratoFundebCampoMeta[];
  warnings?: string[];
  error?: string;
}

export type ContratoFundebCampoStatus =
  | "preenchido_automatico"
  | "preenchido_manual"
  | "vazio"
  | "indisponivel";

export interface ContratoFundebCampoMeta {
  campo: string;
  label: string;
  status: ContratoFundebCampoStatus;
  fonte: string;
  valor: string;
}
