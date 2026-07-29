import { describe, expect, it } from "vitest";

import { getAssentamentos } from "@/core/lib/assentamentos-incra";

/**
 * O dataset nasce de matching por **nome** (o INCRA não publica código IBGE),
 * então o risco não é lançar exceção — é casar o município errado e atribuir
 * famílias de outro ente. As travas: um caso conhecido do acervo e a sanidade
 * dos agregados.
 */
describe("assentamentos do INCRA", () => {
  it("agrega o caso conhecido do acervo (Aquidauana/MS)", () => {
    // A sonda do DBF mostrou ao menos dois PAs em Aquidauana (Indaiá III e IV).
    const a = getAssentamentos("5001102")!;

    expect(a).not.toBeNull();
    expect(a.qtd).toBeGreaterThanOrEqual(2);
    expect(a.familias).toBeGreaterThan(0);
    expect(a.areaHa).toBeGreaterThan(0);
    // Capacidade é o teto de assentamento; famílias não deveria excedê-la
    // por muito — um estouro grande indicaria soma de município errado.
    expect(a.familias).toBeLessThan(a.capacidade * 2);
  });

  it("devolve null para município sem assentamento em vez de zero fantasma", () => {
    expect(getAssentamentos("3550308")).toBeNull(); // São Paulo capital
    expect(getAssentamentos("0000000")).toBeNull();
  });
});
