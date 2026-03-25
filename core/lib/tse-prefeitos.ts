import tsePrefeitos2024 from "@/data/tse-prefeitos-2024.json";

export interface TsePrefeitoRecord {
  municipio: string;
  uf: string;
  prefeito: string;
  nomeUrna?: string;
  partido: string;
  nomeCompleto: string;
  codigoMunicipioTSE: string;
  eleicao: string;
}

const dataset2024 = tsePrefeitos2024 as Record<string, TsePrefeitoRecord>;

export function getTsePrefeitoRecord(codigoIBGE: string): TsePrefeitoRecord | null {
  const digits = codigoIBGE.replace(/\D/g, "");
  
  if (digits.length !== 7) {
    return null;
  }

  const record = dataset2024[digits];
  if (record) {
    return record;
  }

  return null;
}
