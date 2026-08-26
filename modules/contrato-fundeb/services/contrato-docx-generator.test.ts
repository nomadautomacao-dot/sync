import { describe, expect, it } from "vitest";

import {
  PENDENTE,
  completarDados,
  marcadorDePendencia,
  mesesPorExtenso,
  nomesDeTemplate,
  numeroSemAno,
  rotuloDoCampo,
  semVazios,
  textoDePendencias,
} from "./contrato-docx-generator";

describe("nomesDeTemplate", () => {
  it("procura a variante da via antes do arquivo comum", () => {
    expect(nomesDeTemplate("07 - Parecer Juridico.docx", "dispensa")).toEqual([
      "07 - Parecer Juridico [dispensa].docx",
      "07 - Parecer Juridico.docx",
    ]);
  });

  it("a peça sem variante cai no arquivo comum, que serve às duas vias", () => {
    const [variante, comum] = nomesDeTemplate("01 - CAPA DO PROCESSO.docx", "inexigibilidade");
    expect(variante).toBe("01 - CAPA DO PROCESSO [inexigibilidade].docx");
    expect(comum).toBe("01 - CAPA DO PROCESSO.docx");
  });

  it("preserva nome com ponto, espaço duplo e acento", () => {
    expect(nomesDeTemplate("02.1 DFD Administração.docx", "dispensa")[0]).toBe(
      "02.1 DFD Administração [dispensa].docx",
    );
    expect(nomesDeTemplate("05 - Enc. PA  Prefeito.docx", "dispensa")[0]).toBe(
      "05 - Enc. PA  Prefeito [dispensa].docx",
    );
  });

  it("só a extensão final sai — nome com .docx no meio não é mutilado", () => {
    expect(nomesDeTemplate("modelo.docx.docx", "dispensa")[0]).toBe(
      "modelo.docx [dispensa].docx",
    );
  });
});

describe("numeroSemAno", () => {
  it("tira o ano que o coletor já embute", () => {
    expect(numeroSemAno("001/2026")).toBe("001");
    expect(numeroSemAno("012 / 2026")).toBe("012");
    expect(numeroSemAno("045/26")).toBe("045");
  });

  it("deixa intacto o número que já vem sem ano", () => {
    expect(numeroSemAno("001")).toBe("001");
    expect(numeroSemAno("PA-77")).toBe("PA-77");
  });

  it("ausência vira string vazia, não 'undefined' no papel", () => {
    expect(numeroSemAno(undefined)).toBe("");
    expect(numeroSemAno(null)).toBe("");
  });
});

describe("mesesPorExtenso", () => {
  it("cobre os prazos usuais, inclusive os que a tabela antiga esquecia", () => {
    expect(mesesPorExtenso(5)).toBe("cinco");
    expect(mesesPorExtenso(12)).toBe("doze");
    expect(mesesPorExtenso(3)).toBe("três");
  });

  it("fora da tabela devolve o número — feio, nunca errado", () => {
    expect(mesesPorExtenso(17)).toBe("17");
    expect(mesesPorExtenso(undefined)).toBe("");
  });
});

describe("semVazios", () => {
  it("tira o vazio para o nullGetter assumir — vazio explícito imprimiria nada", () => {
    expect(semVazios({ a: "x", b: "", c: "   ", d: undefined, e: null })).toEqual({
      a: "x",
    });
  });

  it("zero e false ficam: são valor, não ausência", () => {
    expect(semVazios({ percentual: 0, revisado: false })).toEqual({
      percentual: 0,
      revisado: false,
    });
  });
});

describe("marcadorDePendencia", () => {
  it("escreve o marcador e anota o campo", () => {
    const vistos: string[] = [];
    const nullGetter = marcadorDePendencia((tag) => vistos.push(tag));
    expect(nullGetter({ value: "prefeitoCPF" })).toBe(PENDENTE);
    expect(vistos).toEqual(["prefeitoCPF"]);
  });

  it("não toca em loop nem em rawxml — ali texto corromperia o DOCX", () => {
    const vistos: string[] = [];
    const nullGetter = marcadorDePendencia((tag) => vistos.push(tag));
    expect(nullGetter({ value: "itens", module: "loop" })).toBe("");
    expect(nullGetter({ value: "html", module: "rawxml" })).toBe("");
    expect(vistos).toEqual([]);
  });
});

describe("completarDados", () => {
  const base = { municipioNome: "Igaci", municipioUF: "AL", exercicio: "2026" };

  it("deduz o que o sistema sabe: datas do fluxo, foro, valor global, empresa", () => {
    const completo = completarDados(base as never);
    expect(completo.empresaRazaoSocial).toBe("GLOBAL SERVICES COMPANY LTDA");
    expect(completo.foroComarca).toBe("Igaci");
    expect(completo.dataAssinatura).toBeTruthy();
    expect(completo.valorGlobal).toBeGreaterThan(0);
  });

  it("campo vazio do chamador não apaga o que o coletor sabe", () => {
    /* Os coletores devolvem "" quando não acham, e um `{...defaults, ...data}`
       puro deixava o vazio ganhar — era assim que o kit perdia a razão social
       da própria Global. */
    const completo = completarDados({ ...base, empresaRazaoSocial: "" } as never);
    expect(completo.empresaRazaoSocial).toBe("GLOBAL SERVICES COMPANY LTDA");
  });

  it("campo preenchido pelo chamador manda", () => {
    const completo = completarDados({ ...base, foroComarca: "Arapiraca" } as never);
    expect(completo.foroComarca).toBe("Arapiraca");
  });

  it("sem UF nem exercício não estoura — o kit sai com lacuna, não com erro", () => {
    const completo = completarDados({ municipioNome: "Igaci" } as never);
    expect(completo.municipioNome).toBe("Igaci");
    expect(completo.exercicio).toBe(String(new Date().getFullYear()));
  });
});

describe("textoDePendencias", () => {
  it("traz rótulo e nome cru, para achar o campo no papel e na tela", () => {
    const texto = textoDePendencias(["prefeitoCPF"], []);
    expect(texto).toContain("CPF do(a) prefeito(a) (prefeitoCPF)");
    expect(texto).toContain(PENDENTE);
  });

  it("campo sem rótulo sai com o próprio nome — feio, nunca ausente", () => {
    expect(rotuloDoCampo("campoQueNinguemMapeou")).toBe("campoQueNinguemMapeou");
    expect(textoDePendencias(["campoQueNinguemMapeou"], [])).toContain(
      "campoQueNinguemMapeou",
    );
  });

  it("lista os avisos junto — habilitação que não desceu é pendência também", () => {
    const texto = textoDePendencias([], ["certidão x não entrou"]);
    expect(texto).toContain("Nenhum campo ficou em branco.");
    expect(texto).toContain("certidão x não entrou");
  });
});
