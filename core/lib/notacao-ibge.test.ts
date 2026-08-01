import { describe, expect, it } from "vitest";

import { numeroIbge } from "./notacao-ibge";

describe("notação de célula do IBGE", () => {
  // A razão de o arquivo existir. Confundir isto com ausência fazia a folha de
  // densidade imprimir "N/D" na população rural de toda capital.
  it("lê o traço como zero, não como ausência", () => {
    expect(numeroIbge("-")).toBe(0);
    expect(numeroIbge(" - ")).toBe(0);
  });

  it("distingue os símbolos de indisponibilidade", () => {
    expect(numeroIbge("..")).toBeNull(); // não se aplica
    expect(numeroIbge("...")).toBeNull(); // não disponível
    expect(numeroIbge("x")).toBeNull(); // omitido por sigilo
    expect(numeroIbge("X")).toBeNull();
    expect(numeroIbge("")).toBeNull();
    expect(numeroIbge("   ")).toBeNull();
  });

  it("aceita zero explícito, que não é a mesma coisa que o traço", () => {
    // "0" é zero por arredondamento de valor positivo; "-" é zero exato. Para
    // quem lê o relatório dá no mesmo, mas os dois têm de chegar como número.
    expect(numeroIbge("0")).toBe(0);
    expect(numeroIbge("0,0")).toBe(0);
  });

  it("lê os separadores pt-BR do IBGE", () => {
    expect(numeroIbge("1.234,56")).toBeCloseTo(1234.56);
    expect(numeroIbge("99,93")).toBeCloseTo(99.93);
    expect(numeroIbge("1488920")).toBe(1488920);
  });

  it("trata grupo de três dígitos após vírgula como milhar, não decimal", () => {
    // "78,090" é 78090 no formato do IBGE — ler como 78,09 erraria por mil.
    expect(numeroIbge("78,090")).toBe(78090);
    expect(numeroIbge("1,234,567")).toBe(1234567);
  });

  it("devolve null para o que não é número nem símbolo conhecido", () => {
    expect(numeroIbge(null)).toBeNull();
    expect(numeroIbge(undefined)).toBeNull();
    expect(numeroIbge({})).toBeNull();
    expect(numeroIbge("sem informação")).toBeNull();
    expect(numeroIbge(Number.NaN)).toBeNull();
  });

  it("preserva número já tipado", () => {
    expect(numeroIbge(0)).toBe(0);
    expect(numeroIbge(42.5)).toBe(42.5);
  });
});
