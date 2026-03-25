import type { RelatorioFundeb } from "@/modules/levantamento-fundeb/types";
import { getFundebReceitasHistoricas } from "@/core/lib/fundeb-fnde";
import {
  getInepCensoMunicipalHistory,
  type InepCensoMunicipalRecord,
} from "@/core/lib/inep-censo";
import { getIdebMunicipalRecord } from "@/core/lib/ideb-municipal";
import { getQeduMunicipalIndicators } from "@/core/lib/qedu-indicators";

function formatPercent(value: number) {
  const signal = value >= 0 ? "+" : "";
  return `${signal}${value.toFixed(1).replace(".", ",")}%`;
}

function calcPercentDelta(base: number, current: number) {
  if (!base) {
    return null;
  }

  return ((current - base) / base) * 100;
}

function calcAbsoluteDelta(base: number, current: number) {
  return current - base;
}

function roundToStep(value: number, step: number) {
  if (!Number.isFinite(value) || step <= 0) {
    return 0;
  }

  return Math.round(value / step) * step;
}

function getTempoIntegralTotal(record: InepCensoMunicipalRecord | null | undefined) {
  if (!record) {
    return 0;
  }

  if (record.tempoIntegralBasicaPublica !== null && record.tempoIntegralBasicaPublica !== undefined) {
    return record.tempoIntegralBasicaPublica;
  }

  return (
    (record.tempoIntegralEducacaoInfantilPublica ?? 0) +
    (record.tempoIntegralEnsinoFundamentalPublica ?? 0) +
    (record.tempoIntegralEnsinoMedioPublica ?? 0) +
    (record.tempoIntegralEjaPublica ?? 0) +
    (record.tempoIntegralEducacaoEspecialPublica ?? 0)
  );
}

function pickCensoComparisonYears(codigoIBGE: string, exercicio: number) {
  const history = getInepCensoMunicipalHistory(codigoIBGE).sort((a, b) => a.anoReferencia - b.anoReferencia);
  const candidates = history.filter((item) => item.anoReferencia <= exercicio);

  if (candidates.length >= 2) {
    return candidates.slice(-2);
  }

  return history.slice(-2);
}

function buildMatriculasComparativas(
  primeiro: InepCensoMunicipalRecord | null,
  segundo: InepCensoMunicipalRecord | null,
) {
  if (!primeiro && !segundo) {
    return [];
  }

  return [
    {
      etapa: "Creche municipal",
      valor_ano_1: primeiro?.crecheMunicipal ?? null,
      valor_ano_2: segundo?.crecheMunicipal ?? null,
    },
    {
      etapa: "Pre-escola municipal",
      valor_ano_1: primeiro?.preEscolaMunicipal ?? null,
      valor_ano_2: segundo?.preEscolaMunicipal ?? null,
    },
    {
      etapa: "Educacao infantil municipal",
      valor_ano_1: primeiro?.educacaoInfantilMunicipal ?? null,
      valor_ano_2: segundo?.educacaoInfantilMunicipal ?? null,
    },
    {
      etapa: "Matriculas municipais",
      valor_ano_1: primeiro?.matriculasMunicipaisTotal ?? null,
      valor_ano_2: segundo?.matriculasMunicipaisTotal ?? null,
    },
    {
      etapa: "Matriculas publicas",
      valor_ano_1: primeiro?.matriculasPublicasTotal ?? primeiro?.matriculasBasicaTotal ?? null,
      valor_ano_2: segundo?.matriculasPublicasTotal ?? segundo?.matriculasBasicaTotal ?? null,
    },
    {
      etapa: "Escolas municipais",
      valor_ano_1: primeiro?.escolasMunicipaisTotal ?? null,
      valor_ano_2: segundo?.escolasMunicipaisTotal ?? null,
    },
    {
      etapa: "Docentes municipais",
      valor_ano_1: primeiro?.docentesMunicipaisTotal ?? null,
      valor_ano_2: segundo?.docentesMunicipaisTotal ?? null,
    },
    {
      etapa: "TOTAL",
      valor_ano_1: primeiro?.matriculasPublicasTotal ?? primeiro?.matriculasBasicaTotal ?? null,
      valor_ano_2: segundo?.matriculasPublicasTotal ?? segundo?.matriculasBasicaTotal ?? null,
    },
  ];
}

function buildHistoricoCenso(history: InepCensoMunicipalRecord[]) {
  return history.map((item) => ({
    ano: item.anoReferencia,
    matriculasPublicas: item.matriculasPublicasTotal ?? item.matriculasBasicaTotal,
    matriculasMunicipais: item.matriculasMunicipaisTotal,
    eja: item.ejaPublica ?? item.ejaTotal ?? 0,
    tempoIntegral: getTempoIntegralTotal(item),
    educacaoEspecial: item.educacaoEspecialPublica ?? item.educacaoEspecialTotal ?? 0,
  }));
}

function buildCenarioEstruturacao(
  relatorio: RelatorioFundeb,
  censoAtual: InepCensoMunicipalRecord | null | undefined,
) {
  const totalPublico =
    censoAtual?.matriculasPublicasTotal ??
    relatorio.censoEscolar?.totalMatriculas ??
    0;
  const matriculasMunicipais =
    censoAtual?.matriculasMunicipaisTotal ??
    relatorio.perfilComercial?.matriculasMunicipais ??
    0;
  const ejaAtual =
    censoAtual?.ejaPublica ??
    censoAtual?.ejaTotal ??
    relatorio.censoEscolar?.matriculasEtapa.eja ??
    0;
  const integralAtual =
    getTempoIntegralTotal(censoAtual) ||
    relatorio.censoEscolar?.tempoIntegral.total ||
    0;
  const especialAtual =
    censoAtual?.educacaoEspecialPublica ??
    censoAtual?.educacaoEspecialTotal ??
    relatorio.censoEscolar?.matriculasEtapa.educacaoEspecial ??
    0;

  const metaEja = Math.max(ejaAtual, roundToStep(Math.max(totalPublico * 0.23, ejaAtual * 1.7, 600), 25));
  const metaIntegral = Math.max(integralAtual, roundToStep(Math.max(totalPublico * 0.24, integralAtual * 1.55, 800), 25));
  const metaEspecial = Math.max(especialAtual, roundToStep(Math.max(totalPublico * 0.09, especialAtual * 1.12, 500), 25));

  const deltaEja = Math.max(0, metaEja - ejaAtual);
  const deltaIntegral = Math.max(0, metaIntegral - integralAtual);
  const deltaEspecial = Math.max(0, metaEspecial - especialAtual);

  const baseFinanceiraPorMatricula =
    matriculasMunicipais > 0
      ? relatorio.receitas.totalReceitas / matriculasMunicipais
      : totalPublico > 0
        ? relatorio.receitas.totalReceitas / totalPublico
        : 0;

  const pesoTecnico = deltaEja * 0.55 + deltaIntegral * 0.35 + deltaEspecial * 0.2;
  const impactoMin = pesoTecnico * baseFinanceiraPorMatricula * 0.8;
  const impactoMax = pesoTecnico * baseFinanceiraPorMatricula * 1.2;

  return {
    anoAlvo: relatorio.identificacao.exercicio + 1,
    baseAtual: {
      eja: ejaAtual,
      integral: integralAtual,
      educacaoEspecial: especialAtual,
    },
    metas: {
      eja: metaEja,
      integral: metaIntegral,
      educacaoEspecial: metaEspecial,
    },
    ganhosMatriculas: {
      eja: deltaEja,
      integral: deltaIntegral,
      educacaoEspecial: deltaEspecial,
      total: deltaEja + deltaIntegral + deltaEspecial,
    },
    impactoFinanceiroIndicativo: {
      minimo: impactoMin,
      maximo: impactoMax,
      basePorMatricula: baseFinanceiraPorMatricula,
    },
    leituraExecutiva:
      `Com agenda dirigida de EJA, tempo integral e educação especial, ${relatorio.identificacao.municipioNome} pode reverter a estagnação recente da base e entrar em ${relatorio.identificacao.exercicio + 1} com uma rede mais favorável para financiamento e leitura técnica do FUNDEB.`,
    frentes: [
      "busca ativa e reorganização da oferta de EJA com apoio territorial",
      "expansão de jornada ampliada e oficinas em escolas com capacidade de absorção",
      "qualificação cadastral e pedagógica para fortalecer educação especial e permanência",
      "consultoria Rocha Prime para monitorar Censo, sistemas FNDE e consistência da base",
    ],
  };
}

function buildQeduSnapshot(
  qeduIndicators: Awaited<ReturnType<typeof getQeduMunicipalIndicators>>,
  censoAnoBase2: InepCensoMunicipalRecord | null | undefined,
) {
  if (qeduIndicators) {
    return [
      {
        indicador: `IDEB anos iniciais (${qeduIndicators.anoReferencia})`,
        valor: qeduIndicators.anosIniciais?.idebObservado ?? null,
      },
      {
        indicador: `IDEB anos finais (${qeduIndicators.anoReferencia})`,
        valor: qeduIndicators.anosFinais?.idebObservado ?? null,
      },
      {
        indicador: `Aprovação anos iniciais (${qeduIndicators.anoReferencia})`,
        valor: qeduIndicators.anosIniciais?.taxaAprovacao ?? null,
      },
      {
        indicador: `Aprovação anos finais (${qeduIndicators.anoReferencia})`,
        valor: qeduIndicators.anosFinais?.taxaAprovacao ?? null,
      },
      {
        indicador: `Nota português anos iniciais (${qeduIndicators.anoReferencia})`,
        valor: qeduIndicators.anosIniciais?.notaPortugues ?? null,
      },
      {
        indicador: `Nota matemática anos iniciais (${qeduIndicators.anoReferencia})`,
        valor: qeduIndicators.anosIniciais?.notaMatematica ?? null,
      },
      {
        indicador: `Nota português anos finais (${qeduIndicators.anoReferencia})`,
        valor: qeduIndicators.anosFinais?.notaPortugues ?? null,
      },
      {
        indicador: `Nota matemática anos finais (${qeduIndicators.anoReferencia})`,
        valor: qeduIndicators.anosFinais?.notaMatematica ?? null,
      },
      {
        indicador: `Distorção anos iniciais (${qeduIndicators.anoReferencia})`,
        valor: qeduIndicators.distorcaoIdadeSerie?.anosIniciais ?? null,
      },
      {
        indicador: `Distorção anos finais (${qeduIndicators.anoReferencia})`,
        valor: qeduIndicators.distorcaoIdadeSerie?.anosFinais ?? null,
      },
    ].filter((item) => item.valor !== null);
  }

  const anoCensoBase2 = censoAnoBase2?.anoReferencia ?? null;

  return [
    {
      indicador: `Escolas publicas${anoCensoBase2 ? ` (${anoCensoBase2})` : ""}`,
      valor: censoAnoBase2?.escolasPublicasTotal ?? censoAnoBase2?.escolasTotal ?? null,
    },
    {
      indicador: `Docentes publicos${anoCensoBase2 ? ` (${anoCensoBase2})` : ""}`,
      valor: censoAnoBase2?.docentesPublicosTotal ?? censoAnoBase2?.docentesTotal ?? null,
    },
    {
      indicador: `Matriculas publicas${anoCensoBase2 ? ` (${anoCensoBase2})` : ""}`,
      valor: censoAnoBase2?.matriculasPublicasTotal ?? censoAnoBase2?.matriculasBasicaTotal ?? null,
    },
    {
      indicador: `Educacao infantil municipal${anoCensoBase2 ? ` (${anoCensoBase2})` : ""}`,
      valor: censoAnoBase2?.educacaoInfantilMunicipal ?? null,
    },
    {
      indicador: `Creche municipal${anoCensoBase2 ? ` (${anoCensoBase2})` : ""}`,
      valor: censoAnoBase2?.crecheMunicipal ?? null,
    },
    {
      indicador: `Pre-escola municipal${anoCensoBase2 ? ` (${anoCensoBase2})` : ""}`,
      valor: censoAnoBase2?.preEscolaMunicipal ?? null,
    },
  ].filter((item) => item.valor !== null);
}

export async function buildFundebComparativeSnapshot(relatorio: RelatorioFundeb) {
  const codigoIBGE = relatorio.identificacao.codigoIBGE;
  const exercicio = relatorio.identificacao.exercicio;
  const idebRecord = getIdebMunicipalRecord(codigoIBGE);
  const censoHistory = getInepCensoMunicipalHistory(codigoIBGE).sort((a, b) => a.anoReferencia - b.anoReferencia);
  const [receitasHistoricas, qeduIndicators] = await Promise.all([
    getFundebReceitasHistoricas(codigoIBGE, exercicio, {
      anosRetroativos: 2,
      atualOverride: {
        codigoIBGE,
        municipio: relatorio.identificacao.municipioNome,
        uf: relatorio.identificacao.uf,
        ...relatorio.receitas,
        fonte: relatorio.identificacao.fonte,
      },
    }),
    getQeduMunicipalIndicators(codigoIBGE).catch(() => null),
  ]);
  const receitaAnoBase1 = receitasHistoricas.at(-2) ?? null;
  const receitaAnoBase2 = receitasHistoricas.at(-1) ?? null;
  const [censoAnoBase1, censoAnoBase2] = pickCensoComparisonYears(codigoIBGE, exercicio);
  const matriculasComparativas = buildMatriculasComparativas(censoAnoBase1 ?? null, censoAnoBase2 ?? null);
  const historicoCenso = buildHistoricoCenso(censoHistory);
  const cenarioEstruturacao = buildCenarioEstruturacao(relatorio, censoAnoBase2);
  const deltaTotalPercent =
    receitaAnoBase1 && receitaAnoBase2
      ? calcPercentDelta(receitaAnoBase1.totalReceitas, receitaAnoBase2.totalReceitas)
      : null;
  const deltaTotalAbsolute =
    receitaAnoBase1 && receitaAnoBase2
      ? calcAbsoluteDelta(receitaAnoBase1.totalReceitas, receitaAnoBase2.totalReceitas)
      : null;

  const receitasComparativas =
    receitaAnoBase1 && receitaAnoBase2
      ? [
          {
            componente: "Contribuição de estados e municípios",
            valor_ano_1: receitaAnoBase1.receitaContribuicaoMunicipal,
            valor_ano_2: receitaAnoBase2.receitaContribuicaoMunicipal,
          },
          {
            componente: "Complementacao VAAF",
            valor_ano_1: receitaAnoBase1.complementacaoVAAF,
            valor_ano_2: receitaAnoBase2.complementacaoVAAF,
          },
          {
            componente: "Complementacao VAAT",
            valor_ano_1: receitaAnoBase1.complementacaoVAAT,
            valor_ano_2: receitaAnoBase2.complementacaoVAAT,
          },
          {
            componente: "Complementacao VAAR",
            valor_ano_1: receitaAnoBase1.complementacaoVAAR,
            valor_ano_2: receitaAnoBase2.complementacaoVAAR,
          },
          {
            componente: "Complementacao da Uniao Total",
            valor_ano_1:
              receitaAnoBase1.complementacaoVAAF +
              receitaAnoBase1.complementacaoVAAT +
              receitaAnoBase1.complementacaoVAAR,
            valor_ano_2:
              receitaAnoBase2.complementacaoVAAF +
              receitaAnoBase2.complementacaoVAAT +
              receitaAnoBase2.complementacaoVAAR,
          },
          {
            componente: "TOTAL",
            valor_ano_1: receitaAnoBase1.totalReceitas,
            valor_ano_2: receitaAnoBase2.totalReceitas,
          },
        ]
      : [];

  const anoCensoBase1 = censoAnoBase1?.anoReferencia ?? null;
  const anoCensoBase2 = censoAnoBase2?.anoReferencia ?? null;
  const qeduSnapshot = buildQeduSnapshot(qeduIndicators, censoAnoBase2);

  const textoSintese =
    receitaAnoBase1 && receitaAnoBase2
      ? `A comparação entre ${receitaAnoBase1.ano} e ${receitaAnoBase2.ano} mostra a evolução oficial da receita total do Fundeb para ${relatorio.identificacao.municipioNome}. A receita passou de ${receitaAnoBase1.totalReceitas.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })} para ${receitaAnoBase2.totalReceitas.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })}, com variação de ${deltaTotalPercent !== null ? formatPercent(deltaTotalPercent) : "-"}.`
      : `O comparativo financeiro ainda depende de séries oficiais completas para ${relatorio.identificacao.municipioNome}, mas o Sync já consolidou a base disponível para análise do exercício ${exercicio}.`;

  const textoQedu =
    qeduIndicators
      ? `A camada educacional usa divulgação oficial do INEP ${qeduIndicators.anoReferencia}, em recorte ${qeduIndicators.recorteRede.toLowerCase()}, com IDEB observado, proficiência de português e matemática, taxa de aprovação e distorção idade-série. ${idebRecord ? `O IDEB público consolidado mais recente do município segue referenciado em ${idebRecord.anoReferencia}.` : ""}`
      : anoCensoBase1 && anoCensoBase2
      ? `Na malha educacional disponível, o Sync está comparando ${anoCensoBase1} e ${anoCensoBase2} com base no Censo Escolar consolidado. Esse recorte substitui o QEdu quando o dado de proficiência ainda não foi coletado diretamente, preservando a leitura da estrutura da rede municipal.${idebRecord ? ` Como referência adicional, o IDEB público mais recente do município é ${idebRecord.anoReferencia}.` : ""}`
      : "O Censo Escolar consolidado está sendo usado como base substituta da camada QEdu enquanto a coleta direta de proficiência não é integrada ao Sync.";

  const textoMovimentos =
    receitaAnoBase1 && receitaAnoBase2 && deltaTotalAbsolute !== null
      ? `O principal movimento financeiro observado foi uma variação absoluta de ${deltaTotalAbsolute.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })} entre ${receitaAnoBase1.ano} e ${receitaAnoBase2.ano}, puxada pela composição das complementações federais e pela linha de contribuição do fundo estadual. No entanto, a leitura do Censo mostra que a base de matrículas públicas não evoluiu na mesma intensidade, abrindo espaço para uma agenda corretiva e expansiva com foco em EJA, integral e educação especial.`
      : "O principal movimento técnico desta rodada é a consolidação da série histórica oficial do Fundeb dentro do próprio Sync.";

  const textoComoEntra =
    `A Rocha Prime entra na leitura comparativa validando as bases oficiais, cruzando Censo, FNDE e indicadores territoriais para transformar histórico fraco em agenda de virada. No caso atual, a prioridade passa por oficinas, reorganização de jornada, busca ativa de EJA, saneamento cadastral e monitoramento técnico para que ${relatorio.identificacao.municipioNome} entre em ${cenarioEstruturacao.anoAlvo} com uma base mais forte e financeiramente melhor posicionada.`;

  const textoConclusao =
    receitaAnoBase1 && receitaAnoBase2 && deltaTotalAbsolute !== null
      ? `No cenário comparado, ${relatorio.identificacao.municipioNome} apresenta variação oficial de ${Math.abs(deltaTotalAbsolute).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })} entre ${receitaAnoBase1.ano} e ${receitaAnoBase2.ano}. A leitura comparativa agora não para no retrovisor: ela projeta uma agenda ${cenarioEstruturacao.anoAlvo} com meta de ${cenarioEstruturacao.metas.eja.toLocaleString("pt-BR")} matrículas em EJA e ${cenarioEstruturacao.metas.integral.toLocaleString("pt-BR")} matrículas em tempo integral. Com a Rocha Prime, a comparativa passa a defender melhora de base, ganho de indicador e faixa indicativa de ${cenarioEstruturacao.impactoFinanceiroIndicativo.minimo.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })} a ${cenarioEstruturacao.impactoFinanceiroIndicativo.maximo.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })} se a reestruturação for bem executada.` 
      : `O comparativo de ${relatorio.identificacao.municipioNome} já está preparado para receber as próximas séries oficiais, com agenda projetada de reestruturação da rede para o próximo exercício.`;

  return {
    receitasHistoricas,
    historicoRepasses: receitasHistoricas.map((item) => ({
      ano: item.ano,
      fonte: item.fonte,
      receita_total_prevista: item.totalReceitas,
      contribuicao_estados_municipios: item.receitaContribuicaoMunicipal,
      complementacao_vaaf: item.complementacaoVAAF,
      complementacao_vaat: item.complementacaoVAAT,
      complementacao_vaar: item.complementacaoVAAR,
    })),
    comparativaPdfInput: {
      ...relatorio,
      ano_base_1: receitaAnoBase1?.ano ?? exercicio - 1,
      ano_base_2: receitaAnoBase2?.ano ?? exercicio,
      receitasComparativas,
      matriculasComparativas,
      historicoCenso,
      cenarioEstruturacao,
      qeduSnapshot,
      texto_sintese: textoSintese,
      texto_qedu: textoQedu,
      texto_movimentos_relevantes: textoMovimentos,
      texto_como_rocha_prime_entra: textoComoEntra,
      texto_conclusao: textoConclusao,
    },
  };
}
