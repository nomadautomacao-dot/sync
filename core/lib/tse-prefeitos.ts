import tsePrefeitos2024 from "@/data/tse-prefeitos-2024.json";

interface TsePrefeitoRecord {
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

interface TsePrefeitoMandatoContext {
  atual: TsePrefeitoRecord | null;
  classificacaoMandato: "primeiro_mandato" | "segundo_mandato" | "indefinido";
  detalheMandato: string;
}

export async function getTsePrefeitoMandatoContext(codigoIBGE: string): Promise<TsePrefeitoMandatoContext> {
  const record = getTsePrefeitoRecord(codigoIBGE);
  if (!record) {
    return {
      atual: null,
      classificacaoMandato: "indefinido",
      detalheMandato: "Dados eleitorais não localizados para este município.",
    };
  }

  // Default assumption: first mandate for 2025-2028 cycle (elected 2024)
  return {
    atual: record,
    classificacaoMandato: "primeiro_mandato",
    detalheMandato: `${record.nomeCompleto || record.prefeito} (${record.partido}), eleito(a) em ${record.eleicao || "2024"}.`,
  };
}
