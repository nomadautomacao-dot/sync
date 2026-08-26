/** O exercício em que a série começa a ser mostrada no documento. */
export const ANO_INICIO_SERIE = 2022;

/** Um exercício da série de um município. */
export interface ExercicioCase {
  ano: number;
  vaaf: number;
  vaat: number;
  vaar: number;
  /** VAAF + VAAT + VAAR — o que veio da União naquele exercício. */
  complementacao: number;
  /** Receita total do FUNDEB do município no exercício. */
  total: number;
}

/**
 * Um município no case, já apurado.
 *
 * `inicio` e `fim` são a **janela de atuação** — o período que a Global
 * reivindica naquela rede, e não a série inteira. Os dois campos existem
 * separados de `serie` porque a série mostra o contexto (de onde a rede vinha)
 * enquanto a janela é o que o documento afirma ter causado.
 */
export interface MunicipioApurado {
  codigoIbge: string;
  nome: string;
  uf: string;
  inicio: number;
  fim: number;
  serie: ExercicioCase[];
  totalInicio: number;
  totalFim: number;
  complementacaoInicio: number;
  complementacaoFim: number;
  ganhoTotal: number;
  ganhoComplementacao: number;
  variacaoTotal: number;
  variacaoComplementacao: number;
  /**
   * Posição da rede entre os municípios brasileiros que já recebiam
   * complementação no ano de início — 0 a 100, quanto maior melhor.
   *
   * É apurada **na janela do próprio município**: comparar uma rede de janela
   * 2024–2025 com o universo de 2024–2026 mediria períodos diferentes e
   * inventaria uma posição que não existe.
   */
  percentilBR: number;
  universoBR: number;
  /** Primeiro exercício da série com VAAT — a habilitação, visível no dado. */
  anoHabilitacaoVaat: number | null;
}

export interface AgregadoCase {
  totalInicio: number;
  totalFim: number;
  complementacaoInicio: number;
  complementacaoFim: number;
  ganhoTotal: number;
  ganhoComplementacao: number;
  /** Quantas redes ficaram entre as 10% que mais cresceram no país. */
  noTopo10: number;
}

export interface CaseSucesso {
  municipios: MunicipioApurado[];
  agregado: AgregadoCase;
  /** Exercícios que a série cobre, do mais antigo ao mais recente. */
  anos: number[];
  geradoEm: string;
}

/** O que a tela envia: o município e até quando a Global esteve nele. */
export interface EntradaCase {
  codigoIbge: string;
  /** Último exercício reivindicado. Nunca use ano em que não se estava na rede. */
  fim: number;
  inicio?: number;
  /**
   * Nome acentuado, quando quem chama já o tem.
   *
   * As portarias do FNDE trazem o nome em caixa alta e **sem acento** — "SAO
   * FELIX DO CORIBE" —, e um deck que escreve o nome do cliente errado na capa
   * perde antes de começar. A tela manda o nome do IBGE, que vem acentuado; sem
   * ele, cai para o do FNDE, que ao menos identifica o município.
   */
  nome?: string;
}
