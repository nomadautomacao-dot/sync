import type { FndeFundebReceitas, FndeVaatContext } from "@/core/lib/fundeb-fnde";
import type { IbgeCidadeIndicators } from "@/core/lib/ibge-cidade-indicators";
import type { InepCensoMunicipalRecord } from "@/core/lib/inep-censo";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalize(value: number | null, min: number, max: number) {
  if (value === null || !Number.isFinite(value) || max <= min) {
    return 0;
  }

  return clamp((value - min) / (max - min), 0, 1);
}

function median(values: number[]) {
  const filtered = values.filter((item) => Number.isFinite(item) && item > 0).sort((a, b) => a - b);
  if (filtered.length === 0) {
    return 0;
  }

  const middle = Math.floor(filtered.length / 2);
  return filtered.length % 2 === 0 ? (filtered[middle - 1] + filtered[middle]) / 2 : filtered[middle];
}

export type MissingVaatClassification = "zero-plausivel" | "positivo-moderado" | "positivo-alto";
export type MissingVaarClassification = "zero-plausivel" | "potencial-moderado" | "potencial-alto";

interface MissingVaatProfileInput {
  populacao: number | null;
  matriculasMunicipais: number;
  educacaoInfantilMunicipal: number;
  crecheMunicipal: number;
}

interface MissingVaarProfileInput {
  populacao: number | null;
  educacaoInfantilMunicipal: number;
  crecheMunicipal: number;
  ieiPercentual: number | null;
}

export function classifyMissingVaatProfile(input: MissingVaatProfileInput): {
  classificacao: MissingVaatClassification;
  expectedVaatPct: number;
  justificativa: string;
} {
  const populacao = input.populacao;
  const matriculasPorHabitante =
    populacao && populacao > 0 ? input.matriculasMunicipais / populacao : null;
  const educacaoInfantilPorHabitante =
    populacao && populacao > 0 ? input.educacaoInfantilMunicipal / populacao : null;
  const crechePorHabitante =
    populacao && populacao > 0 ? input.crecheMunicipal / populacao : null;

  if ((populacao ?? 0) < 100_000) {
    return {
      classificacao: "zero-plausivel",
      expectedVaatPct: 0,
      justificativa: "municipio pequeno com comportamento mais aderente ao grupo legado sem VAAT material",
    };
  }

  if (
    (populacao ?? 0) >= 400_000 &&
    (populacao ?? 0) <= 600_000 &&
    (matriculasPorHabitante ?? 0) <= 0.085
  ) {
    return {
      classificacao: "positivo-moderado",
      expectedVaatPct: 0.11,
      justificativa: "faixa metropolitana intermediaria com baixa intensidade relativa da rede municipal",
    };
  }

  if (
    ((populacao ?? 0) >= 700_000 && (crechePorHabitante ?? 0) < 0.002) ||
    ((matriculasPorHabitante ?? 0) >= 0.14 && (educacaoInfantilPorHabitante ?? 0) >= 0.03)
  ) {
    return {
      classificacao: "positivo-alto",
      expectedVaatPct: 0.125,
      justificativa: "perfil aderente a municipios com VAAT material no conjunto legado",
    };
  }

  return {
    classificacao: "zero-plausivel",
    expectedVaatPct: 0,
    justificativa: "perfil mais proximo do grupo legado com VAAT zero e ganho comercial vindo do multiplicador",
  };
}

export function classifyMissingVaarProfile(input: MissingVaarProfileInput): {
  classificacao: MissingVaarClassification;
  expectedVaarPct: number;
  justificativa: string;
} {
  const populacao = input.populacao;
  const educacaoInfantilPorHabitante =
    populacao && populacao > 0 ? input.educacaoInfantilMunicipal / populacao : null;
  const crechePorHabitante =
    populacao && populacao > 0 ? input.crecheMunicipal / populacao : null;
  const iei = input.ieiPercentual ?? 0;

  if ((educacaoInfantilPorHabitante ?? 0) >= 0.03 || (crechePorHabitante ?? 0) >= 0.012 || iei >= 2) {
    return {
      classificacao: "potencial-alto",
      expectedVaarPct: 0.01,
      justificativa: "forte presenca de educacao infantil e creche, com perfil aderente a captura de VAAR",
    };
  }

  if ((educacaoInfantilPorHabitante ?? 0) >= 0.02 || (crechePorHabitante ?? 0) >= 0.006 || iei >= 1) {
    return {
      classificacao: "potencial-moderado",
      expectedVaarPct: 0.006,
      justificativa: "perfil com sinais intermediarios de potencial para condicionalidades de resultado",
    };
  }

  return {
    classificacao: "zero-plausivel",
    expectedVaarPct: 0.0025,
    justificativa: "perfil conservador, mantendo VAAR potencial em faixa residual",
  };
}

interface EstimateFundebReceitasParams {
  codigoIBGE: string;
  municipio: string;
  uf: string;
  exercicio: number;
  ibgeIndicators: IbgeCidadeIndicators | null;
  inepRecord: InepCensoMunicipalRecord | null;
  vaatContext: FndeVaatContext | null;
}

export function estimateFundebReceitas(params: EstimateFundebReceitasParams): FndeFundebReceitas | null {
  const populacao =
    params.ibgeIndicators?.populacaoEstimada ?? params.ibgeIndicators?.populacaoUltimoCenso ?? null;
  const receitasBrutasMunicipais = params.ibgeIndicators?.receitasBrutasMunicipais ?? null;
  const matriculasMunicipais = params.inepRecord?.matriculasMunicipaisTotal ?? 0;
  const educacaoInfantilMunicipal = params.inepRecord?.educacaoInfantilMunicipal ?? 0;
  const crecheMunicipal = params.inepRecord?.crecheMunicipal ?? 0;

  if (!populacao && matriculasMunicipais <= 0 && !receitasBrutasMunicipais) {
    return null;
  }

  const matriculasPorHabitante =
    populacao && populacao > 0 ? matriculasMunicipais / populacao : null;
  const educacaoInfantilPorHabitante =
    populacao && populacao > 0 ? educacaoInfantilMunicipal / populacao : null;
  const crechePorHabitante =
    populacao && populacao > 0 ? crecheMunicipal / populacao : null;

  const vaatAbsolutoOficial = params.vaatContext?.complementacaoVAAT ?? 0;
  const ieiPercentual = params.vaatContext?.ieiPercentual ?? null;
  const missingVaatProfile = classifyMissingVaatProfile({
    populacao,
    matriculasMunicipais,
    educacaoInfantilMunicipal,
    crecheMunicipal,
  });
  const missingVaarProfile = classifyMissingVaarProfile({
    populacao,
    educacaoInfantilMunicipal,
    crecheMunicipal,
    ieiPercentual,
  });

  const regimeMetropolitanoComprimido =
    (populacao ?? 0) >= 400_000 &&
    (populacao ?? 0) <= 600_000 &&
    (matriculasPorHabitante ?? 0) <= 0.085;
  const regimeEscalaMetropolitana =
    (populacao ?? 0) >= 800_000 && matriculasMunicipais >= 70_000;
  const regimePequenoIntenso =
    matriculasMunicipais > 0 &&
    matriculasMunicipais < 12_000 &&
    (matriculasPorHabitante ?? 0) >= 0.12;

  let perStudentBase =
    7_200 +
    normalize(matriculasPorHabitante, 0.06, 0.16) * 850 +
    normalize(educacaoInfantilPorHabitante, 0.01, 0.04) * 300 +
    normalize(crechePorHabitante, 0.003, 0.018) * 250 +
    (vaatAbsolutoOficial > 0 ? 350 : 0) +
    (ieiPercentual !== null ? normalize(ieiPercentual, 0.5, 3.5) * 150 : 0);

  if (regimeMetropolitanoComprimido) {
    perStudentBase = 8_250;
  } else if (regimeEscalaMetropolitana) {
    perStudentBase = 7_550;
  } else if (regimePequenoIntenso) {
    perStudentBase = 7_300;
  }

  const expectedVaatPct =
    vaatAbsolutoOficial > 0
      ? regimeMetropolitanoComprimido
        ? 0.11
        : regimeEscalaMetropolitana
          ? 0.04
          : 0.125
      : missingVaatProfile.expectedVaatPct;

  const totalCandidates: number[] = [];

  if (matriculasMunicipais > 0) {
    totalCandidates.push(matriculasMunicipais * perStudentBase);
  }

  if (populacao && populacao > 0) {
    let perCapitaBase =
      590 +
      normalize(matriculasPorHabitante, 0.06, 0.16) * 420 +
      normalize(educacaoInfantilPorHabitante, 0.01, 0.04) * 110 +
      normalize(crechePorHabitante, 0.003, 0.018) * 90 +
      (vaatAbsolutoOficial > 0 ? 70 : 0);

    if (regimePequenoIntenso) {
      perCapitaBase = 1_100;
    } else if (regimeMetropolitanoComprimido) {
      perCapitaBase = 600;
    } else if (regimeEscalaMetropolitana) {
      perCapitaBase = 660;
    }

    totalCandidates.push(populacao * perCapitaBase);
  }

  if (receitasBrutasMunicipais && receitasBrutasMunicipais > 0) {
    const dependenciaBase =
      0.15 +
      normalize(matriculasPorHabitante, 0.06, 0.16) * 0.05 +
      (vaatAbsolutoOficial > 0 ? 0.01 : 0);
    totalCandidates.push(receitasBrutasMunicipais * dependenciaBase);
  }

  if (vaatAbsolutoOficial > 0 && expectedVaatPct > 0) {
    totalCandidates.push(vaatAbsolutoOficial / expectedVaatPct);
  }

  const totalReceitas = median(totalCandidates);
  if (!totalReceitas || totalReceitas <= 0) {
    return null;
  }

  const complementacaoVAAT = vaatAbsolutoOficial > 0 ? vaatAbsolutoOficial : totalReceitas * expectedVaatPct;
  const complementacaoVAAF =
    totalReceitas *
    (regimePequenoIntenso ? 0.008 : regimeEscalaMetropolitana ? 0.004 : 0.005);
  const complementacaoVAAR = totalReceitas * missingVaarProfile.expectedVaarPct;

  const receitaContribuicaoMunicipal = Math.max(
    totalReceitas - complementacaoVAAF - complementacaoVAAT - complementacaoVAAR,
    totalReceitas * 0.7,
  );

  const totalFinal =
    receitaContribuicaoMunicipal + complementacaoVAAF + complementacaoVAAT + complementacaoVAAR;

  return {
    codigoIBGE: params.codigoIBGE,
    municipio: params.municipio,
    uf: params.uf,
    receitaContribuicaoMunicipal,
    complementacaoVAAF,
    complementacaoVAAT,
    complementacaoVAAR,
    totalReceitas: totalFinal,
    fonte: `Estimativa calibrada Sync / INEP ${params.inepRecord?.anoReferencia ?? params.exercicio - 1} / IBGE / perfil VAAT ${missingVaatProfile.classificacao} / perfil VAAR ${missingVaarProfile.classificacao} / ${params.exercicio}`,
  };
}
