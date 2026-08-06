import { lerJsonDeDados } from "@/core/lib/dados-arquivo";

type IdebHistoricoMunicipios = Record<string, {
  anosIniciais: Array<{ ano: number; ideb: number }>;
  anosFinais: Array<{ ano: number; ideb: number }>;
}>;

/* Lido em execução, não por `import`: o dataset de 2023 tem 11 MB e o
 * TypeScript deduzia o tipo literal dele a cada checagem. Ver
 * `core/lib/dados-arquivo.ts` para o custo medido. */
function idebHistoricoMunicipios(): IdebHistoricoMunicipios {
  return lerJsonDeDados<IdebHistoricoMunicipios>("data/ideb-municipal-historico-municipios.json");
}

interface IdebMunicipalRecord {
  codigoIBGE: string;
  anosIniciaisPublica: number | null;
  anosFinaisPublica: number | null;
  ensinoMedioPublica: number | null;
  taxaAprovacaoIniciais: number | null;
  taxaAprovacaoFinais: number | null;
  anoReferencia: number;
}

interface IdebHistoricoEntry {
  ano: number;
  ideb: number;
}

interface IdebMunicipalHistorico {
  anosIniciais: IdebHistoricoEntry[];
  anosFinais: IdebHistoricoEntry[];
}

type IdebDataset2023 = Record<string, Omit<IdebMunicipalRecord, "codigoIBGE" | "anoReferencia"> & {
  historicoAnosIniciais?: Array<{ ano: number; idebObservado: number | null; metaProjetada: number | null }>;
  historicoAnosFinais?: Array<{ ano: number; idebObservado: number | null; metaProjetada: number | null }>;
}>;

function dataset2023(): IdebDataset2023 {
  return lerJsonDeDados<IdebDataset2023>("data/ideb-municipal-2023.json");
}

export function getIdebMunicipalRecord(codigoIBGE: string): IdebMunicipalRecord | null {
  const digits = codigoIBGE.replace(/\D/g, "");
  
  if (digits.length !== 7) {
    return null;
  }

  const record = dataset2023()[digits];
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
  const entry = dataset2023()[digits];
  if (!entry) return null;
  
  // Also check old idebHistoricoMunicipiosData if needed, but primary is dataset2023
  const legacyEntry = idebHistoricoMunicipios()[digits];
  
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

interface MetasNacionais {
  anosIniciais: Array<{ ano: number; meta: number }>;
  anosFinais: Array<{ ano: number; meta: number }>;
  ensinoMedio: Array<{ ano: number; meta: number }>;
}

export function getIdebMetasNacionais(): MetasNacionais {
  return lerJsonDeDados<{ metasNacionais: MetasNacionais }>("data/ideb-municipal-historico.json").metasNacionais;
}

