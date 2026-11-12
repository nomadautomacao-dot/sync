import { describe, expect, it } from "vitest";

import { evolucaoDoFundo, evolucaoEm } from "./fundeb-evolucao-do-fundo";

describe("evolução do fundo", () => {
  // Redistribuição de Juvenília/MG, FNDE.
  const juvenilia = [
    { ano: 2022, contribuicao: 3_687_936 },
    { ano: 2023, contribuicao: 3_816_178 },
    { ano: 2024, contribuicao: 4_040_717 },
    { ano: 2025, contribuicao: 4_591_535 },
    { ano: 2026, contribuicao: 4_948_998 },
  ];

  it("tira a média dos três últimos exercícios do próprio município", () => {
    const e = evolucaoDoFundo(juvenilia)!;

    expect(e.de).toBe(2023);
    expect(e.ate).toBe(2026);
    expect(e.taxa).toBeCloseTo(0.091, 3);
    expect(e.base).toBe(4_948_998);
  });

  it("compõe ano a ano sobre a base", () => {
    const e = evolucaoDoFundo(juvenilia)!;

    expect(evolucaoEm(e, 2)).toBeCloseTo(4_948_998 * ((1 + e.taxa) ** 2 - 1), 2);
    expect(evolucaoEm(e, 0)).toBe(0);
  });

  it("não projeta queda, e sem série não inventa", () => {
    expect(evolucaoDoFundo([{ ano: 2025, contribuicao: 100 }, { ano: 2026, contribuicao: 90 }])!.taxa).toBe(0);
    expect(evolucaoDoFundo([{ ano: 2026, contribuicao: 100 }])).toBeNull();
    expect(evolucaoEm(null, 2)).toBe(0);
  });
});
