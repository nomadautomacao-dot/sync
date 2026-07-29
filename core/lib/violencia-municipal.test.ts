import { describe, expect, it } from "vitest";

import { getViolenciaMunicipal, interpretarViolencia } from "@/core/lib/violencia-municipal";

/**
 * Os erros caros aqui são de recorte: comparar a taxa municipal com a
 * nacional de outro ano, ou tratar ausência de dado como zero homicídio.
 */
describe("interpretação da violência municipal", () => {
  const ANOS = [2018, 2019, 2020, 2021, 2022];
  const BRASIL = { ano: 2022, taxa: 22.1 };

  it("calcula participação juvenil e compara com a nacional do mesmo ano", () => {
    // Manaus, valores reais do Atlas.
    const r = interpretarViolencia(
      {
        total: { "2018": 1053, "2022": 1130 },
        jovens: { "2018": 608, "2022": 615 },
        taxa: { "2018": 49.1, "2022": 54.8 },
      },
      ANOS,
      BRASIL,
    )!;

    expect(r.ultimo.ano).toBe(2022);
    expect(r.participacaoJovensPct).toBeCloseTo(54.4, 1);
    expect(r.acimaDaNacional).toBe(true);
    expect(r.tendenciaTaxaPct).toBeCloseTo(11.6, 1);
  });

  it("não compara com a nacional quando os anos diferem", () => {
    const r = interpretarViolencia(
      { taxa: { "2021": 30 } },
      [2021],
      { ano: 2022, taxa: 22.1 },
    )!;
    expect(r.acimaDaNacional).toBeNull();
  });

  it("ausência de dado não vira zero homicídio", () => {
    expect(interpretarViolencia({}, ANOS, BRASIL)).toBeNull();
    const r = interpretarViolencia({ taxa: { "2022": 10 } }, ANOS, BRASIL)!;
    expect(r.ultimo.total).toBeNull();
    expect(r.participacaoJovensPct).toBeNull();
  });
});

describe("leitura do dataset", () => {
  it("traz a série de Manaus com a régua nacional do mesmo ano", () => {
    const v = getViolenciaMunicipal("1302603")!;
    expect(v).not.toBeNull();
    expect(v.ultimo.ano).toBe(2022);
    expect(v.ultimo.jovens).toBe(615);
    expect(v.brasil?.ano).toBe(2022);
    expect(v.acimaDaNacional).toBe(true);
  });

  it("devolve null para município inexistente", () => {
    expect(getViolenciaMunicipal("0000000")).toBeNull();
  });
});
