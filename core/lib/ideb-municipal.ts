import ideb2023 from "@/data/ideb-municipal-2023.json";
import idebHistorico from "@/data/ideb-municipal-historico.json";
import idebHistoricoMunicipiosData from "@/data/ideb-municipal-historico-municipios.json";

const idebHistoricoMunicipios = idebHistoricoMunicipiosData as Record<string, {
  anosIniciais: Array<{ ano: number; ideb: number }>;
  anosFinais: Array<{ ano: number; ideb: number }>;
}>;

export interface IdebMunicipalRecord {
  codigoIBGE: string;
  anosIniciaisPublica: number | null;
  anosFinaisPublica: number | null;
  ensinoMedioPublica: number | null;
  taxaAprovacaoIniciais: number | null;
  taxaAprovacaoFinais: number | null;
  anoReferencia: number;
}

export interface IdebHistoricoEntry {
  ano: number;
  ideb: number;
}

export interface IdebMunicipalHistorico {
  anosIniciais: IdebHistoricoEntry[];
  anosFinais: IdebHistoricoEntry[];
}

const dataset2023 = ideb2023 as Record<string, Omit<IdebMunicipalRecord, "codigoIBGE" | "anoReferencia"> & {
  historicoAnosIniciais?: Array<{ ano: number; idebObservado: number | null; metaProjetada: number | null }>;
  historicoAnosFinais?: Array<{ ano: number; idebObservado: number | null; metaProjetada: number | null }>;
}>;

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

/**
 * Returns the per-municipality historical IDEB series (2005-2023) from INEP dataset.
 */
export function getIdebMunicipalHistorico(codigoIBGE: string): IdebMunicipalHistorico | null {
  const digits = codigoIBGE.replace(/\D/g, "");
  const entry = dataset2023[digits];
  if (!entry) return null;
  
  // Also check old idebHistoricoMunicipiosData if needed, but primary is dataset2023
  const legacyEntry = idebHistoricoMunicipios[digits];
  
  const mapHistory = (history?: Array<{ano: number; idebObservado: number | null}>) => {
    if (!history) return [];
    return history
      .filter((h) => h.idebObservado != null)
      .map((h) => ({ ano: h.ano, ideb: h.idebObservado as number }));
  };

  const anosIniciais = mapHistory(entry.historicoAnosIniciais);
  const anosFinais = mapHistory(entry.historicoAnosFinais);
  
  if (anosIniciais.length === 0 && anosFinais.length === 0 && legacyEntry) {
    return {
      anosIniciais: legacyEntry.anosIniciais ?? [],
      anosFinais: legacyEntry.anosFinais ?? [],
    };
  }

  return {
    anosIniciais,
    anosFinais,
  };
}

export function getIdebMetasNacionais(): {
  anosIniciais: Array<{ ano: number; meta: number }>;
  anosFinais: Array<{ ano: number; meta: number }>;
  ensinoMedio: Array<{ ano: number; meta: number }>;
} {
  return idebHistorico.metasNacionais;
}

