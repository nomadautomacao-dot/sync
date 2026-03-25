export interface EmpresaConfig {
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

export interface EscalonamentoConfig {
  nivel1LimiteSm: number;
  nivel1Percentual: number;
  nivel2LimiteSm: number;
  nivel2Percentual: number;
  nivel3Percentual: number;
  salarioMinimo: number;
}

export type DocumentoEscopo = "proposta" | "minuta" | "ambos";
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

export const DEFAULT_EMPRESA_CONFIG: EmpresaConfig = {
  nome: "ROCHA PRIME SERVIÇOS ESPECIALIZADOS LTDA",
  cnpj: "29.342.691/0001-93",
  endereco: "Rua Planalto, 305, Sandra Regina",
  cep: "47.802-064",
  cidade: "Barreiras",
  uf: "BA",
  representanteNome: "Paulo Ferreira da Rocha",
  representanteCargo: "Sócio Administrador",
  representanteRg: "984391703 SSP/BA",
  representanteCpf: "014.815.995-85",
};

export const DEFAULT_PROPOSTA_FORM_DATA: PropostaFormData = {
  escopoDocumento: "ambos",
  codigoIbge: "",
  municipioNome: "",
  municipioUf: "",
  estadoNome: "",
  comarcaNome: "",
  destinatarioTitulo: "Prefeitura Municipal de",
  generoAutoridade: "masculino",
  pronomeTratamento: "Exmo.",
  tituloSocialAutoridade: "Sr.",
  cargoAutoridade: "Prefeito Municipal",
  nomeAutoridade: "",
  partidoAutoridade: "",
  saudacaoInicial: "Prezado Prefeito,",
  rgAutoridade: "",
  orgaoExpedidorAutoridade: "",
  cpfAutoridade: "",
  cnpjMunicipio: "",
  enderecoMunicipio: "",
  cepMunicipio: "",
  usarFundoEducacao: false,
  nomeFundoEducacao: "FUNDO MUNICIPAL DE EDUCAÇÃO",
  siglaFundoEducacao: "FME",
  cnpjFundoEducacao: "",
  contratoNumero: "000/2026",
  inexigibilidadeNumero: "000/2026",
  processoAdministrativoNumero: "000/2026",
  dataDocumento: new Date().toISOString().slice(0, 10),
  vigenciaEncerramento: "2026-12-31",
  prazoVigenciaMeses: 48,
  prazoValidadePropostaDias: 60,
  anoBase: 2026,
  anoProjetado: 2027,
  receitaAtual: 100000000,
  receitaProjetada: 170000000,
  escalonamento: {
    nivel1LimiteSm: 200,
    nivel1Percentual: 20,
    nivel2LimiteSm: 2000,
    nivel2Percentual: 10,
    nivel3Percentual: 8,
    salarioMinimo: 1621,
  },
  secretariaAcompanhamento: "Secretaria Municipal de Educação",
  secretariaFiscalizacao: "Secretaria Municipal de Administração",
  observacoesInternas: "",
};
