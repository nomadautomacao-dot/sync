import { describe, expect, it } from "vitest";

import { ehJanelaDeLogin } from "./login-google.js";

describe("ehJanelaDeLogin", () => {
  it("deixa passar o handler do Firebase e a tela de conta do Google", () => {
    expect(
      ehJanelaDeLogin("https://globalconsultorias.firebaseapp.com/__/auth/handler?apiKey=x"),
    ).toBe(true);
    expect(ehJanelaDeLogin("https://accounts.google.com/o/oauth2/auth?client_id=x")).toBe(true);
  });

  it("recusa host que apenas contém o nome permitido", () => {
    // O furo clássico de comparar com `includes`: o que abriria dentro do app
    // seria uma tela pedindo a senha do Google da pessoa.
    expect(ehJanelaDeLogin("https://accounts.google.com.exemplo-malicioso.com/login")).toBe(false);
    expect(ehJanelaDeLogin("https://malicioso.com/?x=accounts.google.com")).toBe(false);
    expect(ehJanelaDeLogin("https://naoglobalconsultorias.firebaseapp.com/__/auth/handler")).toBe(
      false,
    );
  });

  it("recusa http — a rede da prefeitura não é confiável", () => {
    expect(ehJanelaDeLogin("http://accounts.google.com/o/oauth2/auth")).toBe(false);
  });

  it("recusa o que não é URL, em vez de estourar", () => {
    expect(ehJanelaDeLogin("nem url")).toBe(false);
    expect(ehJanelaDeLogin("")).toBe(false);
  });

  it("recusa as fontes que o app abre no navegador do sistema", () => {
    expect(ehJanelaDeLogin("https://www.fnde.gov.br/pnae")).toBe(false);
    expect(ehJanelaDeLogin("https://qedu.org.br/municipio/2703106")).toBe(false);
  });
});
