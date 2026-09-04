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

import type { VersaoDoDocumento } from "@/core/domain/documento-versoes";

export type { VersaoDoDocumento };

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
  /**
   * A iniciativa a que este arquivo pertence: a capacitação, o projeto.
   *
   * Mesmo papel de `relatorioId` um nível acima — aquele diz *sobre qual
   * relatório* o arquivo fala; este diz *de qual assunto da cidade* ele é. O
   * cartaz e o certificado da capacitação de outubro chegam por aqui, e é o
   * que os junta ao que a linha do tempo já conta sobre ela.
   */
  iniciativaId?: string;
  /**
   * A versão vigente. Ausente em documento anterior a este campo: é a 1.
   * Os campos de arquivo acima são sempre os da versão vigente.
   */
  versao?: number;
  /** As versões que já foram substituídas. Nenhuma é apagada do Storage. */
  versoesAnteriores?: VersaoDoDocumento[];
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
  iniciativaId?: string;
}

export interface ContractAgentStats {
  total: number;
  preenchidoAutomatico: number;
  preenchidoIA: number;
  vazio: number;
  percentualPreenchido: number;
}
