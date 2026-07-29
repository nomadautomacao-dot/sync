/**
 * Pontualidade fiscal do ente no Siconfi — o **preditor** da habilitação VAAT.
 *
 * A habilitação ao VAAT tem uma condição só, e ela é fiscal (art. 13, §4º da
 * Lei nº 14.113/2020): dados contábeis disponíveis no Siconfi e no SIOPE até
 * 31 de agosto. O extrato de entregas do Siconfi registra a data exata em que
 * cada demonstrativo foi transmitido — então dá para responder, **antes** da
 * portaria de habilitação, se o município está construindo o próprio bloqueio.
 *
 * É a diferença entre autópsia e previsão: "você perdeu o VAAT porque a DCA
 * atrasou" contra "sua DCA está atrasada há 60 dias e o corte é 31 de agosto".
 *
 * Fonte: `apidatalake.tesouro.gov.br/ords/siconfi/tt/extrato_entregas`, com
 * `id_ente` (IBGE 7 dígitos) e `an_referencia` (exercício dos dados). A
 * resposta mistura Prefeitura e Câmara; só a Prefeitura interessa aqui.
 */

const BASE = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt/extrato_entregas";

/** Prazo da DCA municipal: 30 de abril do ano seguinte (LRF, art. 51, §1º, I). */
const DCA_MES_PRAZO = 4;
const DCA_DIA_PRAZO = 30;
/** Corte da habilitação VAAT: 31 de agosto (Lei 14.113/2020, art. 13, §4º). */
const VAAT_MES_CORTE = 8;
const VAAT_DIA_CORTE = 31;

export interface EntregaDca {
  /** Exercício a que os dados se referem. */
  exercicio: number;
  /** Data de transmissão ao Siconfi; `null` se ainda não entregue. */
  entregueEm: string | null;
  homologada: boolean;
  /** Dias além de 30/abril do ano seguinte. Zero ou negativo = no prazo. */
  diasAlemDoPrazo: number | null;
  /** `true` quando a entrega saiu depois de 31/8 — o corte do VAAT. */
  estourouCorteVaat: boolean | null;
}

export interface PontualidadeFiscal {
  fonte: string;
  consultadoEm: string;
  /** DCA dos últimos exercícios, do mais recente para o mais antigo. */
  dca: EntregaDca[];
  /** Entregas de RREO e RGF do exercício corrente já transmitidas. */
  rreoEntregues: number;
  rgfEntregues: number;
  /**
   * Leitura de risco para a próxima habilitação VAAT, só pelo lado Siconfi.
   * O outro lado do corte (SIOPE) sai de `siope-indicadores.ts` (`defasado`).
   */
  risco: "alto" | "medio" | "baixo";
}

interface ItemExtrato {
  exercicio?: number;
  instituicao?: string;
  entregavel?: string;
  periodo?: number;
  data_status?: string;
  status_relatorio?: string | null;
}

/**
 * Análise pura, separada da rede para ser testável com fixture.
 *
 * @param porExercicio itens do extrato agrupados pelo exercício de referência
 * @param exercicioAtual exercício corrente do relatório
 */
export function analisarEntregas(
  porExercicio: Record<number, ItemExtrato[]>,
  exercicioAtual: number,
  agora: Date,
): Omit<PontualidadeFiscal, "fonte" | "consultadoEm"> {
  const daPrefeitura = (itens: ItemExtrato[]) =>
    itens.filter((item) => /prefeitura/i.test(item.instituicao ?? ""));

  const dca: EntregaDca[] = [];

  // DCA dos dois exercícios encerrados. O exercício corrente não tem DCA a
  // cobrar — o prazo dela é abril do ano seguinte.
  for (const exercicio of [exercicioAtual - 1, exercicioAtual - 2]) {
    const itens = daPrefeitura(porExercicio[exercicio] ?? []);
    const item = itens.find((i) => /DCA|Balan[cç]o Anual/i.test(i.entregavel ?? ""));

    const prazo = new Date(Date.UTC(exercicio + 1, DCA_MES_PRAZO - 1, DCA_DIA_PRAZO));
    const corteVaat = new Date(Date.UTC(exercicio + 1, VAAT_MES_CORTE - 1, VAAT_DIA_CORTE));

    if (!item?.data_status) {
      // Ainda sem entrega: o atraso é contado até hoje, e o corte do VAAT só
      // está estourado se hoje já passou de 31/8 do ano seguinte ao exercício.
      const vencida = agora.getTime() > prazo.getTime();
      dca.push({
        exercicio,
        entregueEm: null,
        homologada: false,
        diasAlemDoPrazo: vencida ? Math.floor((agora.getTime() - prazo.getTime()) / 86_400_000) : null,
        estourouCorteVaat: agora.getTime() > corteVaat.getTime() ? true : null,
      });
      continue;
    }

    const entregue = new Date(item.data_status);
    dca.push({
      exercicio,
      entregueEm: item.data_status,
      homologada: item.status_relatorio === "HO",
      diasAlemDoPrazo: Math.floor((entregue.getTime() - prazo.getTime()) / 86_400_000),
      estourouCorteVaat: entregue.getTime() > corteVaat.getTime(),
    });
  }

  const doExercicioAtual = daPrefeitura(porExercicio[exercicioAtual] ?? []);
  const rreoEntregues = doExercicioAtual.filter((i) => /Resumido de Execu/i.test(i.entregavel ?? "")).length;
  const rgfEntregues = doExercicioAtual.filter((i) => /Gest[aã]o Fiscal/i.test(i.entregavel ?? "")).length;

  const ultima = dca[0];
  const anterior = dca[1];

  // Alto: o corte de 31/8 já foi estourado (ou a DCA vencida segue ausente
  // depois dele) em algum dos dois últimos ciclos — é o cenário que inabilita.
  // Médio: entregou, mas atrasada — o hábito que vira estouro no ano apertado.
  // Baixo: DCA em dia nos dois ciclos.
  const estourou = (e: EntregaDca | undefined) => e?.estourouCorteVaat === true;
  const atrasou = (e: EntregaDca | undefined) =>
    e !== undefined && e.diasAlemDoPrazo !== null && e.diasAlemDoPrazo > 0;

  const risco: PontualidadeFiscal["risco"] =
    estourou(ultima) || estourou(anterior) ? "alto" : atrasou(ultima) || atrasou(anterior) ? "medio" : "baixo";

  return { dca, rreoEntregues, rgfEntregues, risco };
}

async function consultarExercicio(codigoIBGE: string, exercicio: number): Promise<ItemExtrato[]> {
  const url = `${BASE}?id_ente=${codigoIBGE}&an_referencia=${exercicio}`;
  const resposta = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!resposta.ok) throw new Error(`Siconfi extrato_entregas HTTP ${resposta.status}`);
  const corpo = (await resposta.json()) as { items?: ItemExtrato[] };
  return corpo.items ?? [];
}

/**
 * Busca o extrato dos três exercícios relevantes e analisa. Devolve `null` em
 * qualquer falha de rede — o bloco some do relatório em vez de derrubá-lo.
 */
export async function getPontualidadeFiscal(
  codigoIBGE: string,
  exercicio: number,
): Promise<PontualidadeFiscal | null> {
  const digits = codigoIBGE.replace(/\D/g, "");
  if (digits.length !== 7) return null;

  try {
    const exercicios = [exercicio, exercicio - 1, exercicio - 2];
    const respostas = await Promise.all(exercicios.map((ano) => consultarExercicio(digits, ano)));
    const porExercicio = Object.fromEntries(exercicios.map((ano, i) => [ano, respostas[i]]));

    return {
      fonte: "Tesouro Nacional — Siconfi, extrato de entregas",
      consultadoEm: new Date().toISOString(),
      ...analisarEntregas(porExercicio, exercicio, new Date()),
    };
  } catch {
    return null;
  }
}
