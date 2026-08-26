import { describe, expect, it } from "vitest";

import { linkWhatsApp, novoContato } from "./cidade-contatos";

describe("novoContato", () => {
  it("apara os campos e descarta os vazios", () => {
    const contato = novoContato(
      {
        nome: "  Maria Prefeita  ",
        cargo: " Prefeito(a) ",
        telefone: "",
        email: "   ",
        observacao: undefined,
      },
      new Date("2026-08-14T12:00:00Z"),
      "Eli",
    );
    expect(contato.nome).toBe("Maria Prefeita");
    expect(contato.cargo).toBe("Prefeito(a)");
    expect(contato.telefone).toBeUndefined();
    expect(contato.email).toBeUndefined();
    expect(contato.observacao).toBeUndefined();
    expect(contato.criadoEm).toBe("2026-08-14T12:00:00.000Z");
    expect(contato.criadoPorNome).toBe("Eli");
  });
});

describe("linkWhatsApp", () => {
  it("acrescenta o DDI 55 quando falta", () => {
    expect(linkWhatsApp("(77) 99999-8888")).toBe("https://wa.me/5577999998888");
    expect(linkWhatsApp("77 3999-8888")).toBe("https://wa.me/557739998888");
  });

  it("não duplica o DDI de quem já o tem", () => {
    expect(linkWhatsApp("+55 77 99999-8888")).toBe("https://wa.me/5577999998888");
  });

  it("número que começa com 55 mas é só DDD+telefone não perde o DDI", () => {
    // (55) 9999-8888 — DDD 55 é o interior do Rio Grande do Sul.
    expect(linkWhatsApp("55 9999-8888")).toBe("https://wa.me/555599998888");
  });

  it("número incompleto ou vazio não vira link", () => {
    expect(linkWhatsApp("9999-8888")).toBeNull();
    expect(linkWhatsApp("")).toBeNull();
    expect(linkWhatsApp(undefined)).toBeNull();
  });
});
