import { describe, expect, it } from "vitest";

import {
  LIMITE_DISPENSA_POR_VALOR_CENTS,
  VIAS_DE_CONTRATACAO,
  avisoDeLimite,
  camposDaVia,
  fundamentoPadrao,
  fundamentoPorId,
  viaPorKey,
  type ViaDeContratacao,
} from "./contratacao-direta";

describe("catálogo das vias", () => {
  it("são duas: dispensa e inexigibilidade, cada uma com fundamentos", () => {
    expect(VIAS_DE_CONTRATACAO.map((v) => v.key)).toEqual([
      "dispensa",
      "inexigibilidade",
    ]);
    for (const via of VIAS_DE_CONTRATACAO) {
      expect(via.fundamentos.length).toBeGreaterThan(0);
    }
  });

  it("todo fundamento tem id único e cita a Lei 14.133", () => {
    const ids = VIAS_DE_CONTRATACAO.flatMap((v) => v.fundamentos.map((f) => f.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const via of VIAS_DE_CONTRATACAO) {
      for (const fundamento of via.fundamentos) {
        expect(fundamento.texto).toContain("14.133/2021");
        // O artigo do texto tem de bater com o da via — trocar isso é fundamentar
        // dispensa com artigo de inexigibilidade, e vice-versa.
        expect(fundamento.texto).toContain(
          via.key === "dispensa" ? "Art. 75" : "Art. 74",
        );
      }
    }
  });

  it("via desconhecida falha alto", () => {
    expect(() => viaPorKey("licitacao" as ViaDeContratacao)).toThrow();
  });
});

describe("camposDaVia", () => {
  it("traduz a dispensa para o papel", () => {
    const campos = camposDaVia("dispensa");
    expect(campos.modalidadeNome).toBe("Dispensa de Licitação");
    expect(campos.modalidadeNomeUpper).toBe("DISPENSA DE LICITAÇÃO");
    expect(campos.modalidadeCurta).toBe("Dispensa");
    expect(campos.baseLegal).toContain("Art. 75, inciso II");
  });

  it("traduz a inexigibilidade para o papel", () => {
    const campos = camposDaVia("inexigibilidade");
    expect(campos.modalidadeNomeUpper).toBe("INEXIGIBILIDADE DE LICITAÇÃO");
    expect(campos.baseLegal).toContain("Art. 74, inciso III");
  });

  it("respeita o fundamento escolhido dentro da via", () => {
    expect(camposDaVia("inexigibilidade", "74-III-c").baseLegal).toContain(
      'alínea "c"',
    );
    expect(camposDaVia("dispensa", "75-VIII").baseLegal).toContain("inciso VIII");
  });

  it("fundamento inválido cai no padrão da via em vez de sair em branco", () => {
    expect(camposDaVia("dispensa", "inexistente").baseLegal).toBe(
      fundamentoPadrao("dispensa").texto,
    );
  });

  it("fundamento de outra via não é aceito às cegas", () => {
    // Pedir o fundamento de inexigibilidade dentro da dispensa é erro de quem
    // chama; o que não pode é o documento sair com artigo trocado sem ninguém ver.
    const campos = camposDaVia("dispensa", "74-III-f");
    expect(campos.modalidadeNome).toBe("Dispensa de Licitação");
    expect(campos.baseLegal).toContain("Art. 74");
  });
});

describe("avisoDeLimite", () => {
  it("avisa quando o valor global estoura o teto da dispensa por valor", () => {
    const aviso = avisoDeLimite("75-II", 33_000_000);
    expect(aviso).toContain("ultrapassa o limite");
    expect(aviso).toContain("330.000,00");
  });

  it("cala quando o valor cabe", () => {
    expect(avisoDeLimite("75-II", LIMITE_DISPENSA_POR_VALOR_CENTS)).toBeNull();
    expect(avisoDeLimite("75-II", 1_000_000)).toBeNull();
  });

  it("não avisa em hipótese que não é limitada por valor", () => {
    expect(avisoDeLimite("75-VIII", 99_000_000)).toBeNull();
    expect(avisoDeLimite("74-III-f", 99_000_000)).toBeNull();
  });

  it("fundamento desconhecido não inventa aviso", () => {
    expect(avisoDeLimite("nada", 99_000_000)).toBeNull();
  });
});

describe("fundamentoPorId", () => {
  it("acha em qualquer via", () => {
    expect(fundamentoPorId("74-III-f")?.rotulo).toContain("74");
    expect(fundamentoPorId("75-II")?.limitadaPorValor).toBe(true);
    expect(fundamentoPorId("nada")).toBeUndefined();
  });
});
