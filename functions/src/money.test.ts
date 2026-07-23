import { test } from "node:test";
import assert from "node:assert/strict";
import { accrue, centsSubtract, percentToBps } from "./money";

test("accrue aplica bps sobre cents com arredondamento", () => {
  // 10% de R$ 1.000,00 (100000 cents) = R$ 100,00 (10000 cents)
  assert.equal(accrue(100_000, 100_000), 10_000); // 10% = 100_000 bps (10 * 10_000)
  // arredondamento: 33.33% de 100 cents -> 33 cents (nao 33.3)
  assert.equal(accrue(100, 333_300), 33);
});

test("accrue de zero e sempre zero", () => {
  assert.equal(accrue(0, 500_000), 0);
  assert.equal(accrue(100_000, 0), 0);
});

test("centsSubtract soma exata sem arredondamento", () => {
  assert.equal(centsSubtract(100_000, 30_000, 5_000, 2_000), 63_000);
  assert.equal(centsSubtract(100), 100);
});

test("percentToBps converte percentual em basis points inteiros", () => {
  assert.equal(percentToBps(10), 100_000);
  assert.equal(percentToBps(8.5), 85_000);
});
