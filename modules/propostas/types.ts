interface EmpresaConfig {
  nome: string;
  cnpj: string;
  endereco: string;
  cep: string;
  cidade: string;
  uf: string;
  representanteNome: string;
  representanteCargo: string;
  representanteRg: string;
  representanteCpf: string;
}

interface EscalonamentoConfig {
  nivel1LimiteSm: number;
  nivel1Percentual: number;
  nivel2LimiteSm: number;
  nivel2Percentual: number;
  nivel3Percentual: number;
  salarioMinimo: number;
}

type DocumentoEscopo = "proposta" | "minuta" | "ambos";
export type GeneroAutoridade = "masculino" | "feminino";

export interface PropostaFormData {
  escopoDocumento: DocumentoEscopo;
  codigoIbge: string;
  municipioNome: string;
  municipioUf: string;
  estadoNome: string;
  comarcaNome: string;
  destinatarioTitulo: string;
  generoAutoridade: GeneroAutoridade;
  pronomeTratamento: string;
  tituloSocialAutoridade: string;
  cargoAutoridade: string;
  nomeAutoridade: string;
  partidoAutoridade: string;
  saudacaoInicial: string;
  rgAutoridade: string;
  orgaoExpedidorAutoridade: string;
  cpfAutoridade: string;
  cnpjMunicipio: string;
  enderecoMunicipio: string;
  cepMunicipio: string;
  usarFundoEducacao: boolean;
  nomeFundoEducacao: string;
  siglaFundoEducacao: string;
  cnpjFundoEducacao: string;
  contratoNumero: string;
  inexigibilidadeNumero: string;
  processoAdministrativoNumero: string;
  dataDocumento: string;
  vigenciaEncerramento: string;
  prazoVigenciaMeses: number;
  prazoValidadePropostaDias: number;
  anoBase: number;
  anoProjetado: number;
  receitaAtual: number;
  receitaProjetada: number;
  escalonamento: EscalonamentoConfig;
  secretariaAcompanhamento: string;
  secretariaFiscalizacao: string;
  observacoesInternas: string;
}

export interface PropostaAutofillData {
  codigoIbge: string;
  municipioNome: string;
  municipioUf: string;
  estadoNome: string;
  comarcaNome: string;
  nomeAutoridade: string;
  partidoAutoridade: string;
  generoAutoridadeSugerido: GeneroAutoridade | null;
  generoAutoridadeFoiInferido: boolean;
  pronomeTratamento: string;
  tituloSocialAutoridade: string;
  cargoAutoridade: string;
  saudacaoInicial: string;
  anoBase: number;
  anoProjetado: number;
  receitaAtual: number;
  receitaProjetada: number;
  incrementoProjetado: number;
  fonteReceita: string;
  camposPendentes: string[];
  publicValidation?: PropostaPublicValidationData | null;
  publicValidationSource?: "history" | "none";
}

export type PropostaPublicValidationFieldKey =
  | "cnpjMunicipio"
  | "enderecoMunicipio"
  | "cepMunicipio"
  | "nomeFundoEducacao"
  | "siglaFundoEducacao"
  | "cnpjFundoEducacao";

export type PropostaPublicValidationStatus =
  | "validated"
  | "not_found"
  | "manual_only";

export interface PropostaPublicValidationField {
  key: PropostaPublicValidationFieldKey;
  label: string;
  value: string;
  confidence: number;
  status: PropostaPublicValidationStatus;
  sourceUrl: string;
  sourceLabel: string;
  notes: string;
}

export interface PropostaPublicValidationData {
  codigoIbge: string;
  municipioNome: string;
  municipioUf: string;
  estadoNome: string;
  validatedAt: string;
  model: string;
  summary: string;
  searchQueries: string[];
  warnings: string[];
  pendingManual: string[];
  fields: Record<PropostaPublicValidationFieldKey, PropostaPublicValidationField>;
}

