import { describe, expect, it } from "vitest";

import { getTrabalhoInfantil } from "./trabalho-infantil";

/**
 * O que estes testes protegem não é o cálculo — é a disciplina de leitura.
 *
 * O dado vem de estimativa preliminar da amostra do Censo 2022. Ele é fácil de
 * usar errado: somar as faixas, tratar zero como ausência, comparar município
 * com município. Cada teste abaixo trava uma dessas portas.
 */
describe("trabalho na idade escolar (Censo 2022)", () => {
  it("devolve as duas faixas separadas, e nenhum total somado", () => {
    const t = getTrabalhoInfantil("2924009"); // Paulo Afonso/BA
    expect(t).not.toBeNull();
    expect(t!.faixas.map((f) => f.rotulo)).toEqual(["10 a 13 anos", "14 a 17 anos"]);

    // A ausência de um campo de total é intencional: somar as faixas
    // confundiria dois fatos jurídicos distintos. Ver o doc-comment do módulo.
    expect(t as unknown as Record<string, unknown>).not.toHaveProperty("totalOcupadas");
  });

  it("marca a faixa de 10 a 13 como sem hipótese legal de trabalho", () => {
    const t = getTrabalhoInfantil("2924009")!;
    expect(t.abaixoDaIdadeMinima?.rotulo).toBe("10 a 13 anos");
    expect(t.abaixoDaIdadeMinima?.admiteTrabalhoLegal).toBe(false);
    expect(t.idadeDeAprendizagem?.rotulo).toBe("14 a 17 anos");
    expect(t.idadeDeAprendizagem?.admiteTrabalhoLegal).toBe(true);
  });

  it("calcula a taxa sobre a população da própria faixa, com a régua da UF e do país", () => {
    const t = getTrabalhoInfantil("2703007")!; // Ibateguara/AL
    const menor = t.abaixoDaIdadeMinima!;

    // 21 de 938 = 2,24%. A régua nacional da faixa é ~1,2%.
    expect(menor.ocupadas).toBe(21);
    expect(menor.populacao).toBe(938);
    expect(menor.taxaPct).toBeCloseTo(2.24, 2);
    expect(menor.taxaBrasilPct).not.toBeNull();
    expect(menor.taxaBrasilPct!).toBeLessThan(menor.taxaPct!);
    // A UF de Ibateguara é Alagoas (27), lida dos dois primeiros dígitos.
    expect(menor.taxaUfPct).not.toBeNull();
  });

  it("não deixa estimativa pequena decidir a comparação", () => {
    // 21 crianças estimadas está abaixo do piso de legibilidade: a taxa fica
    // acima da nacional, mas o módulo se recusa a afirmar "acima".
    const menor = getTrabalhoInfantil("2703007")!.abaixoDaIdadeMinima!;
    expect(menor.taxaPct!).toBeGreaterThan(menor.taxaBrasilPct!);
    expect(menor.comparacaoFragil).toBe(true);
    expect(menor.acimaDoBrasil).toBe(false);
    expect(menor.acimaDaUf).toBe(false);

    // Com estimativa grande, a comparação volta a valer.
    const manaus = getTrabalhoInfantil("1302603")!.abaixoDaIdadeMinima!;
    expect(manaus.comparacaoFragil).toBe(false);
    expect(manaus.acimaDoBrasil).toBe(true); // 1,40% contra ~1,20% do país
  });

  it("preserva o município cuja estimativa de ocupação é zero", () => {
    // O traço `-` do SIDRA é zero absoluto, não dado ausente. Tratá-lo como
    // ausente apagaria 1.716 municípios do dataset — justamente os que têm a
    // melhor notícia a dar.
    const todos = ["2924009", "2703007", "1302603", "3550308"]
      .map(getTrabalhoInfantil)
      .filter(Boolean);
    expect(todos).toHaveLength(4);

    const zerados = todos.filter((t) => t!.semOcupacaoEstimada);
    // Nenhum dos quatro de referência é zerado, mas o campo tem de existir.
    expect(zerados).toHaveLength(0);
    for (const t of todos) expect(typeof t!.semOcupacaoEstimada).toBe("boolean");
  });

  it("carrega a ressalva da própria tabela, com a palavra 'preliminares'", () => {
    const t = getTrabalhoInfantil("3550308")!;
    expect(t.anoCenso).toBe(2022);
    expect(t.tabela).toBe(10268);
    expect(t.ressalva).toMatch(/preliminares/i);
    expect(t.ressalva).toMatch(/amostra/i);
    expect(t.fonte).toMatch(/Censo Demográfico 2022/);
  });

  it("devolve null para código inexistente, sem lançar", () => {
    expect(getTrabalhoInfantil("9999999")).toBeNull();
    expect(getTrabalhoInfantil("")).toBeNull();
  });

  it("aceita o código com máscara", () => {
    expect(getTrabalhoInfantil("2.924.009")).not.toBeNull();
  });
});
