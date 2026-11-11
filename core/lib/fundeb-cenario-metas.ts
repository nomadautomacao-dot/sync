/**
 * Metas de matrícula do cenário de estruturação — o que cabe em um ano.
 *
 * A fórmula anterior tirava a meta do tamanho da rede **pública** inteira: EJA
 * a 23% dela, tempo integral a 24%, com pisos absolutos de 600, 800 e 500
 * matrículas. Em Senador Canedo/GO isso mandava a EJA de 625 para 7.800 em um
 * exercício — doze vezes a oferta atual — e o cenário valia R$ 37 a 56 milhões.
 * Número que o secretário de educação desmonta de cabeça custa a credibilidade
 * das outras dezesseis páginas.
 *
 * Aqui cada frente tem uma regra que se explica em uma linha, parte da rede
 * **municipal** (a única que o município governa) e respeita o que uma
 * secretaria consegue abrir entre uma coleta do Censo e a seguinte. A página
 * imprime a regra ao lado da meta: meta sem critério é palpite.
 */

/** Crescimento de EJA que uma busca ativa bem feita entrega em um ano. */
export const EJA_CRESCIMENTO_ANUAL = 0.25;
/** Teto para a retomada do pico histórico: nem recuperar tudo cabe em um ano. */
export const EJA_TETO_RETOMADA = 0.5;
/** Meta 6 do PNE: 25% dos alunos em tempo integral. */
export const INTEGRAL_REFERENCIA_PNE = 0.25;
/** Fração da distância até a referência que se fecha por ano. */
export const INTEGRAL_FRACAO_ANUAL = 1 / 3;
/** Teto de expansão de jornada por ano, em pontos percentuais da rede. */
export const INTEGRAL_TETO_ANUAL = 0.05;
/** Identificação e registro de AEE: ganho de cadastro, não de oferta nova. */
export const ESPECIAL_CRESCIMENTO_ANUAL = 0.1;

export interface BaseCenario {
  /** Matrículas da rede municipal — o denominador das referências. */
  matriculasMunicipais: number;
  eja: number;
  integral: number;
  educacaoEspecial: number;
  /** Matrículas de EJA dos censos anteriores, para achar o pico recente. */
  ejaHistorico?: number[];
}

export interface FrenteCenario {
  base: number;
  meta: number;
  ganho: number;
  /** A regra que gerou a meta, pronta para impressão. */
  criterio: string;
}

export interface MetasCenario {
  eja: FrenteCenario;
  integral: FrenteCenario;
  educacaoEspecial: FrenteCenario;
}

/** Meta em múltiplo de 5 — precisão de unidade numa projeção é falsa precisão. */
function arredondar(valor: number): number {
  return Math.round(valor / 5) * 5;
}

function frente(base: number, alvo: number, criterio: string): FrenteCenario {
  const baseValida = Math.max(0, Math.round(base));
  // Meta nunca fica abaixo da base: o cenário é de estruturação, não de corte.
  const meta = Math.max(baseValida, arredondar(alvo));
  return { base: baseValida, meta, ganho: meta - baseValida, criterio };
}

const pct = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const int = (v: number) => Math.round(v).toLocaleString("pt-BR");

export function calcularMetasCenario(b: BaseCenario): MetasCenario {
  const rede = Math.max(0, b.matriculasMunicipais);

  // ── EJA ───────────────────────────────────────────────────────────────────
  // Sem oferta declarada não há base para crescer por percentual, e abrir EJA
  // do zero é decisão de política, não meta de consultoria.
  const pico = Math.max(0, ...(b.ejaHistorico ?? []));
  const ejaPorCrescimento = b.eja * (1 + EJA_CRESCIMENTO_ANUAL);
  const ejaTeto = b.eja * (1 + EJA_TETO_RETOMADA);
  const retoma = pico > ejaPorCrescimento;
  const eja =
    b.eja <= 0
      ? frente(0, 0, "sem oferta de EJA declarada na rede municipal")
      : retoma
        ? frente(
            b.eja,
            Math.min(pico, ejaTeto),
            pico > ejaTeto
              ? `retomada do pico recente (${int(pico)}), limitada a +${pct(EJA_TETO_RETOMADA)} no ano`
              : `volta ao pico recente da própria rede (${int(pico)})`,
          )
        : frente(b.eja, ejaPorCrescimento, `+${pct(EJA_CRESCIMENTO_ANUAL)} sobre a base, por busca ativa`);

  // ── Tempo integral ────────────────────────────────────────────────────────
  const participacao = rede > 0 ? b.integral / rede : 0;
  const distancia = Math.max(0, INTEGRAL_REFERENCIA_PNE * rede - b.integral);
  const passo = Math.min(distancia * INTEGRAL_FRACAO_ANUAL, INTEGRAL_TETO_ANUAL * rede);
  const integral =
    rede <= 0
      ? frente(b.integral, b.integral, "rede municipal não dimensionada no Censo")
      : distancia <= 0
        ? frente(b.integral, b.integral, `já acima dos ${pct(INTEGRAL_REFERENCIA_PNE)} da meta 6 do PNE (${pct(participacao)} da rede)`)
        : frente(
            b.integral,
            b.integral + passo,
            `um terço da distância até ${pct(INTEGRAL_REFERENCIA_PNE)} da rede (hoje ${pct(participacao)}), no máximo ${pct(INTEGRAL_TETO_ANUAL)} da rede por ano`,
          );

  // ── Educação especial ─────────────────────────────────────────────────────
  const educacaoEspecial =
    b.educacaoEspecial <= 0
      ? frente(0, 0, "sem matrícula de educação especial declarada")
      : frente(
          b.educacaoEspecial,
          b.educacaoEspecial * (1 + ESPECIAL_CRESCIMENTO_ANUAL),
          `+${pct(ESPECIAL_CRESCIMENTO_ANUAL)} sobre a base, por identificação e registro de AEE`,
        );

  return { eja, integral, educacaoEspecial };
}
