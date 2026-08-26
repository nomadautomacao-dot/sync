/**
 * O Case de Sucesso afirma resultado da empresa em documento que circula fora
 * dela. As regras abaixo são as que impedem o documento de afirmar mais do que
 * o dado sustenta — principalmente a janela de atuação, que foi o erro corrigido
 * na primeira montagem: o deck reivindicava 2026 numa rede em que a consultoria
 * não estava mais.
 */

import { describe, expect, it } from "vitest";

import { montarCaseSucesso } from "./montar";

const CORIBE = "2909109";
const SERRA_DO_RAMALHO = "2930154";
const SITIO_DO_MATO = "2930758";

describe("montarCaseSucesso", () => {
  it("apura a variação da receita total entre o início e o fim da janela", async () => {
    const caso = await montarCaseSucesso([{ codigoIbge: CORIBE, fim: 2026 }]);
    const coribe = caso.municipios[0];

    // Valores das portarias do FNDE em data/fnde/receitas-{2024,2026}.csv.
    expect(coribe.totalInicio).toBeCloseTo(21_659_998.36, 2);
    expect(coribe.totalFim).toBeCloseTo(47_356_333.59, 2);
    expect(coribe.ganhoTotal).toBeCloseTo(25_696_335.23, 2);
    expect(coribe.variacaoTotal).toBeCloseTo(118.6, 1);
  });

  it("não deixa a série passar do último exercício reivindicado", async () => {
    const caso = await montarCaseSucesso([{ codigoIbge: SERRA_DO_RAMALHO, fim: 2025 }]);
    const serra = caso.municipios[0];

    // A rede tem dado de 2026 na portaria; o documento não pode usá-lo, porque
    // a consultoria não estava lá naquele exercício.
    expect(serra.serie.map((s) => s.ano)).toEqual([2022, 2023, 2024, 2025]);
    expect(serra.fim).toBe(2025);
    expect(serra.totalFim).toBeCloseTo(82_863_000, -4);
  });

  it("apura o percentil na janela do próprio município, não numa janela comum", async () => {
    const [ate2025, ate2026] = await Promise.all([
      montarCaseSucesso([{ codigoIbge: SERRA_DO_RAMALHO, fim: 2025 }]),
      montarCaseSucesso([{ codigoIbge: SERRA_DO_RAMALHO, fim: 2026 }]),
    ]);

    // Mesma rede, janelas diferentes, posições diferentes: comparar 2024–2025
    // contra o universo de 2024–2026 mediria períodos distintos.
    expect(ate2025.municipios[0].percentilBR).toBeGreaterThan(
      ate2026.municipios[0].percentilBR,
    );
    expect(ate2025.municipios[0].universoBR).toBeGreaterThan(3000);
  });

  it("compara só com quem já recebia complementação no ano-base", async () => {
    const caso = await montarCaseSucesso([{ codigoIbge: CORIBE, fim: 2026 }]);

    // Quem entrou do zero teria variação infinita e envenenaria a régua; o
    // universo é menor que o total de municípios do país por causa disso.
    expect(caso.municipios[0].universoBR).toBeGreaterThan(3000);
    expect(caso.municipios[0].universoBR).toBeLessThan(5570);
  });

  it("marca o primeiro exercício com VAAT — a habilitação, visível no dado", async () => {
    const caso = await montarCaseSucesso([{ codigoIbge: CORIBE, fim: 2026 }]);

    expect(caso.municipios[0].anoHabilitacaoVaat).toBe(2024);
    expect(caso.municipios[0].serie.find((s) => s.ano === 2023)?.vaat).toBe(0);
  });

  it("soma o agregado e conta quantas redes ficaram no topo 10% do país", async () => {
    const caso = await montarCaseSucesso([
      { codigoIbge: CORIBE, fim: 2026 },
      { codigoIbge: SITIO_DO_MATO, fim: 2026 },
      { codigoIbge: SERRA_DO_RAMALHO, fim: 2025 },
    ]);

    const somaDosGanhos = caso.municipios.reduce((s, m) => s + m.ganhoTotal, 0);
    expect(caso.agregado.ganhoTotal).toBeCloseTo(somaDosGanhos, 2);
    expect(caso.agregado.totalInicio).toBeLessThan(caso.agregado.totalFim);
    expect(caso.agregado.noTopo10).toBe(
      caso.municipios.filter((m) => m.percentilBR >= 90).length,
    );
  });

  it("abre pelo melhor resultado — a ordem é a da narrativa, não a do pedido", async () => {
    const caso = await montarCaseSucesso([
      { codigoIbge: SERRA_DO_RAMALHO, fim: 2025 },
      { codigoIbge: CORIBE, fim: 2026 },
    ]);

    expect(caso.municipios[0].codigoIbge).toBe(CORIBE);
    expect(caso.municipios[0].percentilBR).toBeGreaterThanOrEqual(
      caso.municipios[1].percentilBR,
    );
  });

  it("recusa janela que não anda para a frente", async () => {
    await expect(
      montarCaseSucesso([{ codigoIbge: CORIBE, fim: 2024, inicio: 2024 }]),
    ).rejects.toThrow(/posterior/);
  });

  it("recusa município que as portarias não trazem, em vez de imprimir zero", async () => {
    await expect(montarCaseSucesso([{ codigoIbge: "9999999", fim: 2026 }])).rejects.toThrow(
      /não trazem o município/,
    );
  });

  it("recusa lista vazia", async () => {
    await expect(montarCaseSucesso([])).rejects.toThrow(/ao menos um município/);
  });
});
