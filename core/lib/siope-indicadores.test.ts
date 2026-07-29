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

  it("distingue indicador em reais de indicador percentual", () => {
    // Achado num PDF real de Serra do Ramalho/BA: o relatorio exibia
    // "Investimento por aluno da educação básica — 13.466,12%". São reais,
    // não percentual, e o mesmo vale para a despesa com professores por aluno
    // e para o saldo não utilizado.
    const c = getConformidadeSiope("2930154")!;
    const porChave = new Map(c.indicadores.map((i) => [i.chave, i]));

    for (const chave of ["investimentoPorAluno", "professorPorAluno", "saldoNaoUtilizado"]) {
      const ind = porChave.get(chave);
      if (ind) expect(ind.unidade, `indicador ${chave}`).toBe("reais");
    }

    for (const chave of ["mde", "remuneracao", "capitalVaat", "naoAplicado"]) {
      const ind = porChave.get(chave);
      if (ind) expect(ind.unidade, `indicador ${chave}`).toBe("percentual");
    }

    // Percentual acima de 1.000 é sinal de que a unidade foi trocada.
    for (const ind of c.indicadores) {
      if (ind.unidade === "percentual") expect(ind.valor, ind.rotulo).toBeLessThan(1_000);
    }
  });

  it("usa o IEI como mínimo individualizado da educação infantil", () => {
    // Os 50% do art. 28 são meta agregada nacional; o mínimo de cada município
    // é o proprio IEI (art. 16, VII). Sem cruzar os dois, as duas linhas saíam
    // no relatório como "sem parâmetro" — quando uma é o parâmetro da outra.
    const c = getConformidadeSiope("2930154")!;
    const iei = c.indicadores.find((i) => i.chave === "iei");
    const aplicado = c.indicadores.find((i) => i.chave === "infantilVaat");

    expect(iei).toBeDefined();
    expect(aplicado).toBeDefined();
    expect(aplicado!.limite).toBe(iei!.valor);
    expect(aplicado!.sentido).toBe("min");
    expect(aplicado!.conforme).toBe(aplicado!.valor >= iei!.valor);
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
