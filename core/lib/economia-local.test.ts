import { describe, expect, it } from "vitest";

import { montarCulturaDominante, montarEconomia } from "@/core/lib/economia-local";

/**
 * A análise é pura de propósito — a rede fica em `getEconomiaLocal`. O erro
 * caro aqui seria de classificação: chamar de "cidade de fazenda" um município
 * de prefeitura muda a leitura de evasão inteira do relatório.
 */
describe("economia local", () => {
  it("calcula participações sobre o VAB total e elege o dominante", () => {
    // Serra do Ramalho, PIB 2021 (probe real): adm. pública dominante.
    const e = montarEconomia(
      { total: 391_000, agropecuaria: 113_758, industria: 30_889, servicos: 106_743, administracao: 139_610 },
      2021,
      82.19,
      null,
    );

    expect(e.setores.agropecuaria).toBeCloseTo(29.1, 0);
    expect(e.setores.administracao).toBeCloseTo(35.7, 0);
    expect(e.setorDominante).toBe("administracao");
    expect(e.anoPib).toBe(2021);
  });

  it("estima analfabetos só quando tem o denominador de verdade", () => {
    const comPopulacao = montarEconomia({ total: 100, agropecuaria: 40 }, 2021, 82, 20_000);
    expect(comPopulacao.analfabetosEstimados).toBe(3_600); // 18% de 20 mil

    const semPopulacao = montarEconomia({ total: 100, agropecuaria: 40 }, 2021, 82, null);
    expect(semPopulacao.analfabetosEstimados).toBeNull();
  });

  it("sem VAB total não inventa participação nem dominante", () => {
    const e = montarEconomia({}, null, 97.4, null);
    expect(e.setores.agropecuaria).toBeNull();
    expect(e.setorDominante).toBeNull();
    expect(e.taxaAlfabetizacao).toBe(97.4);
  });
});

describe("cultura dominante da PAM", () => {
  it("elege a cultura de maior valor sem deixar o Total diluir a participação", () => {
    // Se o "Total" da própria PAM entrasse no denominador, toda participação
    // cairia pela metade — o erro caro que este teste trava.
    const c = montarCulturaDominante(
      new Map([
        ["Total", 1000],
        ["Banana (cacho)", 348],
        ["Mandioca", 300],
        ["Feijão (em grão)", 352],
      ]),
      2024,
    )!;

    expect(c.nome).toBe("Feijão");
    expect(c.participacaoPct).toBeCloseTo(35.2, 1);
    expect(c.anoPam).toBe(2024);
  });

  it("sem lavoura com valor, devolve null em vez de cultura fantasma", () => {
    expect(montarCulturaDominante(new Map(), 2024)).toBeNull();
    expect(montarCulturaDominante(new Map([["Soja (em grão)", 0]]), 2024)).toBeNull();
  });
});
