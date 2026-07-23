import { test } from "node:test";
import assert from "node:assert/strict";
import { computeAccruals } from "./fecharCompetencia.core";

test("aplica regra percentual sobre o profitBase", () => {
  const result = computeAccruals(
    "city1",
    2026,
    7,
    { profitBaseCents: 100_000 },
    [{ id: "r1", collaboratorId: "colab1", baseType: "operational_profit_pre_commission", percentBps: 100_000, flatValueCents: null, isActive: true }],
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "colab1_city1_2026-07");
  assert.equal(result[0].accruedAmountCents, 10_000); // 10%
  assert.equal(result[0].appliedPercentBps, 100_000);
});

test("aplica regra de valor fixo, ignorando profitBase", () => {
  const result = computeAccruals(
    "city1", 2026, 7,
    { profitBaseCents: 0 },
    [{ id: "r1", collaboratorId: "colab1", baseType: "gross_revenue", percentBps: null, flatValueCents: 50_000, isActive: true }],
  );
  assert.equal(result[0].accruedAmountCents, 50_000);
  assert.equal(result[0].appliedPercentBps, null);
});

test("ignora regra inativa", () => {
  const result = computeAccruals(
    "city1", 2026, 7,
    { profitBaseCents: 100_000 },
    [{ id: "r1", collaboratorId: "colab1", baseType: "gross_revenue", percentBps: 100_000, flatValueCents: null, isActive: false }],
  );
  assert.equal(result.length, 0);
});

test("ignora regra sem percentual nem valor fixo", () => {
  const result = computeAccruals(
    "city1", 2026, 7,
    { profitBaseCents: 100_000 },
    [{ id: "r1", collaboratorId: "colab1", baseType: "gross_revenue", percentBps: null, flatValueCents: null, isActive: true }],
  );
  assert.equal(result.length, 0);
});

test("duas regras de colaboradores diferentes geram dois accruals", () => {
  const result = computeAccruals(
    "city1", 2026, 7,
    { profitBaseCents: 200_000 },
    [
      { id: "r1", collaboratorId: "colabA", baseType: "gross_revenue", percentBps: 50_000, flatValueCents: null, isActive: true },
      { id: "r2", collaboratorId: "colabB", baseType: "gross_revenue", percentBps: 100_000, flatValueCents: null, isActive: true },
    ],
  );
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((r) => r.accruedAmountCents).sort((a, b) => a - b), [10_000, 20_000]);
});
