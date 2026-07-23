export interface AccrualForTotals {
  accruedAmountCents: number;
  status: string;
}

/**
 * Totais do CommissionPayout sao sempre DERIVADOS dos accruals — nenhum
 * caminho de escrita aceita esses campos vindos do cliente (design doc).
 */
export function computePayoutTotals(accruals: AccrualForTotals[]): {
  totalAccruedCents: number;
  totalApprovedCents: number;
  totalPaidCents: number;
} {
  let totalAccruedCents = 0;
  let totalApprovedCents = 0;
  let totalPaidCents = 0;
  for (const a of accruals) {
    totalAccruedCents += a.accruedAmountCents;
    if (a.status === "approved" || a.status === "paid") totalApprovedCents += a.accruedAmountCents;
    if (a.status === "paid") totalPaidCents += a.accruedAmountCents;
  }
  return { totalAccruedCents, totalApprovedCents, totalPaidCents };
}
