/**
 * Equidade territorial — quilombolas e indígenas: o povo existe no Censo,
 * a matrícula existe no FUNDEB?
 *
 * Duas fontes cruzadas:
 *
 * - **IBGE, Censo 2022** (agregados 8176 e 8175, ao vivo): população
 *   quilombola e indígena do município, total e em idade escolar (0–14).
 *   É a primeira vez que o Censo conta quilombolas — 1,3 milhão no país.
 * - **FNDE, matrículas ponderadas** (dataset local): quantas matrículas o
 *   município declara nos segmentos quilombolas e indígenas do fundo.
 *
 * ## Por que o cruzamento vale dinheiro
 *
 * Os segmentos quilombolas e indígenas ponderam de **1,40 a 2,17** — os
 * maiores fatores do FUNDEB. Um município com centenas de crianças
 * quilombolas no Censo e **zero** matrículas nos segmentos correspondentes
 * está, quase sempre, com a condição não declarada na coleta — e o fator se
 * perde a cada exercício até a correção.
 *
 * ## O que o cruzamento NÃO afirma
 *
 * O fator segue a **localização diferenciada da escola**, não a cor da
 * matrícula: criança quilombola estudando em escola urbana comum pondera como
 * urbana comum, e isso pode ser legítimo (não haver oferta no território).
 * Por isso o sinal é uma *conferência com valor nomeado*, nunca acusação —
 * a pergunta é "existe oferta em território sem declaração de localização
 * diferenciada?", e ela se responde escola a escola, no Censo.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const BASE = "https://servicodados.ibge.gov.br/api/v3/agregados";
const ARQUIVO_PONDERADAS = join("data", "fnde", "matriculas-ponderadas-2026.json");

/** c287: Total, 0–4, 5–9, 10–14. Mesmos códigos nos dois agregados. */
const IDADES = { total: 100362, de0a4: 93070, de5a9: 93084, de10a14: 93085 };

/** Faixa dos fatores quilombola/indígena na planilha do FNDE. */
const FATOR_MINIMO = 1.4;
const FATOR_MAXIMO = 2.17;

/** População escolar mínima para o sinal — abaixo disso é ruído censitário. */
const POPULACAO_ESCOLAR_MINIMA = 30;

export interface PovoTerritorial {
  populacao: number;
  /** Recorte 0–14 — quem a rede municipal deveria estar alcançando. */
  emIdadeEscolar: number;
  /** Matrículas declaradas nos segmentos correspondentes do FUNDEB. */
  matriculasNosSegmentos: number;
  /** Matrículas nos segmentos ÷ população 0–14, em %. `null` sem população. */
  razaoAtendimento: number | null;
  /**
   * `true` quando há população escolar relevante e as matrículas nos
   * segmentos são zero ou desproporcionais a ela (< 10%). Zero é o rastro
   * clássico de condição não declarada; razão ínfima foi o caso de Manaus —
   * 15,6 mil indígenas de 0–14 e 142 matrículas nos segmentos, 0,9%.
   */
  sinalConferencia: boolean;
}

export interface EquidadeTerritorial {
  fonte: string;
  anoCenso: number;
  quilombola: PovoTerritorial;
  indigena: PovoTerritorial;
  fatorFaixa: { minimo: number; maximo: number };
}

/** Análise pura, testável com fixture. */
export function avaliarPovo(
  populacao: number,
  emIdadeEscolar: number,
  matriculasNosSegmentos: number,
): PovoTerritorial {
  const razaoAtendimento =
    emIdadeEscolar > 0
      ? Math.round((matriculasNosSegmentos / emIdadeEscolar) * 1000) / 10
      : null;

  return {
    populacao,
    emIdadeEscolar,
    matriculasNosSegmentos,
    razaoAtendimento,
    sinalConferencia:
      emIdadeEscolar >= POPULACAO_ESCOLAR_MINIMA &&
      (matriculasNosSegmentos === 0 || matriculasNosSegmentos / emIdadeEscolar < 0.1),
  };
}

interface ArquivoPonderadas {
  segmentos?: string[];
  municipios?: Record<string, { seg?: [number, number][] }>;
}

let ponderadas: ArquivoPonderadas | null | undefined;

function carregarPonderadas(): ArquivoPonderadas | null {
  if (ponderadas !== undefined) return ponderadas;
  try {
    ponderadas = JSON.parse(
      readFileSync(join(process.cwd(), ARQUIVO_PONDERADAS), "utf8"),
    ) as ArquivoPonderadas;
  } catch {
    ponderadas = null;
  }
  return ponderadas;
}

/** Matrículas do município nos segmentos cujo nome casa com o padrão. */
export function matriculasNosSegmentos(codigoIBGE: string, padrao: RegExp): number {
  const arquivo = carregarPonderadas();
  const registro = arquivo?.municipios?.[codigoIBGE.replace(/\D/g, "")];
  if (!arquivo || !registro) return 0;

  const indices = new Set<number>();
  (arquivo.segmentos ?? []).forEach((nome, indice) => {
    if (padrao.test(nome)) indices.add(indice);
  });

  return (registro.seg ?? []).reduce(
    (total, [indice, quantidade]) => (indices.has(indice) ? total + quantidade : total),
    0,
  );
}

async function consultarPopulacao(
  agregado: number,
  variavel: number,
  codigoIBGE: string,
): Promise<Map<number, number>> {
  const codigos = Object.values(IDADES).join(",");
  const url =
    `${BASE}/${agregado}/periodos/2022/variaveis/${variavel}` +
    `?localidades=N6[${codigoIBGE}]&classificacao=287[${codigos}]|2[6794]|2661[32776]`;

  const resposta = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!resposta.ok) throw new Error(`IBGE agregado ${agregado} HTTP ${resposta.status}`);

  const corpo = (await resposta.json()) as Array<{
    resultados?: Array<{
      classificacoes?: Array<{ categoria?: Record<string, string> }>;
      series?: Array<{ serie?: Record<string, string> }>;
    }>;
  }>;

  const porCodigo = new Map<number, number>();
  for (const resultado of corpo[0]?.resultados ?? []) {
    // A idade é a classificação 287; as demais vêm fixadas em Total.
    for (const classificacao of resultado.classificacoes ?? []) {
      const codigo = Number(Object.keys(classificacao.categoria ?? {})[0]);
      if (!Object.values(IDADES).includes(codigo)) continue;
      const valor = Number(resultado.series?.[0]?.serie?.["2022"]);
      if (Number.isFinite(valor)) porCodigo.set(codigo, valor);
    }
  }
  return porCodigo;
}

export async function getEquidadeTerritorial(
  codigoIBGE: string,
): Promise<EquidadeTerritorial | null> {
  const digits = codigoIBGE.replace(/\D/g, "");
  if (digits.length !== 7) return null;

  try {
    const [quilombola, indigena] = await Promise.all([
      consultarPopulacao(8176, 4709, digits),
      consultarPopulacao(8175, 350, digits),
    ]);

    const escolar = (mapa: Map<number, number>) =>
      (mapa.get(IDADES.de0a4) ?? 0) + (mapa.get(IDADES.de5a9) ?? 0) + (mapa.get(IDADES.de10a14) ?? 0);

    const povoQuilombola = avaliarPovo(
      quilombola.get(IDADES.total) ?? 0,
      escolar(quilombola),
      matriculasNosSegmentos(digits, /Quilombola/),
    );
    const povoIndigena = avaliarPovo(
      indigena.get(IDADES.total) ?? 0,
      escolar(indigena),
      matriculasNosSegmentos(digits, /Indígena/),
    );

    // Município sem nenhuma das duas populações: nada a conferir, e a página
    // não deve fingir relevância onde o Censo diz que não há.
    if (povoQuilombola.populacao === 0 && povoIndigena.populacao === 0) {
      return {
        fonte: "IBGE — Censo 2022 (agregados 8176 e 8175) × FNDE (matrículas ponderadas)",
        anoCenso: 2022,
        quilombola: povoQuilombola,
        indigena: povoIndigena,
        fatorFaixa: { minimo: FATOR_MINIMO, maximo: FATOR_MAXIMO },
      };
    }

    return {
      fonte: "IBGE — Censo 2022 (agregados 8176 e 8175) × FNDE (matrículas ponderadas)",
      anoCenso: 2022,
      quilombola: povoQuilombola,
      indigena: povoIndigena,
      fatorFaixa: { minimo: FATOR_MINIMO, maximo: FATOR_MAXIMO },
    };
  } catch {
    // IBGE fora do ar: o bloco some do relatório em vez de derrubá-lo.
    return null;
  }
}
