import { getFundebReceitasHistoricas, getFundebReceitasOficiais } from "@/core/lib/fundeb-fnde";
import { listGoviaMunicipiosByRegionalContext } from "@/core/lib/govia-compat";
import { getIbgeCidadeIndicators } from "@/core/lib/ibge-cidade-indicators";
import { getInepCensoMunicipalHistory, type InepCensoMunicipalRecord } from "@/core/lib/inep-censo";
import { getTsePrefeitoMandatoContext } from "@/core/lib/tse-prefeitos";
import type {
  RelatorioDirigidoBenchmarkRegional,
  RelatorioDirigidoContextoPolitico,
  RelatorioDirigidoHistorico,
  RelatorioDirigidoMunicipioComparavel,
  RelatorioFundeb,
} from "@/modules/levantamento-fundeb/types";
import { formatCurrency } from "@/modules/levantamento-fundeb/utils/calculos";
import { normalizePtBrDeep } from "@/modules/levantamento-fundeb/utils/ptbr";

function getTempoIntegralTotal(record: InepCensoMunicipalRecord | null | undefined) {
  if (!record) {
    return 0;
  }

  // Prefer municipal data for FUNDEB scope
  if (record.tempoIntegralBasicaMunicipal !== null && record.tempoIntegralBasicaMunicipal !== undefined) {
    return record.tempoIntegralBasicaMunicipal;
  }

  if (record.tempoIntegralBasicaPublica !== null && record.tempoIntegralBasicaPublica !== undefined) {
    return record.tempoIntegralBasicaPublica;
  }

  return (
    (record.tempoIntegralEducacaoInfantilMunicipal ?? record.tempoIntegralEducacaoInfantilPublica ?? 0) +
    (record.tempoIntegralEnsinoFundamentalMunicipal ?? record.tempoIntegralEnsinoFundamentalPublica ?? 0) +
    (record.tempoIntegralEnsinoMedioMunicipal ?? 0) +
    (record.tempoIntegralEjaMunicipal ?? record.tempoIntegralEjaPublica ?? 0) +
    (record.tempoIntegralEducacaoEspecialMunicipal ?? record.tempoIntegralEducacaoEspecialPublica ?? 0)
  );
}

function getMandatoStrategy(
  classificacaoMandato: RelatorioDirigidoContextoPolitico["classificacaoMandato"],
  municipio: string,
) {
  if (classificacaoMandato === "primeiro_mandato") {
    return `A estratÃ©gia comercial em ${municipio} deve combinar acolhimento institucional, leitura de transiÃ§Ã£o e proposta de ganho rÃ¡pido nos dois primeiros anos do ciclo 2025-2028.`;
  }

  if (classificacaoMandato === "segundo_mandato") {
    return `A estratÃ©gia comercial em ${municipio} deve ser mais incisiva: segundo mandato consecutivo aumenta o peso de legado, eficiÃªncia e cobranÃ§a por resultado capturado.`;
  }

  return `A estratÃ©gia comercial em ${municipio} deve partir do inÃ­cio do ciclo 2025-2028, mas sem afirmar reeleiÃ§Ã£o consecutiva atÃ© que a base eleitoral anterior seja confirmada.`;
}

export async function buildDirectedPoliticalContext(relatorio: RelatorioFundeb): Promise<RelatorioDirigidoContextoPolitico> {
  const mandato = await getTsePrefeitoMandatoContext(relatorio.identificacao.codigoIBGE);
  const resumoComparativoGestao =
    mandato.classificacaoMandato === "primeiro_mandato"
      ? "O recorte comercial pode comparar os Ãºltimos anos da gestÃ£o anterior com os dois primeiros anos do ciclo iniciado em 2025."
      : mandato.classificacaoMandato === "segundo_mandato"
        ? "O recorte comercial deve tratar 2025-2026 como continuidade de gestÃ£o, reforÃ§ando cobranÃ§a por maturidade administrativa e captura de resultado."
        : "Enquanto a base local nÃ£o confirmar a eleiÃ§Ã£o de 2020, o comparativo de gestÃ£o deve ser apresentado como passagem entre o ciclo anterior e o ciclo iniciado em 2025, sem afirmar reeleiÃ§Ã£o.";

  return normalizePtBrDeep({
    prefeitoAtual: relatorio.identificacao.prefeito,
    partidoAtual: relatorio.identificacao.partido,
    eleicaoAtual: mandato.atual?.eleicao ?? "2024",
    inicioMandato: 2025,
    fimMandato: 2028,
    classificacaoMandato: mandato.classificacaoMandato,
    detalheMandato: mandato.detalheMandato,
    estrategiaComercial: getMandatoStrategy(mandato.classificacaoMandato, relatorio.identificacao.municipioNome),
    resumoComparativoGestao,
  } satisfies RelatorioDirigidoContextoPolitico);
}

export async function buildDirectedHistoricalSeries(relatorio: RelatorioFundeb): Promise<RelatorioDirigidoHistorico> {
  const receitas = await getFundebReceitasHistoricas(relatorio.identificacao.codigoIBGE, relatorio.identificacao.exercicio, {
    anosRetroativos: 3,
    atualOverride: {
      codigoIBGE: relatorio.identificacao.codigoIBGE,
      municipio: relatorio.identificacao.municipioNome,
      uf: relatorio.identificacao.uf,
      ...relatorio.receitas,
      fonte: relatorio.identificacao.fonte,
    },
  });
  const censoHistory = getInepCensoMunicipalHistory(relatorio.identificacao.codigoIBGE);
  const censoMap = new Map(censoHistory.map((item) => [item.anoReferencia, item]));
  const anoFinal = relatorio.identificacao.exercicio;
  const anos = [anoFinal - 2, anoFinal - 1, anoFinal].filter((ano, index, all) => all.indexOf(ano) === index);

  const linhas = anos.map((ano) => {
    const receita = receitas.find((item) => item.ano === ano) ?? null;
    const censo =
      censoMap.get(ano) ?? (ano === anoFinal ? (censoMap.get(2025) ?? relatorio.censoEscolar) : null);

    return {
      ano,
      anoBaseCenso:
        censo && "anoReferencia" in censo ? censo.anoReferencia : relatorio.censoEscolar?.anoReferencia ?? null,
      totalReceitasFundeb: receita?.totalReceitas ?? null,
      contribuicaoMunicipal: receita?.receitaContribuicaoMunicipal ?? null,
      complementacaoVAAF: receita?.complementacaoVAAF ?? null,
      complementacaoVAAT: receita?.complementacaoVAAT ?? null,
      complementacaoVAAR: receita?.complementacaoVAAR ?? null,
      totalMatriculas:
        censo && "matriculasMunicipaisTotal" in censo
          ? (censo.matriculasMunicipaisTotal ?? censo.matriculasPublicasTotal ?? censo.matriculasBasicaTotal)
          : relatorio.censoEscolar?.totalMatriculas ?? null,
      totalEscolas:
        censo && "escolasMunicipaisTotal" in censo
          ? (censo.escolasMunicipaisTotal ?? censo.escolasPublicasTotal ?? censo.escolasTotal)
          : relatorio.censoEscolar?.totalEscolas ?? null,
      eja:
        censo && "ejaMunicipal" in censo
          ? (censo.ejaMunicipal ?? censo.ejaPublica ?? censo.ejaTotal ?? null)
          : relatorio.censoEscolar?.matriculasEtapa.eja ?? null,
      tempoIntegral:
        censo && "tempoIntegralBasicaMunicipal" in censo
          ? getTempoIntegralTotal(censo)
          : relatorio.censoEscolar?.tempoIntegral.total ?? null,
      educacaoEspecial:
        censo && "educacaoEspecialMunicipal" in censo
          ? (censo.educacaoEspecialMunicipal ?? censo.educacaoEspecialPublica ?? censo.educacaoEspecialTotal ?? null)
          : relatorio.censoEscolar?.matriculasEtapa.educacaoEspecial ?? null,
    };
  });

  const anoInicial = linhas[0]?.ano ?? anoFinal;
  const receitaInicial = linhas[0]?.totalReceitasFundeb ?? null;
  const receitaAtual = linhas.find((item) => item.ano === anoFinal)?.totalReceitasFundeb ?? null;
  const resumo =
    receitaInicial !== null && receitaAtual !== null
      ? `A série ${anoInicial}-${anoFinal} concentra os três exercícios mais recentes com melhor consistência entre receita oficial do FUNDEB, base educacional consolidada no Sync e a última base anual disponível do Censo Escolar quando o ano corrente ainda não está fechado. No recorte atual, a receita saiu de ${formatCurrency(receitaInicial)} para ${formatCurrency(receitaAtual)}.`
      : `A série ${anoInicial}-${anoFinal} concentra os três exercícios mais recentes com melhor consistência entre receita oficial do FUNDEB e a base educacional consolidada do município.`;

  return normalizePtBrDeep({
    anos: linhas,
    resumo,
  } satisfies RelatorioDirigidoHistorico);
}

function buildRegionalCriterion(relatorio: RelatorioFundeb) {
  const parts = [
    `UF ${relatorio.identificacao.uf}`,
    relatorio.identificacao.regiaoIntermediaria !== "NÃ£o informado"
      ? `regiÃ£o intermediÃ¡ria ${relatorio.identificacao.regiaoIntermediaria}`
      : "",
    relatorio.identificacao.microrregiao !== "NÃ£o informado" ? `microrregiÃ£o ${relatorio.identificacao.microrregiao}` : "",
    "faixa populacional semelhante",
  ].filter(Boolean);
  return parts.join(" | ");
}

function buildComparableInsight(input: {
  municipio: string;
  currentMunicipio: string;
  vantagemReceita: number | null;
  vantagemComplementacao: number | null;
  mesmaFaixaPopulacional: boolean;
}) {
  const parts: string[] = [];

  if (input.mesmaFaixaPopulacional) {
    parts.push(`${input.municipio} estÃ¡ na mesma faixa populacional do municÃ­pio analisado.`);
  } else {
    parts.push(`${input.municipio} foi mantido no benchmark pela proximidade regional, ainda que a faixa populacional nÃ£o seja perfeita.`);
  }

  if (typeof input.vantagemReceita === "number" && input.vantagemReceita > 0) {
    parts.push(`Recebe ${formatCurrency(input.vantagemReceita)} a mais de FUNDEB total no exercÃ­cio atual.`);
  }

  if (typeof input.vantagemComplementacao === "number" && input.vantagemComplementacao > 0) {
    parts.push(`Tem ${formatCurrency(input.vantagemComplementacao)} a mais em complementaÃ§Ã£o da UniÃ£o.`);
  }

  parts.push(`Serve como argumento comercial para mostrar que ${input.currentMunicipio} ainda pode melhorar posicionamento tÃ©cnico e financeiro.`);
  return parts.join(" ");
}

export async function buildDirectedRegionalBenchmark(relatorio: RelatorioFundeb): Promise<RelatorioDirigidoBenchmarkRegional> {
  const currentIndicators = await getIbgeCidadeIndicators(relatorio.identificacao.municipioNome, relatorio.identificacao.uf, relatorio.identificacao.codigoIBGE).catch(
    () => null,
  );
  const currentPopulation = currentIndicators?.populacaoEstimada ?? currentIndicators?.populacaoUltimoCenso ?? null;
  const currentComplementacao =
    relatorio.receitas.complementacaoVAAF + relatorio.receitas.complementacaoVAAT + relatorio.receitas.complementacaoVAAR;

  const regionalCandidates = await listGoviaMunicipiosByRegionalContext({
    uf: relatorio.identificacao.uf,
    excludeCodigoIbge: relatorio.identificacao.codigoIBGE,
    regiaoIntermediaria: relatorio.identificacao.regiaoIntermediaria,
    microrregiao: relatorio.identificacao.microrregiao,
    mesorregiao: relatorio.identificacao.mesorregiao,
  });

  const rawCandidates = await Promise.all(
    regionalCandidates.slice(0, 14).map(async (candidate) => {
      const [indicators, receitaAtual, censoHistory] = await Promise.all([
        getIbgeCidadeIndicators(candidate.nome, candidate.uf, String(candidate.id)).catch(() => null),
        getFundebReceitasOficiais(candidate.codigo_ibge, relatorio.identificacao.exercicio).catch(() => null),
        Promise.resolve(getInepCensoMunicipalHistory(candidate.codigo_ibge)),
      ]);

      const population = indicators?.populacaoEstimada ?? indicators?.populacaoUltimoCenso ?? null;
      const totalMatriculas =
        censoHistory.at(-1)?.matriculasPublicasTotal ?? censoHistory.at(-1)?.matriculasBasicaTotal ?? null;
      const complementacaoTotal = receitaAtual
        ? receitaAtual.complementacaoVAAF + receitaAtual.complementacaoVAAT + receitaAtual.complementacaoVAAR
        : null;

      const mesmaFaixaPopulacional =
        currentPopulation && population
          ? population >= currentPopulation * 0.7 && population <= currentPopulation * 1.3
          : false;

      return {
        municipio: candidate.nome,
        uf: candidate.uf,
        codigoIbge: candidate.codigo_ibge,
        criterioRegional:
          candidate.regiaoIntermediaria === relatorio.identificacao.regiaoIntermediaria
            ? `Mesmo eixo regional: ${candidate.regiaoIntermediaria}`
            : `Mesmo estado: ${candidate.uf}`,
        populacao: population,
        mesmaFaixaPopulacional,
        totalReceitasFundeb: receitaAtual?.totalReceitas ?? null,
        totalMatriculas,
        complementacaoUniaoTotal: complementacaoTotal,
        vantagemReceita:
          receitaAtual?.totalReceitas !== undefined ? receitaAtual.totalReceitas - relatorio.receitas.totalReceitas : null,
        vantagemComplementacao:
          complementacaoTotal !== null ? complementacaoTotal - currentComplementacao : null,
      };
    }),
  );

  const municipios = rawCandidates
    .filter((item) => (item.vantagemReceita ?? 0) > 0 || (item.vantagemComplementacao ?? 0) > 0)
    .sort((a, b) => {
      const sameBandDiff = Number(b.mesmaFaixaPopulacional) - Number(a.mesmaFaixaPopulacional);
      if (sameBandDiff !== 0) {
        return sameBandDiff;
      }

      return (b.vantagemReceita ?? 0) - (a.vantagemReceita ?? 0);
    })
    .slice(0, 6)
    .map((item) => ({
      ...item,
      insight: buildComparableInsight({
        municipio: item.municipio,
        currentMunicipio: relatorio.identificacao.municipioNome,
        vantagemReceita: item.vantagemReceita,
        vantagemComplementacao: item.vantagemComplementacao,
        mesmaFaixaPopulacional: item.mesmaFaixaPopulacional,
      }),
    }));

  const resumo =
    municipios.length > 0
      ? `O benchmark regional mostra municÃ­pios vizinhos ou do mesmo eixo territorial com porte populacional semelhante e desempenho financeiro superior em FUNDEB ou complementaÃ§Ã£o da UniÃ£o. Esse bloco ajuda a quebrar a sensaÃ§Ã£o de que o municÃ­pio jÃ¡ estÃ¡ â€œbem o suficienteâ€.`
      : `NÃ£o foram localizados, nesta rodada, municÃ­pios vizinhos com superioridade clara de receita dentro da mesma faixa populacional e critÃ©rio regional adotado.`;

  return normalizePtBrDeep({
    criterio: buildRegionalCriterion(relatorio),
    resumo,
    municipios: municipios satisfies RelatorioDirigidoMunicipioComparavel[],
  } satisfies RelatorioDirigidoBenchmarkRegional);
}

