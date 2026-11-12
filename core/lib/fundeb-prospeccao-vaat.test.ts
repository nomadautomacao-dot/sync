import { describe, expect, it } from "vitest";

import { distanciaAoPiso, listarProspeccaoVaat } from "./fundeb-prospeccao-vaat";

describe("distância até o VAAT-MIN", () => {
  it("reproduz Senador Canedo/GO: 2.658 matrículas-equivalentes", () => {
    const faltam = distanciaAoPiso({ ponderadasVaat: 31_785.88, vaatProprio: 10_511.38, vaatMinimo: 10_192.38, fundoPorEquivalente: 6_377.29 });

    expect(Math.round(faltam!)).toBe(2_658);
  });

  it("não se aplica a quem já está no piso ou abaixo", () => {
    expect(distanciaAoPiso({ ponderadasVaat: 19_878, vaatProprio: 5_611.77, vaatMinimo: 10_192.38, fundoPorEquivalente: 5_962.79 })).toBeNull();
    expect(distanciaAoPiso({ ponderadasVaat: 0, vaatProprio: 11_000, vaatMinimo: 10_192.38, fundoPorEquivalente: 6_000 })).toBeNull();
  });
});

describe("prospecção de 2026", () => {
  it("separa quem recebe, quem está inabilitado e quem está acima do piso", async () => {
    const p = (await listarProspeccaoVaat(2026))!;
    const r = p.resumo;

    expect(r.vaatMinimo).toBe(10_192.38);
    expect(r.recebem).toBeGreaterThan(2_500);
    // A lista do FNDE escreve "Inobservância do art. 38", não "inabilitado".
    expect(r.inabilitados).toBe(23);
    expect(r.acimaDoPiso).toBe(p.linhas.length);
    expect(r.recebem + r.inabilitados + r.semDado + r.acimaDoPiso).toBeGreaterThan(5_560);
    expect(r.emUmAno).toBeLessThanOrEqual(r.emTresAnos);
  });

  it("ordena pelo tempo até cruzar o piso e inclui Senador Canedo", async () => {
    const { linhas } = (await listarProspeccaoVaat(2026))!;
    const canedo = linhas.find((l) => l.codigoIbge === "5220454")!;

    expect(Math.round(canedo.faltam)).toBe(2_658);
    expect(canedo.anos!).toBeLessThan(1);
    expect(canedo.premioPorEquivalente).toBeCloseTo(3_815.09, 2);
    const anos = linhas.map((l) => l.anos ?? Infinity);
    expect(anos).toEqual([...anos].sort((a, b) => a - b));
  });
});
