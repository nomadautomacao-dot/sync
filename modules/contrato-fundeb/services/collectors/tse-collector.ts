/**
 * TSE Collector — Busca dados do prefeito via base eleitoral local (TSE 2024)
 */
import { getTsePrefeitoRecord } from "@/core/lib/tse-prefeitos";

export interface TseCollectorResult {
  prefeitoNome: string;
  partido: string;
  nomeUrna: string;
  codigoMunicipioTSE: string;
  eleicao: string;
}

/**
 * Busca o prefeito atual do município na base local do TSE (eleição 2024).
 */
export function collectTseData(codigoIBGE: string): TseCollectorResult | null {
  try {
    const record = getTsePrefeitoRecord(codigoIBGE);

    if (!record) {
      console.warn(`[tse-collector] Prefeito não encontrado para IBGE ${codigoIBGE}`);
      return null;
    }

    return {
      prefeitoNome: record.nomeCompleto || record.prefeito || "",
      partido: record.partido || "",
      nomeUrna: record.nomeUrna || "",
      codigoMunicipioTSE: record.codigoMunicipioTSE || "",
      eleicao: record.eleicao || "2024",
    };
  } catch (error) {
    console.error("[tse-collector] Erro ao buscar prefeito:", error);
    return null;
  }
}
