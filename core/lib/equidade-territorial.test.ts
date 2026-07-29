import { describe, expect, it } from "vitest";

import { avaliarPovo, matriculasNosSegmentos } from "@/core/lib/equidade-territorial";

/**
 * O cruzamento vale dinheiro (fatores de 1,40 a 2,17) e por isso não pode
 * acusar nem calar errado: sinal falso vira constrangimento na prefeitura,
 * sinal perdido vira fator perdido. Manaus foi o caso que calibrou a régua —
 * 15,6 mil indígenas de 0–14 e 142 matrículas nos segmentos (0,9%) passavam
 * ilesos num sinal que só olhasse o zero.
 */
describe("avaliação de povo territorial", () => {
  it("sinaliza população escolar relevante com zero matrícula nos segmentos", () => {
    const p = avaliarPovo(214, 38, 0);
    expect(p.sinalConferencia).toBe(true);
    expect(p.razaoAtendimento).toBe(0);
  });

  it("sinaliza razão desproporcional mesmo com matrícula positiva — o caso Manaus", () => {
    const p = avaliarPovo(71_691, 15_647, 142);
    expect(p.sinalConferencia).toBe(true);
    expect(p.razaoAtendimento).toBeCloseTo(0.9, 1);
  });

  it("não sinaliza declaração compatível com a presença do povo", () => {
    // Alcântara/MA: 3.521 quilombolas de 0–14 e 2.376 matrículas declaradas.
    const p = avaliarPovo(15_608, 3_521, 2_376);
    expect(p.sinalConferencia).toBe(false);
    expect(p.razaoAtendimento).toBeGreaterThan(50);
  });

  it("não sinaliza população escolar abaixo do piso de ruído censitário", () => {
    // 3 crianças indígenas sem matrícula em segmento não é achado — é ruído.
    const p = avaliarPovo(27, 3, 0);
    expect(p.sinalConferencia).toBe(false);
  });
});

describe("matrículas nos segmentos do FUNDEB", () => {
  it("soma os segmentos quilombolas de quem os declara", () => {
    // Alcântara declara matrículas quilombolas na planilha do FNDE.
    expect(matriculasNosSegmentos("2100204", /Quilombola/)).toBeGreaterThan(1000);
  });

  it("devolve zero para código desconhecido em vez de lançar", () => {
    expect(matriculasNosSegmentos("0000000", /Quilombola/)).toBe(0);
  });
});
