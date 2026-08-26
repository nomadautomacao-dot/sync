import { describe, expect, it } from "vitest";

import { codificarResumoDoKit, lerResumoDoKit } from "./kit-resumo";

describe("resumo do kit", () => {
  it("acento atravessa o cabeçalho inteiro — é o que motivou o Base64", () => {
    const resumo = {
      pendencias: ["Secretário(a) Municipal de Educação"],
      avisos: ["A certidão não desceu"],
    };
    expect(lerResumoDoKit(codificarResumoDoKit(resumo))).toEqual(resumo);
  });

  it("cabeçalho ausente vira resumo vazio, não exceção", () => {
    expect(lerResumoDoKit(null)).toEqual({ pendencias: [], avisos: [] });
    expect(lerResumoDoKit("")).toEqual({ pendencias: [], avisos: [] });
  });

  it("cabeçalho malformado também — o ZIP já foi baixado quando isto roda", () => {
    expect(lerResumoDoKit("isto-não-é-base64-de-json")).toEqual({
      pendencias: [],
      avisos: [],
    });
    expect(lerResumoDoKit(btoa("{isto não é json}"))).toEqual({
      pendencias: [],
      avisos: [],
    });
  });

  it("campo com tipo errado não vaza para a tela", () => {
    expect(lerResumoDoKit(btoa(JSON.stringify({ pendencias: "muitas" })))).toEqual({
      pendencias: [],
      avisos: [],
    });
  });
});
