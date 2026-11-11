/**
 * Metas de matrícula do cenário de estruturação — medidas, não escolhidas.
 *
 * Esta regra já teve duas versões, e as duas erravam pelo mesmo motivo: eram
 * número de mesa. A primeira tirava a meta do tamanho da rede pública inteira
 * (EJA a 23% dela: Senador Canedo/GO ia de 625 para 7.800 matrículas). A
 * segunda trocou isso por percentuais "razoáveis" — +25% de EJA, +10% de
 * educação especial — que ninguém tinha medido. Conferidos contra o país, o de
 * EJA estava acima do que três em cada quatro redes fazem, e o de educação
 * especial abaixo do que a rede mediana faz sozinha.
 *
 * Aqui a meta é o que as redes municipais do país **de fato fizeram** de um
 * Censo para o seguinte, por porte da base:
 *
 * - **padrão** — o 3º quartil: o que uma em cada quatro redes alcançou;
 * - **acelerado** — o 9º decil: o que uma em cada dez alcançou.
 *
 * Medido nas transições 2023→2024 e 2024→2025 do Censo (`inep-censo`). **O
 * Censo de 2022 fica de fora**: a base local daquele ano conta EJA e educação
 * especial por outro critério — a EJA municipal do país "dobra" de 2022 para
 * 2023, o que não aconteceu —, e incluí-lo inflava todos os quantis.
 * `fundeb-cenario-metas.test.ts` refaz a medição e falha se a tabela abaixo
 * sair de perto dela: quando entrar o Censo de 2026, é o teste que avisa.
 *
 * A página imprime a regra ao lado da meta. Meta sem critério é palpite.
 */

export interface Ritmo {
  /** Crescimento em um ano que uma em cada quatro redes alcançou. */
  padrao: number;
  /** Crescimento em um ano que uma em cada dez redes alcançou. */
  acelerado: number;
}

/** Abaixo disso a base é pequena demais para ter ritmo medido — e para prometer. */
export const BASE_MINIMA = 50;

/** Faixas de porte da base, em matrículas. O ritmo cai muito com o tamanho. */
export const FAIXAS_DE_PORTE = [
  { ate: 200, rotulo: "até 200 matrículas" },
  { ate: 1000, rotulo: "de 200 a 1.000 matrículas" },
  { ate: Number.POSITIVE_INFINITY, rotulo: "mais de 1.000 matrículas" },
] as const;

/**
 * EJA municipal. A mediana é **negativa** em todos os portes (−7% a −9% ao
 * ano): a modalidade encolhe no país, e rede grande que não perde matrícula já
 * está no quartil de cima.
 */
export const RITMO_EJA: readonly Ritmo[] = [
  { padrao: 0.19, acelerado: 0.59 },
  { padrao: 0.09, acelerado: 0.31 },
  { padrao: 0.0, acelerado: 0.14 },
];

/** Educação especial. Cresce em toda parte: a rede mediana faz +19% ao ano. */
export const RITMO_ESPECIAL: readonly Ritmo[] = [
  { padrao: 0.34, acelerado: 0.53 },
  { padrao: 0.28, acelerado: 0.4 },
  { padrao: 0.26, acelerado: 0.34 },
];

/** Tempo integral, em fração da rede municipal ganha em um ano. Não varia com o ponto de partida. */
export const RITMO_INTEGRAL: Ritmo = { padrao: 0.05, acelerado: 0.11 };

/**
 * Quanto cada matrícula a mais acrescenta em matrícula-equivalente, pela tabela
 * de ponderação do fundo: EJA entra com fator 1,00; jornada integral soma a
 * diferença para a parcial (1,50 contra 1,00–1,10 no fundamental); educação
 * especial pondera 1,40 contra 1,00. Ficam de fora os acréscimos de campo e de
 * quilombola e a dupla matrícula do AEE — a conta erra para baixo.
 */
export const ACRESCIMO_DE_FATOR = { eja: 1.0, integral: 0.4, educacaoEspecial: 0.4 } as const;

export interface BaseCenario {
  /** Matrículas da rede municipal — o denominador do tempo integral. */
  matriculasMunicipais: number;
  eja: number;
  integral: number;
  educacaoEspecial: number;
}

export interface FrenteCenario {
  base: number;
  /** Meta de um ano, no ritmo padrão. */
  meta: number;
  ganho: number;
  /** Meta de um ano, no ritmo acelerado. */
  metaAcelerada: number;
  ganhoAcelerado: number;
  /** Três anos seguidos no ritmo padrão. */
  metaTresAnos: number;
  ganhoTresAnos: number;
  /** A regra que gerou a meta, pronta para impressão. */
  criterio: string;
}

export interface MetasCenario {
  eja: FrenteCenario;
  integral: FrenteCenario;
  educacaoEspecial: FrenteCenario;
}

export type Horizonte = "padrao" | "acelerado" | "tresAnos";

/** Meta em múltiplo de 5 — precisão de unidade numa projeção é falsa precisão. */
function arredondar(valor: number): number {
  return Math.round(valor / 5) * 5;
}

const pct = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;

function faixaDe(base: number): number {
  return FAIXAS_DE_PORTE.findIndex((f) => base < f.ate);
}

/** Aplica o ritmo padrão `anos` vezes, trocando de faixa à medida que a base cresce. */
function compor(base: number, tabela: readonly Ritmo[], anos: number): number {
  let atual = base;
  for (let i = 0; i < anos; i++) atual *= 1 + tabela[faixaDe(atual)].padrao;
  return atual;
}

function montar(base: number, padrao: number, acelerado: number, tresAnos: number, criterio: string): FrenteCenario {
  const b = Math.max(0, Math.round(base));
  // Meta nunca fica abaixo da base: o cenário é de estruturação, não de corte.
  // E ritmo zero é meta igual à base, ao pé da letra — arredondar 4.618 para
  // 4.620 criava um "ganho" de 2 matrículas que nenhuma regra tinha pedido.
  const alvo = (v: number, piso: number) => (v - b < 1 ? piso : Math.max(piso, arredondar(v)));
  const meta = alvo(padrao, b);
  const metaAcelerada = alvo(acelerado, meta);
  const metaTresAnos = alvo(tresAnos, meta);
  return {
    base: b,
    meta,
    ganho: meta - b,
    metaAcelerada,
    ganhoAcelerado: metaAcelerada - b,
    metaTresAnos,
    ganhoTresAnos: metaTresAnos - b,
    criterio,
  };
}

function porPorte(base: number, tabela: readonly Ritmo[], nome: string, semBase: string): FrenteCenario {
  // Sem base medida não há ritmo a aplicar, e abrir oferta do zero é decisão de
  // política da rede, não meta de consultoria.
  if (base < BASE_MINIMA) return montar(base, base, base, base, semBase);
  const faixa = faixaDe(base);
  const ritmo = tabela[faixa];
  const criterio =
    ritmo.padrao > 0
      ? `+${pct(ritmo.padrao)} no ano: o que uma em cada quatro redes com ${nome} deste porte (${FAIXAS_DE_PORTE[faixa].rotulo}) fez de um Censo para o outro`
      : `redes com ${nome} deste porte (${FAIXAS_DE_PORTE[faixa].rotulo}) não cresceram nem no quartil de cima; uma em cada dez fez +${pct(ritmo.acelerado)}`;
  return montar(base, base * (1 + ritmo.padrao), base * (1 + ritmo.acelerado), compor(base, tabela, 3), criterio);
}

export function calcularMetasCenario(b: BaseCenario): MetasCenario {
  const rede = Math.max(0, b.matriculasMunicipais);
  const teto = (v: number) => Math.min(v, Math.max(rede, b.integral));

  return {
    eja: porPorte(b.eja, RITMO_EJA, "EJA", "sem oferta de EJA relevante declarada na rede municipal"),
    integral:
      rede <= 0
        ? montar(b.integral, b.integral, b.integral, b.integral, "rede municipal não dimensionada no Censo")
        : montar(
            b.integral,
            teto(b.integral + RITMO_INTEGRAL.padrao * rede),
            teto(b.integral + RITMO_INTEGRAL.acelerado * rede),
            teto(b.integral + 3 * RITMO_INTEGRAL.padrao * rede),
            `+${pct(RITMO_INTEGRAL.padrao)} da rede no ano: o que uma em cada quatro redes municipais ganhou em jornada integral`,
          ),
    educacaoEspecial: porPorte(
      b.educacaoEspecial,
      RITMO_ESPECIAL,
      "educação especial",
      "sem matrícula de educação especial relevante declarada",
    ),
  };
}

const CAMPO_DO_GANHO: Record<Horizonte, "ganho" | "ganhoAcelerado" | "ganhoTresAnos"> = {
  padrao: "ganho",
  acelerado: "ganhoAcelerado",
  tresAnos: "ganhoTresAnos",
};

export function matriculasDoCenario(m: MetasCenario, horizonte: Horizonte): number {
  const campo = CAMPO_DO_GANHO[horizonte];
  return m.eja[campo] + m.integral[campo] + m.educacaoEspecial[campo];
}

/** Matrículas-equivalentes que o cenário acrescenta, pelo fator de cada frente. */
export function equivalentesDoCenario(m: MetasCenario, horizonte: Horizonte): number {
  const campo = CAMPO_DO_GANHO[horizonte];
  return (
    m.eja[campo] * ACRESCIMO_DE_FATOR.eja +
    m.integral[campo] * ACRESCIMO_DE_FATOR.integral +
    m.educacaoEspecial[campo] * ACRESCIMO_DE_FATOR.educacaoEspecial
  );
}

export interface MecanismoDoFundo {
  /** Valor de uma matrícula-equivalente no fundo da UF (segmento de fator 1,00). */
  valorPorEquivalente: number;
  /** Situação da rede no VAAT. Ausente → trata só o fundo estadual. */
  vaat?: {
    /** VAAT próprio, por matrícula ponderada, antes da complementação. */
    proprio: number;
    /** VAAT-MIN nacional. */
    minimo: number;
    /** Matrículas ponderadas do VAAT (o denominador do VAAT próprio). */
    equivalentes: number;
    /** Só quem está habilitado tem o VAAT apurado. */
    habilitado: boolean;
  } | null;
}

export interface ValorDoCenario {
  valor: number;
  /** Quanto valeu, na média, cada matrícula-equivalente a mais. */
  porEquivalente: number;
  /** `vaat`: completado até o mínimo. `fundo`: só o fundo estadual. `entra`: passa a receber VAAT. */
  via: "vaat" | "fundo" | "entra";
}

/**
 * Quanto valem `deltaEquivalentes` matrículas-equivalentes a mais.
 *
 * A conta anterior multiplicava a matrícula nova por uma fração da receita
 * média por aluno, igual para todo município. O fundo não funciona assim, e a
 * diferença é grande justamente onde mais importa:
 *
 * - **No fundo estadual**, cada equivalente a mais vale o valor aluno/ano da UF.
 * - **Em quem recebe VAAT**, a União completa a rede até o VAAT-MIN. A
 *   complementação é `mínimo × equivalentes − recursos da rede`, então a
 *   receita total do FUNDEB cresce o **mínimo inteiro** por equivalente — em
 *   2026, R$ 10.192 contra R$ 5.963 do fundo na Bahia. É o mecanismo que levou
 *   o VAAT de Senhor do Bonfim/BA de zero a R$ 92,6 milhões.
 * - **Em quem está logo acima do mínimo**, mais equivalentes derrubam o VAAT
 *   próprio; se ele cruzar o piso, a rede entra na faixa e recebe a diferença.
 *
 * Uma fórmula só cobre os três casos.
 */
export function valorDosEquivalentes(deltaEquivalentes: number, m: MecanismoDoFundo): ValorDoCenario {
  const delta = Math.max(0, deltaEquivalentes);
  const doFundo = delta * m.valorPorEquivalente;
  const v = m.vaat;
  if (!v || !v.habilitado || !(v.equivalentes > 0) || !(v.minimo > 0) || !(v.proprio > 0) || delta === 0) {
    return { valor: Math.round(doFundo * 100) / 100, porEquivalente: m.valorPorEquivalente, via: "fundo" };
  }
  const recursos = v.proprio * v.equivalentes;
  const antes = Math.max(0, v.minimo * v.equivalentes - recursos);
  const depois = Math.max(0, v.minimo * (v.equivalentes + delta) - (recursos + doFundo));
  const valor = doFundo + (depois - antes);
  return {
    valor: Math.round(valor * 100) / 100,
    porEquivalente: valor / delta,
    via: antes > 0 ? "vaat" : depois > 0 ? "entra" : "fundo",
  };
}
