export const DOCUMENT_CATEGORIES = [
  "contrato",
  "proposta",
  "processo_administrativo",
  "parecer",
  "certidao",
  "oficio",
  "relatorio",
  "outro",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  contrato: "Contrato",
  proposta: "Proposta",
  processo_administrativo: "Processo administrativo",
  parecer: "Parecer",
  certidao: "Certidão",
  oficio: "Ofício",
  relatorio: "Relatório",
  outro: "Outro",
};

export interface CityDocument {
  id: string;
  groupId: string;
  cityId: string;
  cityName: string;
  cityUf: string;
  category: DocumentCategory;
  title: string;
  description?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  downloadUrl: string;
  contractNumber?: string;
  signedAt?: string;
  expiresAt?: string;
  createdBy: string;
  createdByName: string;
  createdAt?: string;
  source: "upload" | "generated";
  /**
   * O relatório que este arquivo complementa.
   *
   * É o que transforma um documento solto numa **análise sobre** algo: a aba de
   * Relatórios agrupa por aqui, e a linha do tempo diz "Análise anexada a
   * <relatório>" em vez de "documento anexado". Ausente no documento avulso,
   * que continua sendo o caso comum.
   */
  relatorioId?: string;
  relatorioTitulo?: string;
}

export interface CreateCityDocumentInput {
  groupId: string;
  cityId: string;
  cityName: string;
  cityUf: string;
  category: DocumentCategory;
  title: string;
  description?: string;
  contractNumber?: string;
  signedAt?: string;
  expiresAt?: string;
  createdBy: string;
  createdByName: string;
  source?: CityDocument["source"];
  relatorioId?: string;
  relatorioTitulo?: string;
}

export interface ContractAgentStats {
  total: number;
  preenchidoAutomatico: number;
  preenchidoIA: number;
  vazio: number;
  percentualPreenchido: number;
}
