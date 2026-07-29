import { describe, expect, it } from "vitest";

import { getEnemAbstencao } from "@/core/lib/enem-abstencao";

describe("abstenção no ENEM por município de prova", () => {
  it("traz o município-sede com a régua da UF (caso conferido na geração)", () => {
    // Serra do Ramalho/BA, ENEM 2024: 664 inscritos, 31,6% de abstenção,
    // contra 27,4% da Bahia — o sinal existe e é comparável.
    const e = getEnemAbstencao("2930154", "BA")!;

    expect(e).not.toBeNull();
    expect(e.ano).toBe(2024);
    expect(e.inscritos).toBe(664);
    expect(e.pctAbstencao).toBe(31.6);
    expect(e.uf?.pctAbstencao).toBe(27.4);
  });

  it("devolve null para município sem local de prova, em vez de zero enganoso", () => {
    expect(getEnemAbstencao("0000000", "BA")).toBeNull();
  });
});
