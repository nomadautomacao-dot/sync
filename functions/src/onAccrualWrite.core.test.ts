import { test } from "node:test";
import assert from "node:assert/strict";
import { computePayoutTotals } from "./onAccrualWrite.core";

test("soma total sempre, aprovado so approved/paid, pago so paid", () => {
  const totals = computePayoutTotals([
    { accruedAmountCents: 10_000, status: "calculated" },
    { accruedAmountCents: 20_000, status: "approved" },
    { accruedAmountCents: 5_000, status: "paid" },
  ]);
  assert.equal(totals.totalAccruedCents, 35_000);
  assert.equal(totals.totalApprovedCents, 25_000); // approved + paid
  assert.equal(totals.totalPaidCents, 5_000);
});

test("lista vazia devolve zeros", () => {
  assert.deepEqual(computePayoutTotals([]), {
    totalAccruedCents: 0,
    totalApprovedCents: 0,
    totalPaidCents: 0,
  });
});

test("status draft/blocked nao entram em aprovado nem pago", () => {
  const totals = computePayoutTotals([
    { accruedAmountCents: 10_000, status: "draft" },
    { accruedAmountCents: 10_000, status: "blocked" },
  ]);
  assert.equal(totals.totalAccruedCents, 20_000);
  assert.equal(totals.totalApprovedCents, 0);
  assert.equal(totals.totalPaidCents, 0);
});
