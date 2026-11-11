import { describe, expect, it } from "vitest";

import {
  BASE_MINIMA,
  FAIXAS_DE_PORTE,
  RITMO_EJA,
  RITMO_ESPECIAL,
  RITMO_INTEGRAL,
  calcularMetasCenario,
  equivalentesDoCenario,
  matriculasDoCenario,
  valorDosEquivalentes,
} from "./fundeb-cenario-metas";
import { lerJsonDeDados } from "./dados-arquivo";
import { getInepCensoMunicipalHistory, type InepCensoMunicipalRecord } from "./inep-censo";

/** Mesmo quantil usado para fixar a tabela: o elemento na posição ⌊n·p⌋. */
function quantil(valores: number[], p: number): number {
  const s = [...valores].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
}

/**
 * A tabela de ritmos é medida, não escolhida — e este teste refaz a medição.
 * Quando o Censo de 2026 entrar na base, os quantis mudam; se saírem de perto
 * do que está escrito em `fundeb-cenario-metas.ts`, é aqui que aparece, em vez
 * de o relatório seguir imprimindo "uma em cada quatro redes fez" sobre um
 * número que deixou de ser verdade.
 */
describe("a calibração bate com o que as redes do país fizeram", () => {
  const faixa = (base: number) => FAIXAS_DE_PORTE.findIndex((f) => base < f.ate);
  const integral = (r: InepCensoMunicipalRecord) =>
    (r.tempoIntegralEnsinoFundamentalMunicipal ?? 0) + (r.tempoIntegralEducacaoInfantilMunicipal ?? 0);

  const eja: number[][] = [[], [], []];
  const especial: number[][] = [[], [], []];
  const jornada: number[] = [];
  const totalEja = new Map<number, number>();

  const { municipios } = lerJsonDeDados<{ municipios: Array<{ id: number }> }>("data/ibge/municipios.json");
  for (const { id } of municipios) {
    const historia = getInepCensoMunicipalHistory(String(id)).sort((a, b) => a.anoReferencia - b.anoReferencia);
    for (const r of historia) totalEja.set(r.anoReferencia, (totalEja.get(r.anoReferencia) ?? 0) + (r.ejaMunicipal ?? 0));
    for (let k = 1; k < historia.length; k++) {
      const a = historia[k - 1];
      const b = historia[k];
      // 2022 fica de fora — ver o teste da quebra de série, logo abaixo.
      if (a.anoReferencia < 2023 || b.anoReferencia !== a.anoReferencia + 1) continue;
      if ((a.ejaMunicipal ?? 0) >= BASE_MINIMA && b.ejaMunicipal != null) eja[faixa(a.ejaMunicipal!)].push(b.ejaMunicipal / a.ejaMunicipal! - 1);
      if ((a.educacaoEspecialMunicipal ?? 0) >= BASE_MINIMA && b.educacaoEspecialMunicipal != null) {
        especial[faixa(a.educacaoEspecialMunicipal!)].push(b.educacaoEspecialMunicipal / a.educacaoEspecialMunicipal! - 1);
      }
      if ((a.matriculasMunicipaisTotal ?? 0) >= 500 && (b.matriculasMunicipaisTotal ?? 0) > 0) {
        jornada.push(integral(b) / b.matriculasMunicipaisTotal! - integral(a) / a.matriculasMunicipaisTotal!);
      }
    }
  }

  it("mede sobre amostra grande o bastante em cada faixa", () => {
    for (const amostra of [...eja, ...especial]) expect(amostra.length).toBeGreaterThan(300);
    expect(jornada.length).toBeGreaterThan(5_000);
  });

  it.each([0, 1, 2])("EJA, faixa de porte %i", (i) => {
    expect(quantil(eja[i], 0.75)).toBeCloseTo(RITMO_EJA[i].padrao, 1);
    expect(Math.abs(quantil(eja[i], 0.75) - RITMO_EJA[i].padrao)).toBeLessThan(0.03);
    expect(Math.abs(quantil(eja[i], 0.9) - RITMO_EJA[i].acelerado)).toBeLessThan(0.04);
  });

  it.each([0, 1, 2])("educação especial, faixa de porte %i", (i) => {
    expect(Math.abs(quantil(especial[i], 0.75) - RITMO_ESPECIAL[i].padrao)).toBeLessThan(0.03);
    expect(Math.abs(quantil(especial[i], 0.9) - RITMO_ESPECIAL[i].acelerado)).toBeLessThan(0.04);
  });

  it("tempo integral, em fração da rede ganha no ano", () => {
    expect(Math.abs(quantil(jornada, 0.75) - RITMO_INTEGRAL.padrao)).toBeLessThan(0.01);
    expect(Math.abs(quantil(jornada, 0.9) - RITMO_INTEGRAL.acelerado)).toBeLessThan(0.015);
  });

  /**
   * Por que 2022 não entra: a base local daquele ano conta EJA por outro
   * critério. Se um dia o arquivo de 2022 for regerado no critério dos outros,
   * este teste falha — e aí 2022 pode voltar para a medição.
   */
  it("a base de 2022 conta EJA por outro critério", () => {
    expect((totalEja.get(2023) ?? 0) / (totalEja.get(2022) ?? 1)).toBeGreaterThan(1.8);
    expect(Math.abs((totalEja.get(2025) ?? 0) / (totalEja.get(2024) ?? 1) - 1)).toBeLessThan(0.1);
  });
});

describe("metas do cenário de estruturação", () => {
  const canedo = { matriculasMunicipais: 24_943, eja: 625, integral: 3_807, educacaoEspecial: 1_294 };

  it("não multiplica a EJA de Senador Canedo por doze", () => {
    const m = calcularMetasCenario(canedo);

    // Já saiu 7.800 (23% da matrícula pública). No ritmo padrão desta faixa: +9%.
    expect(m.eja.meta).toBe(680);
    expect(m.eja.metaAcelerada).toBe(820);
    expect(m.integral.meta).toBe(5_055);
    expect(m.educacaoEspecial.meta).toBe(1_630);
  });

  it("ordena os horizontes: padrão ≤ acelerado, e padrão ≤ três anos", () => {
    for (const base of [canedo, { matriculasMunicipais: 7_344, eja: 331, integral: 554, educacaoEspecial: 627 }, { matriculasMunicipais: 12_519, eja: 3_842, integral: 3_942, educacaoEspecial: 1_246 }]) {
      const m = calcularMetasCenario(base);
      for (const f of [m.eja, m.integral, m.educacaoEspecial]) {
        expect(f.meta).toBeGreaterThanOrEqual(f.base);
        expect(f.metaAcelerada).toBeGreaterThanOrEqual(f.meta);
        expect(f.metaTresAnos).toBeGreaterThanOrEqual(f.meta);
      }
    }
  });

  it("não promete crescimento de EJA no ritmo padrão a quem já tem mais de mil matrículas", () => {
    // Senhor do Bonfim/BA: nessa faixa nem o quartil de cima cresce.
    const m = calcularMetasCenario({ matriculasMunicipais: 12_519, eja: 3_842, integral: 3_942, educacaoEspecial: 1_246 });

    expect(m.eja.ganho).toBe(0);
    expect(m.eja.ganhoAcelerado).toBeGreaterThan(0);
    expect(m.eja.criterio).toContain("não cresceram nem no quartil de cima");
  });

  it("ritmo zero é meta igual à base, sem ganho de arredondamento", () => {
    // Fortaleza/CE: 4.618 de EJA arredondava para 4.620 e "ganhava" 2 matrículas.
    const m = calcularMetasCenario({ matriculasMunicipais: 224_060, eja: 4_618, integral: 148_087, educacaoEspecial: 27_185 });

    expect(m.eja.meta).toBe(4_618);
    expect(m.eja.ganho).toBe(0);
    expect(m.eja.metaTresAnos).toBe(4_618);
  });

  it("não inventa oferta onde a rede não declara base relevante", () => {
    const m = calcularMetasCenario({ matriculasMunicipais: 900, eja: 20, integral: 0, educacaoEspecial: 0 });

    expect(m.eja.ganho).toBe(0);
    expect(m.educacaoEspecial.ganho).toBe(0);
    expect(m.integral.meta).toBe(45);
  });

  it("não deixa o tempo integral passar do tamanho da rede", () => {
    const m = calcularMetasCenario({ matriculasMunicipais: 1_000, eja: 0, integral: 980, educacaoEspecial: 0 });

    expect(m.integral.meta).toBe(1_000);
    expect(m.integral.metaTresAnos).toBe(1_000);
  });

  it("imprime a regra de cada meta", () => {
    const m = calcularMetasCenario(canedo);

    expect(m.eja.criterio).toContain("+9% no ano: o que uma em cada quatro redes com EJA deste porte (de 200 a 1.000 matrículas)");
    expect(m.integral.criterio).toContain("+5% da rede no ano");
    expect(m.educacaoEspecial.criterio).toContain("+26% no ano");
  });

  it("converte matrícula em equivalente pelo fator de cada frente", () => {
    const m = calcularMetasCenario(canedo);

    expect(matriculasDoCenario(m, "padrao")).toBe(55 + 1_248 + 336);
    expect(equivalentesDoCenario(m, "padrao")).toBeCloseTo(55 * 1 + 1_248 * 0.4 + 336 * 0.4, 6);
  });
});

/**
 * O mecanismo do fundo. Uma matrícula-equivalente a mais não vale o mesmo em
 * todo município — e a diferença é o VAAT.
 */
describe("valor de uma matrícula-equivalente a mais", () => {
  it("vale o valor aluno/ano da UF para quem está fora do VAAT", () => {
    const v = valorDosEquivalentes(100, { valorPorEquivalente: 6_377.3, vaat: { proprio: 14_000, minimo: 10_192.38, equivalentes: 30_000, habilitado: true } });

    expect(v.via).toBe("fundo");
    expect(v.valor).toBeCloseTo(637_730, 2);
  });

  it("vale o VAAT-MIN inteiro para quem a União completa", () => {
    // Senhor do Bonfim/BA: VAAT próprio de R$ 5.611,77 contra mínimo de R$ 10.192,38.
    const v = valorDosEquivalentes(100, { valorPorEquivalente: 5_962.79, vaat: { proprio: 5_611.77, minimo: 10_192.38, equivalentes: 19_878.31, habilitado: true } });

    expect(v.via).toBe("vaat");
    expect(v.valor).toBeCloseTo(1_019_238, 0);
    expect(v.porEquivalente).toBeCloseTo(10_192.38, 2);
  });

  it("soma a entrada na faixa para quem está logo acima do mínimo", () => {
    // 3% acima do mínimo: equivalentes bastantes derrubam o VAAT próprio abaixo dele.
    const perto = { valorPorEquivalente: 6_377.3, vaat: { proprio: 10_300, minimo: 10_192.38, equivalentes: 10_000, habilitado: true } };

    expect(valorDosEquivalentes(100, perto).via).toBe("fundo");
    const entra = valorDosEquivalentes(1_000, perto);
    expect(entra.via).toBe("entra");
    expect(entra.valor).toBeGreaterThan(1_000 * 6_377.3);
    expect(entra.valor).toBeLessThan(1_000 * 10_192.38);
  });

  it("não conta VAAT de quem está inabilitado", () => {
    const v = valorDosEquivalentes(100, { valorPorEquivalente: 5_962.79, vaat: { proprio: 5_611.77, minimo: 10_192.38, equivalentes: 19_878.31, habilitado: false } });

    expect(v.via).toBe("fundo");
    expect(v.valor).toBeCloseTo(596_279, 2);
  });

  it("devolve zero para cenário sem matrícula a mais", () => {
    expect(valorDosEquivalentes(0, { valorPorEquivalente: 5_962.79 }).valor).toBe(0);
  });
});
