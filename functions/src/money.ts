/**
 * Toda a aritmética monetária do sistema fica aqui. `accrue` e a UNICA
 * funcao autorizada a arredondar dinheiro (design doc, secao "Blindagem
 * do calculo de comissao").
 */

/** percentual * 10_000 (Decimal(8,4) do Prisma) aplicado sobre cents,
 * dividido de volta por 1_000_000 (10_000 do bps x 100 do percentual). */
export function accrue(profitBaseCents: number, appliedPercentBps: number): number {
  return Math.round((profitBaseCents * appliedPercentBps) / 1_000_000);
}

/** Subtracao exata em centavos inteiros — nunca precisa arredondar. */
export function centsSubtract(...values: number[]): number {
  return values.reduce((acc, v, i) => (i === 0 ? v : acc - v));
}

/** Converte um percentual (ex.: 8.5) no basis-points inteiro usado nas rules. */
export function percentToBps(percent: number): number {
  return Math.round(percent * 10_000);
}
