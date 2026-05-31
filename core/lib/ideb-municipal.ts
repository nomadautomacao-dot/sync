import ideb2023 from "@/data/ideb-municipal-2023.json";
import idebHistorico from "@/data/ideb-municipal-historico.json";

export interface IdebMunicipalRecord {
  codigoIBGE: string;
  anosIniciaisPublica: number | null;
  anosFinaisPublica: number | null;
  ensinoMedioPublica: number | null;
  taxaAprovacaoIniciais: number | null;
  taxaAprovacaoFinais: number | null;
  anoReferencia: number;
}

const dataset2023 = ideb2023 as Record<string, Omit<IdebMunicipalRecord, "codigoIBGE" | "anoReferencia">>;

export function getIdebMunicipalRecord(codigoIBGE: string): IdebMunicipalRecord | null {
  const digits = codigoIBGE.replace(/\D/g, "");
  
  if (digits.length !== 7) {
    return null;
  }

  const record = dataset2023[digits];
  if (record) {
    return {
      codigoIBGE: digits,
      anoReferencia: 2023,
      ...record,
    };
  }

  return null;
}

export function getIdebMetasNacionais(): {
  anosIniciais: Array<{ ano: number; meta: number }>;
  anosFinais: Array<{ ano: number; meta: number }>;
  ensinoMedio: Array<{ ano: number; meta: number }>;
} {
  return idebHistorico.metasNacionais;
}
