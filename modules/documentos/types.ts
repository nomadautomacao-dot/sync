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
}

export interface ContractAgentStats {
  total: number;
  preenchidoAutomatico: number;
  preenchidoIA: number;
  vazio: number;
  percentualPreenchido: number;
}
