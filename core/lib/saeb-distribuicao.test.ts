import { describe, expect, it } from "vitest";

import { agruparNiveis, getSaebDistribuicao } from "@/core/lib/saeb-distribuicao";

/**
 * O erro caro aqui é de corte: deslocar um nível manda um quarto da rede para
 * o grupo qualitativo errado. Os cortes seguem a convenção Todos Pela
 * Educação/QEdu sobre a escala oficial de 25 pontos do Saeb.
 */
describe("agrupamento dos níveis de proficiência", () => {
  it("LP 5º: insuficiente < 150 = níveis 0 e 1", () => {
    // Serra do Ramalho, LP5 real: 11,65 + 20,15 = 31,8% abaixo do básico.
    const g = agruparNiveis("lp5", [11.65, 20.15, 22.33, 20.59, 11.38, 9.25, 2.59, 1.57, 0.49, 0]);
    expect(g.insuficiente).toBe(31.8);
    expect(g.basico).toBeCloseTo(42.9, 1);
    expect(g.proficiente).toBeCloseTo(20.6, 1);
    expect(g.avancado).toBeCloseTo(4.7, 1);
  });

  it("MT 5º: o corte do insuficiente sobe um nível (< 175)", () => {
    const g = agruparNiveis("mt5", [7.16, 17.72, 20.53, 23.14, 16.65, 7.35, 3.77, 2.12, 1.14, 0.42, 0]);
    expect(g.insuficiente).toBeCloseTo(45.4, 1);
    expect(g.avancado).toBeCloseTo(3.7, 1);
  });

  it("LP 9º: só o nível 0 é insuficiente (< 200)", () => {
    const g = agruparNiveis("lp9", [35.78, 18.81, 15.44, 13.24, 7.95, 6.07, 2.42, 0.29, 0]);
    expect(g.insuficiente).toBe(35.8);
    expect(g.basico).toBeCloseTo(47.5, 1);
  });

  it("os quatro grupos somam ~100% quando a distribuição soma 100%", () => {
    const g = agruparNiveis("mt9", [28.11, 25.06, 18.52, 12.54, 7.34, 6.56, 1.87, 0, 0, 0]);
    const total = g.insuficiente + g.basico + g.proficiente + g.avancado;
    expect(total).toBeGreaterThan(99);
    expect(total).toBeLessThan(101);
  });
});

describe("leitura do dataset", () => {
  it("traz as quatro séries de um município avaliado", () => {
    const d = getSaebDistribuicao("2930154")!; // Serra do Ramalho/BA
    expect(d).not.toBeNull();
    expect(d.ano).toBe(2023);
    expect(d.series.lp5?.media).toBe(174.3);
    expect(d.series.lp5?.grupos.insuficiente).toBe(31.8);
    expect(d.series.mt9?.grupos).toBeDefined();
  });

  it("devolve null para município sem rede municipal avaliada", () => {
    expect(getSaebDistribuicao("0000000")).toBeNull();
  });
});
