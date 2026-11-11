import { describe, expect, it } from "vitest";

import { calcularMetasCenario } from "./fundeb-cenario-metas";

/**
 * As metas do cenário já foram tiradas do tamanho da rede pública inteira, com
 * pisos absolutos. Estes testes guardam os dois municípios em que isso saía
 * mais longe do real e as bordas de cada regra.
 */
describe("metas do cenário de estruturação", () => {
  const canedo = { matriculasMunicipais: 24_943, eja: 625, integral: 3_807, educacaoEspecial: 1_294 };

  it("não multiplica a EJA de Senador Canedo por doze", () => {
    const m = calcularMetasCenario(canedo);

    // Saía 7.800 (23% da matrícula pública). Agora é +25% sobre a própria base.
    expect(m.eja.meta).toBe(780);
    expect(m.eja.ganho).toBe(155);
    expect(m.integral.meta).toBe(4_615);
    expect(m.educacaoEspecial.meta).toBe(1_425);
  });

  it("nenhuma frente cresce mais que metade da base ou 5% da rede em um ano", () => {
    for (const base of [canedo, { matriculasMunicipais: 7_344, eja: 331, integral: 554, educacaoEspecial: 627 }]) {
      const m = calcularMetasCenario(base);

      expect(m.eja.ganho).toBeLessThanOrEqual(base.eja * 0.5 + 5);
      expect(m.integral.ganho).toBeLessThanOrEqual(base.matriculasMunicipais * 0.05 + 5);
      expect(m.educacaoEspecial.ganho).toBeLessThanOrEqual(base.educacaoEspecial * 0.1 + 5);
    }
  });

  it("não inventa oferta onde a rede não declara nenhuma", () => {
    // O piso antigo dava 600 matrículas de EJA a qualquer município, inclusive
    // a quem não tem turma aberta.
    const m = calcularMetasCenario({ matriculasMunicipais: 900, eja: 0, integral: 0, educacaoEspecial: 0 });

    expect(m.eja.meta).toBe(0);
    expect(m.educacaoEspecial.meta).toBe(0);
    // Tempo integral parte do zero, mas limitado a 5% da rede.
    expect(m.integral.meta).toBe(45);
  });

  it("mantém o tempo integral de quem já passou da meta 6 do PNE", () => {
    const m = calcularMetasCenario({ matriculasMunicipais: 224_060, eja: 4_618, integral: 148_087, educacaoEspecial: 27_185 });

    expect(m.integral.ganho).toBe(0);
    expect(m.integral.criterio).toContain("já acima");
  });

  it("volta ao pico recente de EJA, sem prometer recuperar tudo de uma vez", () => {
    const retoma = calcularMetasCenario({ ...canedo, ejaHistorico: [900, 850, 700] });
    expect(retoma.eja.meta).toBe(900);
    expect(retoma.eja.criterio).toContain("pico recente");

    // Pico muito acima da base: a retomada é limitada a +50% no ano.
    const limitada = calcularMetasCenario({ ...canedo, ejaHistorico: [3_000] });
    expect(limitada.eja.meta).toBe(940);
    expect(limitada.eja.criterio).toContain("limitada");
  });

  it("imprime a regra de cada meta", () => {
    const m = calcularMetasCenario(canedo);

    expect(m.eja.criterio).toBe("+25% sobre a base, por busca ativa");
    expect(m.integral.criterio).toContain("um terço da distância até 25% da rede (hoje 15,3%)");
    expect(m.educacaoEspecial.criterio).toContain("+10% sobre a base");
  });
});
