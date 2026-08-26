import { describe, expect, it } from "vitest";

import { corpoDaEdicao } from "./collaborators-firestore";
import { linkDeWhatsapp, whatsappDoColaborador } from "./people-types";

describe("corpoDaEdicao", () => {
  it("não deixa a edição encostar nos números apurados", () => {
    // O risco concreto: a ficha grava com `merge`, então qualquer campo que
    // escapasse para o corpo sobrescreveria o valor no Firestore. Salvar um
    // telefone não pode zerar comissão paga nem lucro acumulado.
    const corpo = corpoDaEdicao({ phone: "77 99166-5000" });

    expect(Object.keys(corpo)).toEqual(["phone"]);
    expect(corpo).not.toHaveProperty("commissionPaidYtd");
    expect(corpo).not.toHaveProperty("profitAccruedYtd");
    expect(corpo).not.toHaveProperty("sourcedCitiesCount");
  });

  it("transforma campo apagado em null, que é o que o Firestore aceita", () => {
    // `undefined` faz o `setDoc` estourar; string vazia entraria como dado.
    expect(corpoDaEdicao({ pixKey: "" })).toEqual({ pixKey: null });
    expect(corpoDaEdicao({ whatsapp: "   " })).toEqual({ whatsapp: null });
  });

  it("ignora o que não foi enviado, em vez de gravar vazio por cima", () => {
    expect(corpoDaEdicao({})).toEqual({});
  });

  it("normaliza UF e apara espaço do que é texto livre", () => {
    expect(corpoDaEdicao({ state: " ba ", fullName: "  Tais Cristina  " })).toEqual({
      state: "BA",
      fullName: "Tais Cristina",
    });
  });

  it("preserva comissão zero — zero é um número, não ausência", () => {
    expect(corpoDaEdicao({ defaultCommissionPercent: 0 })).toEqual({
      defaultCommissionPercent: 0,
    });
  });
});

describe("whatsappDoColaborador", () => {
  it("usa o telefone quando não há WhatsApp próprio", () => {
    expect(whatsappDoColaborador({ phone: "+55 77 99166-5000" })).toEqual({
      numero: "+55 77 99166-5000",
      mesmoDoTelefone: true,
    });
  });

  it("prefere o WhatsApp próprio de quem tem dois números", () => {
    expect(whatsappDoColaborador({ phone: "77 3333-1000", whatsapp: "77 99166-5000" })).toEqual({
      numero: "77 99166-5000",
      mesmoDoTelefone: false,
    });
  });

  it("devolve null quando não há número nenhum", () => {
    expect(whatsappDoColaborador({})).toBeNull();
    expect(whatsappDoColaborador({ phone: "  " })).toBeNull();
  });
});

describe("linkDeWhatsapp", () => {
  it("põe o código do país em número que não o tem", () => {
    expect(linkDeWhatsapp("(77) 99166-5000")).toBe("https://wa.me/5577991665000");
  });

  it("respeita o código do país já digitado", () => {
    expect(linkDeWhatsapp("+55 77 99166-5000")).toBe("https://wa.me/5577991665000");
  });

  it("recusa o que não tem cara de telefone", () => {
    // Link chutado abre conversa com um desconhecido — pior que não ter link.
    expect(linkDeWhatsapp("99166")).toBeNull();
    expect(linkDeWhatsapp("ramal 42")).toBeNull();
    expect(linkDeWhatsapp("+1 415 555 0100")).toBeNull();
  });
});
