import { lerJsonDeDados } from "@/core/lib/dados-arquivo";

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

type CensoPorMunicipio = Record<string, Omit<InepCensoMunicipalRecord, "anoReferencia">>;

/**
 * Os quatro Censos são 75 MB de JSON — o maior peso do projeto inteiro. Lidos
 * por `import`, o TypeScript deduzia o tipo literal dos quatro em toda checagem
 * e o `next build` deixou de caber na máquina do Cloud Build (ver
 * `core/lib/dados-arquivo.ts`).
 *
 * Sob demanda também em execução: uma consulta a um ano só carrega esse ano, em
 * vez dos quatro. O `lerJsonDeDados` guarda o que já leu, então a segunda
 * consulta ao mesmo ano não toca no disco.
 */
function censoDoAno(ano: 2022 | 2023 | 2024 | 2025): CensoPorMunicipio {
  return lerJsonDeDados<CensoPorMunicipio>(`data/inep-censo-municipal-${ano}.json`);
}

function getInepCensoMunicipalRecordByYear(
  codigoIBGE: string,
  anoReferencia: 2022 | 2023 | 2024 | 2025,
): InepCensoMunicipalRecord | null {
  const digits = codigoIBGE.replace(/\D/g, "");
  const dataset = censoDoAno(anoReferencia);
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
  return ([2022, 2023, 2024, 2025] as const)
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
