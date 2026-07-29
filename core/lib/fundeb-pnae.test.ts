import { describe, expect, it } from "vitest";

import { PER_CAPITA_PNAE, getEstimativaPnae } from "@/core/lib/fundeb-pnae";
import { getPonderacaoMunicipal } from "@/core/lib/fundeb-ponderacao";

/**
 * Os per capita vêm do Anexo V da Resolução CD/FNDE nº 4/2026, conferidos no
 * texto publicado no DOU. As faixas do Anexo **não são disjuntas** — uma
 * creche em área quilombola atende a duas — e é aí que a classificação pode
 * errar em silêncio, aplicando 0,98 onde cabe 1,57.
 */
describe("estimativa do PNAE", () => {
  it("preserva os per capita do Anexo V", () => {
    expect(PER_CAPITA_PNAE.fundamentalMedioEja).toBe(0.57);
    expect(PER_CAPITA_PNAE.preEscola).toBe(0.82);
    expect(PER_CAPITA_PNAE.areasTradicionais).toBe(0.98);
    expect(PER_CAPITA_PNAE.tempoIntegral).toBe(1.57);
    expect(PER_CAPITA_PNAE.creche).toBe(1.57);
    expect(PER_CAPITA_PNAE.aee).toBe(0.78);
  });

  it("aplica a fórmula VT = A × D × C com 200 dias letivos", () => {
    const e = getEstimativaPnae("2801207")!;
    expect(e).not.toBeNull();
    expect(e.diasLetivos).toBe(200);

    for (const faixa of e.faixas) {
      expect(faixa.valorAnual).toBeCloseTo(faixa.matriculas * faixa.perCapita * 200, 1);
    }

    const soma = e.faixas.reduce((t, f) => t + f.valorAnual, 0);
    expect(e.valorAnual).toBeCloseTo(soma, 1);
  });

  it("classifica creche pelo valor cheio, mesmo em área tradicional", () => {
    // O Anexo V é explícito: creches "inclusive as localizadas em áreas
    // indígenas, remanescentes de quilombos e PCT" recebem 1,57. Rebaixar
    // para 0,98 subestimaria justamente as redes mais vulneráveis.
    const e = getEstimativaPnae("1302603")!; // Manaus, recorte indígena relevante
    const creche = e.faixas.find((f) => f.rotulo === "Creche");

    if (creche) expect(creche.perCapita).toBe(1.57);
  });

  it("não conta o AEE como matrícula de escolarização", () => {
    // O AEE é contraturno: soma ao repasse sem ser aluno adicional. Contá-lo
    // no total duplicaria a mesma criança.
    for (const codigo of ["2801207", "3550308", "1302603"]) {
      const e = getEstimativaPnae(codigo)!;
      const ponderacao = getPonderacaoMunicipal(codigo)!;
      const aee = e.faixas.find((f) => f.rotulo.startsWith("Atendimento"));

      const somaFaixas = e.faixas.reduce((t, f) => t + f.matriculas, 0);
      expect(e.matriculasConsideradas).toBe(somaFaixas - (aee?.matriculas ?? 0));
      expect(e.matriculasConsideradas).toBeLessThanOrEqual(ponderacao.matriculas);
    }
  });

  it("o valor por aluno fica dentro da faixa possível do Anexo V", () => {
    for (const codigo of ["2801207", "3550308", "3136959"]) {
      const e = getEstimativaPnae(codigo)!;
      const porAluno = e.valorAnual / e.matriculasConsideradas;
      // Piso: todos em 0,57 × 200 = 114. Teto: todos em 1,57 × 200 = 314,
      // com folga para o adicional de AEE.
      expect(porAluno).toBeGreaterThanOrEqual(0.57 * 200);
      expect(porAluno).toBeLessThanOrEqual(1.57 * 200 + 0.78 * 200);
    }
  });

  it("devolve null para código inexistente em vez de lançar", () => {
    expect(getEstimativaPnae("0000000")).toBeNull();
    expect(getEstimativaPnae("")).toBeNull();
  });
});
