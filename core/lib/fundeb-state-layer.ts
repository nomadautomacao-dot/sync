export interface FundebStateLayerInput {
  uf: string;
  totalReceitas: number;
  complementacaoVAAT: number;
  populacaoEstimada: number | null;
  matriculasMunicipais: number;
}

export interface FundebStateLayer {
  uf: string;
  fundoEstadual: string;
  amostraHistorica: number;
  residuoMedioHistorico: number | null;
  dispersaoHistorica: number | null;
  ajusteMultiplicadorSugerido: number | null;
  ajusteMultiplicadorAplicado: number;
  ajusteAtivo: boolean;
  observacao: string;
  variaveisOficiais: string[];
  proxiesAnaliticas: string[];
  ajustesComerciais: string[];
}

interface StateResidualAudit {
  amostraHistorica: number;
  residuoMedioHistorico: number | null;
  dispersaoHistorica: number | null;
}

const STATE_AUDITS: Record<string, StateResidualAudit> = {
  GO: {
    amostraHistorica: 5,
    residuoMedioHistorico: 1.7,
    dispersaoHistorica: 2.19,
  },
  RJ: {
    amostraHistorica: 9,
    residuoMedioHistorico: 0.06,
    dispersaoHistorica: 0.43,
  },
  SC: {
    amostraHistorica: 1,
    residuoMedioHistorico: -0.03,
    dispersaoHistorica: 0,
  },
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function shouldActivateStateAdjustment(audit: StateResidualAudit | undefined) {
  if (!audit || audit.amostraHistorica < 4) {
    return false;
  }

  if (audit.residuoMedioHistorico === null || audit.dispersaoHistorica === null) {
    return false;
  }

  return Math.abs(audit.residuoMedioHistorico) >= 0.75 && audit.dispersaoHistorica <= 1.25;
}

export function buildFundebStateLayer(input: FundebStateLayerInput): FundebStateLayer {
  const uf = input.uf.trim().toUpperCase();
  const audit = STATE_AUDITS[uf];
  const adjustmentActive = shouldActivateStateAdjustment(audit);
  const suggestedDelta =
    adjustmentActive && audit?.residuoMedioHistorico
      ? round2(-(audit.residuoMedioHistorico / 100))
      : null;

  const fundebPerCapita =
    input.populacaoEstimada && input.populacaoEstimada > 0
      ? input.totalReceitas / input.populacaoEstimada
      : null;
  const vaatPercentualTotal =
    input.totalReceitas > 0 ? (input.complementacaoVAAT / input.totalReceitas) * 100 : 0;
  const matriculasPorHabitante =
    input.populacaoEstimada && input.populacaoEstimada > 0
      ? input.matriculasMunicipais / input.populacaoEstimada
      : null;

  const variaveisOficiais = [
    "Fundo estadual da UF (1 de 27 fundos do Fundeb)",
    "Receita total oficial do Fundeb por ente/UF",
    "VAAF e redistribuicao intraestadual",
    "VAAT oficial do ente",
    "Condicionalidade IV do VAAR ligada ao ICMS-Educacao estadual",
  ];

  const proxiesAnaliticas = [
    "FUNDEB per capita",
    "Matriculas municipais por habitante",
    "Educacao infantil por habitante",
    "Creche por habitante",
    "Receita bruta municipal como referencia de dependencia do fundo",
  ];

  const ajustesComerciais = [
    "Regimes comerciais calibrados por perfil municipal",
    "Comparacao com amostra historica validada",
    "Ajuste residual por UF apenas quando ha amostra estavel",
  ];

  let observacao = "Camada estadual considerada apenas como contexto estrutural da UF, sem correcao ativa nesta fase.";
  if (adjustmentActive && suggestedDelta !== null) {
    observacao = "Amostra estadual com desvio historico estavel; ajuste residual por UF ativado de forma controlada.";
  } else if (audit?.amostraHistorica) {
    observacao = `UF com ${audit.amostraHistorica} casos auditados; o desvio historico ainda nao e estavel o suficiente para virar correcao automatica.`;
  }

  if (vaatPercentualTotal >= 8) {
    observacao += " O peso de VAAT do ente sugere que o ambiente estadual interfere mais na leitura comercial.";
  } else if ((fundebPerCapita ?? 0) > 0 && (matriculasPorHabitante ?? 0) > 0.12) {
    observacao += " A rede municipal intensa reduz a necessidade de correcao estadual explicita.";
  }

  return {
    uf,
    fundoEstadual: `Fundo FUNDEB ${uf}`,
    amostraHistorica: audit?.amostraHistorica ?? 0,
    residuoMedioHistorico: audit?.residuoMedioHistorico ?? null,
    dispersaoHistorica: audit?.dispersaoHistorica ?? null,
    ajusteMultiplicadorSugerido: suggestedDelta,
    ajusteMultiplicadorAplicado: adjustmentActive && suggestedDelta !== null ? suggestedDelta : 0,
    ajusteAtivo: adjustmentActive && suggestedDelta !== null,
    observacao,
    variaveisOficiais,
    proxiesAnaliticas,
    ajustesComerciais,
  };
}
