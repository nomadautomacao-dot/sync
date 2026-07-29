import { describe, expect, it } from "vitest";

import { getConformidadeSiope } from "@/core/lib/siope-indicadores";

/**
 * O SIOPE indexa por código IBGE de **6 dígitos** (sem o verificador) e o
 * resto do projeto usa 7. Um truncamento errado não quebra nada: devolve o
 * município vizinho, com percentuais plausíveis e do ente errado.
 *
 * A trava é o nome: o dataset guarda `NOM_MUNI` da fonte, então dá para
 * conferir que o registro devolvido é mesmo o município pedido.
 */
const AMOSTRA: Array<[string, string]> = [
  ["2801207", "CANIND"],   // Canindé de São Francisco/SE
  ["3550308", "PAULO"],    // São Paulo/SP
  ["1302603", "MANAUS"],   // Manaus/AM
  ["3136959", "JUVEN"],    // Juvenília/MG
];

describe("conformidade das vinculações no SIOPE", () => {
  it.each(AMOSTRA)("resolve o código IBGE de 7 dígitos para o município certo (%s)", (codigo, trecho) => {
    const c = getConformidadeSiope(codigo);

    expect(c, `município ${codigo} ausente`).not.toBeNull();
    expect(c!.nome.toUpperCase()).toContain(trecho);
  });

  it("classifica piso e teto no sentido correto", () => {
    for (const [codigo] of AMOSTRA) {
      const c = getConformidadeSiope(codigo)!;

      for (const i of c.indicadores) {
        if (i.limite === null || i.sentido === null) {
          expect(i.conforme).toBeNull();
          expect(i.folga).toBeNull();
          continue;
        }

        // Piso: conforme quando o valor alcança o limite. Teto: o inverso.
        // Trocar o sentido faria "10% não aplicado" parecer descumprimento
        // quando é exatamente o teto permitido.
        expect(i.conforme).toBe(i.sentido === "min" ? i.valor >= i.limite : i.valor <= i.limite);
        expect(i.folga).toBeCloseTo(i.sentido === "min" ? i.valor - i.limite : i.limite - i.valor, 2);
      }
    }
  });

  it("as descumpridas são exatamente as não conformes", () => {
    for (const [codigo] of AMOSTRA) {
      const c = getConformidadeSiope(codigo)!;
      expect(c.descumpridas).toEqual(c.indicadores.filter((i) => i.conforme === false));
      expect(c.descumpridas.every((i) => i.limite !== null)).toBe(true);
    }
  });

  it("traz as vinculações que os relatórios não cobriam", () => {
    // 15% de capital do VAAT, teto de 10% não aplicado e o IEI eram as três
    // lacunas — nenhuma delas aparecia em relatório nenhum antes.
    const c = getConformidadeSiope("2801207")!;
    const chaves = new Set(c.indicadores.map((i) => i.chave));

    expect(chaves.has("mde")).toBe(true);
    expect(chaves.has("remuneracao")).toBe(true);
    expect([...chaves].some((k) => ["capitalVaat", "naoAplicado", "iei"].includes(k))).toBe(true);
  });

  it("marca o ano da declaração e a defasagem", () => {
    const c = getConformidadeSiope("2801207")!;
    expect(c.ano).toBeGreaterThanOrEqual(2024);
    expect(typeof c.defasado).toBe("boolean");
  });

  it("devolve null para código inexistente em vez de lançar", () => {
    expect(getConformidadeSiope("0000000")).toBeNull();
    expect(getConformidadeSiope("")).toBeNull();
    expect(getConformidadeSiope("123")).toBeNull();
  });
});
