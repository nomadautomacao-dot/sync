export const CITY_REPORT_TYPES = [
  "raio_x",
  "diagnostico_fundeb",
  "historico_censo",
  "oficio_documentos",
  "dossie_escolas",
  "dossie_conformidade",
  "dossie_matricula",
  "dossie_dinheiro",
] as const;

export type CityReportType = (typeof CITY_REPORT_TYPES)[number];

export const CITY_REPORT_TYPE_LABELS: Record<CityReportType, string> = {
  raio_x: "Raio-X Municipal",
  diagnostico_fundeb: "Diagnóstico FUNDEB",
  historico_censo: "Histórico do Censo Escolar",
  oficio_documentos: "Ofício de solicitação de documentos",
  dossie_escolas: "Dossiê das Escolas",
  dossie_conformidade: "Dossiê da Conformidade",
  dossie_matricula: "Dossiê da Matrícula Ponderada",
  dossie_dinheiro: "Dossiê do Dinheiro Federal",
};

export interface GeneratedReportArchive {
  schemaVersion: 1;
  generationId: string;
  reportType: CityReportType;
  generatedAt: string;
  exercise: number;
  municipality: {
    name: string;
    uf: string;
    codigoIbge: string;
  };
  /**
   * `primary` é o envelope exato que alimentou o documento. `context` guarda
   * bases adicionais exclusivas do gerador, como ano-base e Perfil Municipal.
   */
  data: {
    primary: Record<string, unknown>;
    context?: Record<string, unknown>;
  };
}

export interface GeneratedReportBundle {
  schemaVersion: 1;
  fileName: string;
  mimeType: "application/pdf";
  pdfBase64: string;
  archive: GeneratedReportArchive;
}

export interface CityReportSnapshot {
  /**
   * Versão 3 preserva o envelope exato da geração e o contexto adicional do
   * documento. Os campos abaixo continuam disponíveis para abrir relatórios
   * antigos sem migração.
   */
  schemaVersion?: 1 | 2 | 3;
  generation?: Omit<GeneratedReportArchive, "data">;
  generationContext?: Record<string, unknown>;
  identificacao?: Record<string, unknown>;
  projecao?: Record<string, unknown>;
  projecaoRecuperavel?: Record<string, unknown>;
  censoEscolar?: Record<string, unknown>;
  perfilComercial?: Record<string, unknown>;
  reportData?: Record<string, unknown>;
  sourcePayload?: Record<string, unknown>;
  opportunities?: unknown[];
  municipalityData?: Record<string, unknown>;
  additionalData?: Record<string, unknown>;
}

export interface CityReport {
  id: string;
  groupId: string;
  cityId: string;
  cityName: string;
  cityUf: string;
  codigoIbge: string;
  type: CityReportType;
  title: string;
  exercise: number;
  status: "ready";
  snapshot?: CityReportSnapshot;
  generationId?: string;
  snapshotBytes?: number;
  documentId?: string;
  downloadUrl?: string;
  fileName?: string;
  generatedBy: string;
  generatedByName: string;
  generatedAt?: string;
}

export interface CreateCityReportInput {
  groupId: string;
  cityId: string;
  cityName: string;
  cityUf: string;
  codigoIbge: string;
  type: CityReportType;
  title: string;
  exercise: number;
  snapshot: CityReportSnapshot;
  generationId: string;
  documentId?: string;
  downloadUrl?: string;
  fileName?: string;
  generatedBy: string;
  generatedByName: string;
}
