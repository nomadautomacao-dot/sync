import { describe, expect, it } from "vitest";

import { montarDemografia } from "@/core/lib/demografia-educacional";

/**
 * A análise é pura de propósito — a rede fica em `getDemografiaEducacional`
 * — para que a aritmética das coortes seja testável com fixture. O erro caro
 * aqui seria de calendário: dizer que a coorte de 2024 chega à pré-escola no
 * ano errado transforma a única página preditiva do relatório em promessa
 * furada com data marcada.
 */

/** Códigos reais do agregado 9514: 6557 = <1 ano, 6558.. = 1 ano em diante. */
function populacao(porIdade: Record<number, number>): Map<number, number> {
  return new Map(Object.entries(porIdade).map(([k, v]) => [Number(k), v]));
}

describe("demografia educacional", () => {
  it("agrega a população nas faixas que a rede atende", () => {
    const r = montarDemografia(
      populacao({
        6557: 100, 6558: 110, 6559: 120, 6560: 130, // creche 0-3
        6561: 140, 6562: 150, // pré 4-5
        6563: 10, 6564: 10, 6565: 10, 6566: 10, 6567: 10, // AI 6-10
        6568: 20, 6569: 20, 6570: 20, 6571: 20, // AF 11-14
      }),
      new Map(),
    )!;

    expect(r.faixas.creche).toBe(460);
    expect(r.faixas.preEscola).toBe(290);
    expect(r.faixas.anosIniciais).toBe(50);
    expect(r.faixas.anosFinais).toBe(80);
  });

  it("mantém o calendário das coortes: pré aos 4, fundamental aos 6", () => {
    const r = montarDemografia(new Map(), new Map([[2024, 480], [2020, 552]]))!;

    const c2024 = r.nascimentos.find((c) => c.anoNascimento === 2024)!;
    expect(c2024.chegaPreEscolaEm).toBe(2028);
    expect(c2024.chegaPrimeiroAnoEm).toBe(2030);
    // Ordenadas da mais antiga para a mais recente, sempre.
    expect(r.nascimentos[0].anoNascimento).toBe(2020);
  });

  it("mede a tendência entre a primeira e a última coorte", () => {
    const r = montarDemografia(
      new Map(),
      new Map([[2020, 552], [2021, 571], [2022, 531], [2023, 524], [2024, 480]]),
    )!;

    // (480 − 552) / 552 = −13,0%.
    expect(r.tendenciaNascimentosPct).toBeCloseTo(-13, 0);
  });

  it("não inventa tendência com uma coorte só", () => {
    const r = montarDemografia(new Map(), new Map([[2024, 480]]))!;
    expect(r.tendenciaNascimentosPct).toBeNull();
  });

  it("descarta anos zerados em vez de tratá-los como colapso demográfico", () => {
    // O Registro Civil devolve zero para ano ainda não consolidado; entrar na
    // série faria a tendência despencar para −100% sem nenhum bebê a menos.
    const r = montarDemografia(new Map(), new Map([[2022, 531], [2023, 524], [2025, 0]]))!;
    expect(r.nascimentos.map((c) => c.anoNascimento)).toEqual([2022, 2023]);
  });

  it("devolve null quando não há nada a dizer", () => {
    expect(montarDemografia(new Map(), new Map())).toBeNull();
  });

  it("calcula a maternidade adolescente sobre o total do mesmo ano", () => {
    // Serra do Ramalho, 2024 (sonda real): 86 de 480 nascimentos = 17,9%.
    const r = montarDemografia(
      new Map(),
      new Map([[2023, 524], [2024, 480]]),
      new Map([[2023, 90], [2024, 86]]),
    )!;

    expect(r.maesAdolescentes).toEqual({ ano: 2024, nascimentos: 86, percentualDoTotal: 17.9 });
  });

  it("omite a maternidade adolescente quando a série da idade da mãe falta", () => {
    const r = montarDemografia(new Map(), new Map([[2024, 480]]))!;
    expect(r.maesAdolescentes).toBeNull();
  });
});
