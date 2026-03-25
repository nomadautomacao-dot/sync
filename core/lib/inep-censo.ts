import censoMunicipal2025 from "@/data/inep-censo-municipal-2025.json";
import censoMunicipal2024 from "@/data/inep-censo-municipal-2024.json";
import censoMunicipal2023 from "@/data/inep-censo-municipal-2023.json";

export interface InepCensoMunicipalRecord {
  anoReferencia: number;
  codigoIBGE: string;
  municipio: string;
  uf: string;
  matriculasBasicaTotal: number;
  matriculasPublicasTotal?: number;
  matriculasMunicipaisTotal: number;
  educacaoInfantilTotal: number;
  educacaoInfantilPublica?: number;
  educacaoInfantilMunicipal: number;
  crecheTotal: number;
  crechePublica?: number;
  crecheMunicipal: number;
  preEscolaTotal: number;
  preEscolaPublica?: number;
  preEscolaMunicipal: number;
  anosIniciaisFundamentalTotal?: number;
  anosIniciaisFundamentalPublica?: number;
  anosIniciaisFundamentalMunicipal?: number;
  anosFinaisFundamentalTotal?: number;
  anosFinaisFundamentalPublica?: number;
  anosFinaisFundamentalMunicipal?: number;
  ensinoFundamentalTotal?: number;
  ensinoFundamentalPublica?: number;
  ensinoFundamentalMunicipal?: number;
  ensinoMedioTotal?: number;
  ensinoMedioPublica?: number;
  ensinoMedioMunicipal?: number;
  ejaTotal?: number;
  ejaPublica?: number;
  ejaMunicipal?: number;
  educacaoEspecialTotal?: number;
  educacaoEspecialPublica?: number;
  educacaoEspecialMunicipal?: number;
  docentesTotal: number;
  docentesPublicosTotal?: number;
  docentesMunicipaisTotal: number;
  escolasTotal: number;
  escolasPublicasTotal?: number;
  escolasMunicipaisTotal: number;
  tempoIntegralBasicaTotal?: number | null;
  tempoIntegralBasicaPublica?: number | null;
  tempoIntegralBasicaMunicipal?: number | null;
  tempoIntegralEducacaoInfantilTotal?: number;
  tempoIntegralEducacaoInfantilPublica?: number;
  tempoIntegralEducacaoInfantilMunicipal?: number;
  tempoIntegralCrecheTotal?: number;
  tempoIntegralCrechePublica?: number;
  tempoIntegralCrecheMunicipal?: number;
  tempoIntegralPreEscolaTotal?: number;
  tempoIntegralPreEscolaPublica?: number;
  tempoIntegralPreEscolaMunicipal?: number;
  tempoIntegralAnosIniciaisTotal?: number;
  tempoIntegralAnosIniciaisPublica?: number;
  tempoIntegralAnosIniciaisMunicipal?: number;
  tempoIntegralAnosFinaisTotal?: number;
  tempoIntegralAnosFinaisPublica?: number;
  tempoIntegralAnosFinaisMunicipal?: number;
  tempoIntegralEnsinoFundamentalTotal?: number;
  tempoIntegralEnsinoFundamentalPublica?: number;
  tempoIntegralEnsinoFundamentalMunicipal?: number;
  tempoIntegralEnsinoMedioTotal?: number;
  tempoIntegralEnsinoMedioPublica?: number;
  tempoIntegralEnsinoMedioMunicipal?: number;
  tempoIntegralEjaTotal?: number | null;
  tempoIntegralEjaPublica?: number | null;
  tempoIntegralEjaMunicipal?: number | null;
  tempoIntegralEducacaoEspecialTotal?: number;
  tempoIntegralEducacaoEspecialPublica?: number;
  tempoIntegralEducacaoEspecialMunicipal?: number;
  escolasInfraPublicasTotal?: number;
  escolasComAguaPotavel?: number;
  escolasComAguaPotavelPct?: number;
  escolasSemAgua?: number;
  escolasSemAguaPct?: number;
  escolasComEsgoto?: number;
  escolasComEsgotoPct?: number;
  escolasSemEsgoto?: number;
  escolasSemEsgotoPct?: number;
  escolasComCozinha?: number;
  escolasComCozinhaPct?: number;
  escolasSemCozinha?: number;
  escolasSemCozinhaPct?: number;
  escolasComInternet?: number;
  escolasComInternetPct?: number;
  escolasComBandaLarga?: number;
  escolasComBandaLargaPct?: number;
  escolasComLaboratorioInformatica?: number;
  escolasComLaboratorioInformaticaPct?: number;
  escolasComLaboratorioCiencias?: number;
  escolasComLaboratorioCienciasPct?: number;
  escolasComQuadra?: number;
  escolasComQuadraPct?: number;
  escolasComAlimentacao?: number;
  escolasComAlimentacaoPct?: number;
  escolasComAcessibilidade?: number;
  escolasComAcessibilidadePct?: number;
  escolasSemAcessibilidade?: number;
  escolasSemAcessibilidadePct?: number;
}

const dataset2025 = censoMunicipal2025 as Record<string, Omit<InepCensoMunicipalRecord, "anoReferencia">>;
const dataset2024 = censoMunicipal2024 as Record<string, Omit<InepCensoMunicipalRecord, "anoReferencia">>;
const dataset2023 = censoMunicipal2023 as Record<string, Omit<InepCensoMunicipalRecord, "anoReferencia">>;
const datasetsByYear = {
  2025: dataset2025,
  2024: dataset2024,
  2023: dataset2023,
} as const;

export function getInepCensoMunicipalRecordByYear(
  codigoIBGE: string,
  anoReferencia: 2023 | 2024 | 2025,
): InepCensoMunicipalRecord | null {
  const digits = codigoIBGE.replace(/\D/g, "");
  const dataset = datasetsByYear[anoReferencia];
  const record = dataset[digits];

  if (!record) {
    return null;
  }

  return {
    anoReferencia,
    ...record,
  };
}

export function getInepCensoMunicipalHistory(codigoIBGE: string) {
  return ([2023, 2024, 2025] as const)
    .map((anoReferencia) => getInepCensoMunicipalRecordByYear(codigoIBGE, anoReferencia))
    .filter((item): item is InepCensoMunicipalRecord => item !== null);
}

export function getInepCensoMunicipalRecord(codigoIBGE: string): InepCensoMunicipalRecord | null {
  return (
    getInepCensoMunicipalRecordByYear(codigoIBGE, 2025) ??
    getInepCensoMunicipalRecordByYear(codigoIBGE, 2024) ??
    getInepCensoMunicipalRecordByYear(codigoIBGE, 2023)
  );
}
