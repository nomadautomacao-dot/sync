import { describe, expect, it } from "vitest";

import {
  SERVICOS_PADRAO,
  aberturaDaProposta,
  dataPorExtenso,
  formatarReais,
  prazoPorExtenso,
  valorGlobalCents,
} from "./proposta-dispensa";

describe("SERVICOS_PADRAO", () => {
  it("são os 6 itens do modelo, na ordem", () => {
    expect(SERVICOS_PADRAO).toHaveLength(6);
    expect(SERVICOS_PADRAO[0].titulo).toBe("i-Educar");
    expect(SERVICOS_PADRAO[5].titulo).toContain("Eixos de atuação");
  });

  it("todo item tem título e nenhum detalhe vazio", () => {
    for (const item of SERVICOS_PADRAO) {
      expect(item.titulo.trim()).not.toBe("");
      for (const detalhe of item.detalhes) {
        expect(detalhe.trim()).not.toBe("");
      }
    }
  });

  it("os typos do modelo original não sobreviveram", () => {
    const tudo = JSON.stringify(SERVICOS_PADRAO);
    expect(tudo).not.toContain("viodeoconferência");
    expect(tudo).not.toContain("freqüência");
    expect(tudo).not.toContain("Prestação ser serviços");
  });
});

describe("valores", () => {
  it("global = mensal × meses", () => {
    expect(valorGlobalCents({ valorMensalCents: 2_750_000, prazoMeses: 12 })).toBe(
      33_000_000,
    );
  });

  it("formata em reais pt-BR", () => {
    expect(formatarReais(2_750_000)).toContain("27.500,00");
    expect(formatarReais(2_750_000)).toContain("R$");
  });
});

describe("dataPorExtenso", () => {
  it("escreve a data por extenso", () => {
    expect(dataPorExtenso("2026-08-14")).toBe("14 de agosto de 2026");
    expect(dataPorExtenso("2027-01-01")).toBe("1 de janeiro de 2027");
  });

  it("recusa data inválida em vez de imprimir lixo no papel", () => {
    expect(() => dataPorExtenso("14/08/2026")).toThrow();
    expect(() => dataPorExtenso("2026-13-01")).toThrow();
  });
});

describe("prazoPorExtenso", () => {
  it("prazo usual sai com o número por extenso", () => {
    expect(prazoPorExtenso(12)).toBe("12 (doze) meses");
    expect(prazoPorExtenso(1)).toBe("1 (um) mês");
  });

  it("prazo fora da tabela sai só com o número — nunca extenso errado", () => {
    expect(prazoPorExtenso(17)).toBe("17 meses");
  });
});

describe("aberturaDaProposta", () => {
  it("cita a via e o artigo certos", () => {
    expect(aberturaDaProposta("dispensa")).toContain("dispensa de licitação");
    expect(aberturaDaProposta("dispensa")).toContain("Art. 75");
    expect(aberturaDaProposta("inexigibilidade")).toContain("inexigibilidade de licitação");
    expect(aberturaDaProposta("inexigibilidade")).toContain("Art. 74");
  });

  it("sem via informada, sai como dispensa — o caso comum", () => {
    expect(aberturaDaProposta()).toContain("Art. 75");
  });

  it("nunca cita as duas vias na mesma frase", () => {
    const texto = aberturaDaProposta("inexigibilidade");
    expect(texto).not.toContain("Art. 75");
    expect(texto.toLowerCase()).not.toContain("dispensa");
  });
});
