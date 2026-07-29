/**
 * Demografia educacional — a rede de 2030 já nasceu.
 *
 * Duas fontes do IBGE, consultadas ao vivo na geração:
 *
 * - **Censo 2022, população por idade ano a ano** (agregado 9514): quantas
 *   crianças existem hoje em cada faixa que a rede atende — creche (0–3),
 *   pré-escola (4–5), anos iniciais (6–10) e finais (11–14).
 * - **Registro Civil, nascidos vivos** (agregado 2612): as coortes que ainda
 *   não chegaram à escola. Quem nasceu em 2024 entra na pré-escola em 2028 e
 *   no 1º ano em 2030 — a matrícula ponderada do futuro, com anos de
 *   antecedência.
 *
 * ## Por que entra num relatório de FUNDEB
 *
 * A receita do fundo segue a matrícula, e a matrícula segue o nascimento com
 * atraso fixo. Nascimento em queda significa base do fundo encolhendo em data
 * conhecida — e nenhuma outra página do relatório fala do exercício de 2028.
 * É também o denominador honesto da cobertura de creche: sem a população da
 * faixa, "X matrículas de creche" não diz se a rede atende metade ou um décimo
 * da demanda.
 */

const BASE = "https://servicodados.ibge.gov.br/api/v3/agregados";

/** Códigos de categoria do agregado 9514 (idade ano a ano, Censo 2022). */
const IDADE_CODIGOS: Record<string, number[]> = {
  // 6557 = "menos de 1 ano"; 6558..6571 = 1 a 14 anos.
  creche: [6557, 6558, 6559, 6560],
  preEscola: [6561, 6562],
  anosIniciais: [6563, 6564, 6565, 6566, 6567],
  anosFinais: [6568, 6569, 6570, 6571],
};

/** Defasagem escolar: nascido no ano N entra na pré aos 4 e no 1º ano aos 6. */
const ANOS_ATE_PRE_ESCOLA = 4;
const ANOS_ATE_PRIMEIRO_ANO = 6;

export interface CoorteNascimento {
  anoNascimento: number;
  nascidos: number;
  chegaPreEscolaEm: number;
  chegaPrimeiroAnoEm: number;
}

export interface DemografiaEducacional {
  fonte: string;
  anoCenso: number;
  /** População residente por faixa educacional (Censo 2022). */
  faixas: {
    creche: number;
    preEscola: number;
    anosIniciais: number;
    anosFinais: number;
  };
  /** Nascidos vivos por ano, do mais antigo para o mais recente. */
  nascimentos: CoorteNascimento[];
  /**
   * Variação entre a primeira e a última coorte, em %. Negativa = base do
   * fundo encolhendo em data conhecida.
   */
  tendenciaNascimentosPct: number | null;
  /**
   * Nascimentos de mães de até 19 anos, no ano mais recente da série. É um
   * dos maiores preditores de evasão feminina no médio e no EJA — e cada mãe
   * adolescente é também demanda de creche batendo na porta da mesma rede
   * que ela precisaria frequentar.
   */
  maesAdolescentes: {
    ano: number;
    nascimentos: number;
    percentualDoTotal: number;
  } | null;
}

/**
 * Análise pura, separada da rede para ser testável com fixture.
 */
export function montarDemografia(
  populacaoPorCodigo: Map<number, number>,
  nascimentosPorAno: Map<number, number>,
  maesJovensPorAno: Map<number, number> = new Map(),
): Omit<DemografiaEducacional, "fonte" | "anoCenso"> | null {
  const soma = (codigos: number[]) =>
    codigos.reduce((total, codigo) => total + (populacaoPorCodigo.get(codigo) ?? 0), 0);

  const faixas = {
    creche: soma(IDADE_CODIGOS.creche),
    preEscola: soma(IDADE_CODIGOS.preEscola),
    anosIniciais: soma(IDADE_CODIGOS.anosIniciais),
    anosFinais: soma(IDADE_CODIGOS.anosFinais),
  };

  const nascimentos: CoorteNascimento[] = [...nascimentosPorAno.entries()]
    .filter(([, total]) => total > 0)
    .sort(([a], [b]) => a - b)
    .map(([ano, total]) => ({
      anoNascimento: ano,
      nascidos: total,
      chegaPreEscolaEm: ano + ANOS_ATE_PRE_ESCOLA,
      chegaPrimeiroAnoEm: ano + ANOS_ATE_PRIMEIRO_ANO,
    }));

  const temPopulacao = Object.values(faixas).some((v) => v > 0);
  if (!temPopulacao && nascimentos.length === 0) return null;

  const primeira = nascimentos[0];
  const ultima = nascimentos[nascimentos.length - 1];
  const tendenciaNascimentosPct =
    nascimentos.length >= 2 && primeira.nascidos > 0
      ? Math.round(((ultima.nascidos - primeira.nascidos) / primeira.nascidos) * 1000) / 10
      : null;

  // Mães adolescentes do ano mais recente que tem as duas séries — o
  // percentual só faz sentido sobre o total do mesmo ano.
  let maesAdolescentes: DemografiaEducacional["maesAdolescentes"] = null;
  if (ultima) {
    const doAno = maesJovensPorAno.get(ultima.anoNascimento);
    if (doAno !== undefined && ultima.nascidos > 0) {
      maesAdolescentes = {
        ano: ultima.anoNascimento,
        nascimentos: doAno,
        percentualDoTotal: Math.round((doAno / ultima.nascidos) * 1000) / 10,
      };
    }
  }

  return { faixas, nascimentos, tendenciaNascimentosPct, maesAdolescentes };
}

async function consultarJson(url: string): Promise<unknown> {
  const resposta = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!resposta.ok) throw new Error(`IBGE agregados HTTP ${resposta.status}`);
  return resposta.json();
}

interface SerieAgregado {
  resultados?: Array<{
    classificacoes?: Array<{ categoria?: Record<string, string> }>;
    series?: Array<{ serie?: Record<string, string> }>;
  }>;
}

export async function getDemografiaEducacional(
  codigoIBGE: string,
): Promise<DemografiaEducacional | null> {
  const digits = codigoIBGE.replace(/\D/g, "");
  if (digits.length !== 7) return null;

  try {
    const codigos = Object.values(IDADE_CODIGOS).flat();
    const anoAtual = new Date().getFullYear();
    const periodos = Array.from({ length: 6 }, (_, i) => anoAtual - 6 + i).join("|");

    // c240 é a idade da mãe: 0 = total, 5370 = menos de 15, 5414 = 15 a 19.
    // Pedir as três na mesma chamada evita uma segunda viagem ao IBGE.
    const [populacaoBruta, nascimentosBruta] = (await Promise.all([
      consultarJson(
        `${BASE}/9514/periodos/2022/variaveis/93?localidades=N6[${digits}]&classificacao=287[${codigos.join(",")}]`,
      ),
      consultarJson(
        `${BASE}/2612/periodos/${periodos}/variaveis/218?localidades=N6[${digits}]&classificacao=240[0,5370,5414]`,
      ),
    ])) as [SerieAgregado[], SerieAgregado[]];

    const populacaoPorCodigo = new Map<number, number>();
    for (const resultado of populacaoBruta[0]?.resultados ?? []) {
      // A categoria vem como { "<codigo>": "<rótulo>" } dentro da classificação 287.
      const categoria = resultado.classificacoes?.find((c) => c.categoria)?.categoria ?? {};
      const codigo = Number(Object.keys(categoria)[0]);
      const valor = Number(resultado.series?.[0]?.serie?.["2022"]);
      if (Number.isFinite(codigo) && Number.isFinite(valor)) populacaoPorCodigo.set(codigo, valor);
    }

    const nascimentosPorAno = new Map<number, number>();
    const maesJovensPorAno = new Map<number, number>();
    for (const resultado of nascimentosBruta[0]?.resultados ?? []) {
      const categoria = resultado.classificacoes?.find((c) => c.categoria)?.categoria ?? {};
      const codigoIdadeMae = Number(Object.keys(categoria)[0] ?? 0);
      const serie = resultado.series?.[0]?.serie ?? {};
      for (const [ano, valor] of Object.entries(serie)) {
        const numero = Number(valor);
        if (!Number.isFinite(numero)) continue;
        if (codigoIdadeMae === 0) {
          nascimentosPorAno.set(Number(ano), numero);
        } else {
          // 5370 (menos de 15) e 5414 (15 a 19) somam as mães de até 19.
          maesJovensPorAno.set(Number(ano), (maesJovensPorAno.get(Number(ano)) ?? 0) + numero);
        }
      }
    }

    const analise = montarDemografia(populacaoPorCodigo, nascimentosPorAno, maesJovensPorAno);
    if (!analise) return null;

    return {
      fonte: "IBGE — Censo 2022 (população por idade) e Registro Civil (nascidos vivos)",
      anoCenso: 2022,
      ...analise,
    };
  } catch {
    // IBGE fora do ar: o bloco some do relatório em vez de derrubar a geração.
    return null;
  }
}
