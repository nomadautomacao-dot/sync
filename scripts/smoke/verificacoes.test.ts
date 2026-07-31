import { describe, expect, it } from "vitest";

import {
  LIMITE_DE_FONTES_VAZIAS,
  SONDAS_RAIO_X,
  URL_DE_PRODUCAO,
  avaliarAjusteDeEscala,
  avaliarContratoDeFolhas,
  avaliarFontesVivas,
  avaliarSaude,
  estaVazio,
  exigeConsentimentoDeProducao,
  resumir,
  valorEmCaminho,
  type SondaDeFonte,
} from "./verificacoes";

describe("valorEmCaminho", () => {
  it("desce por caminho aninhado", () => {
    expect(valorEmCaminho({ a: { b: { c: 7 } } }, "a.b.c")).toBe(7);
  });

  it("devolve undefined sem estourar quando o caminho morre no meio", () => {
    expect(valorEmCaminho({ a: null }, "a.b.c")).toBeUndefined();
    expect(valorEmCaminho({ a: 5 }, "a.b")).toBeUndefined();
    expect(valorEmCaminho(undefined, "a")).toBeUndefined();
  });
});

describe("estaVazio", () => {
  it("trata as sentinelas de ausência do pipeline como vazio", () => {
    expect(estaVazio("Não informado")).toBe(true);
    expect(estaVazio("nao informado")).toBe(true);
    expect(estaVazio("  Indisponível  ")).toBe(true);
    expect(estaVazio("Consultar TSE/DivulgaCand")).toBe(true);
  });

  it("não confunde zero com ausência", () => {
    // Zero é afirmação ("nenhum aluno abandonou"); null é "não sabemos". Cada
    // sonda decide se zero serve — `estaVazio` sozinha não pode decidir.
    expect(estaVazio(0)).toBe(false);
  });

  it("reconhece null, undefined, coleções vazias e NaN", () => {
    expect(estaVazio(null)).toBe(true);
    expect(estaVazio(undefined)).toBe(true);
    expect(estaVazio([])).toBe(true);
    expect(estaVazio({})).toBe(true);
    expect(estaVazio(Number.NaN)).toBe(true);
  });

  it("aceita valor presente", () => {
    expect(estaVazio("Fulano de Tal")).toBe(false);
    expect(estaVazio(3.5)).toBe(false);
    expect(estaVazio(["FNDE"])).toBe(false);
  });
});

const payloadCompleto = {
  metadata: { fontes: ["FNDE", "INEP"] },
  dados_basicos: { codigo_ibge: "2703106" },
  demografia: { populacao: 15_000 },
  educacao: { total_matriculas: 3_200, total_escolas: 12, ideb_anos_iniciais: 4.7 },
  fiscal: {
    situacao_lrf: "Regular",
    siconfi: { rcl: 90_000_000 },
    fundeb: {
      receita: { receita_total_prevista: 42_000_000 },
      resumo: { complementacao_uniao_total: 8_000_000 },
    },
  },
  prefeito: "Fulano de Tal",
};

describe("avaliarFontesVivas", () => {
  it("aprova quando todas as fontes responderam com dado", () => {
    const resultados = avaliarFontesVivas(payloadCompleto);
    expect(resultados).toHaveLength(SONDAS_RAIO_X.length);
    expect(resultados.every((r) => r.situacao === "ok")).toBe(true);
  });

  it("falha quando uma fonte essencial vem nula", () => {
    const payload = { ...payloadCompleto, educacao: { ...payloadCompleto.educacao, total_matriculas: null } };
    const resultados = avaliarFontesVivas(payload);
    const matriculas = resultados.find((r) => r.nome.includes("matrículas"));
    expect(matriculas?.situacao).toBe("falha");
  });

  it("falha quando uma fonte essencial numérica vem zerada", () => {
    // Matrícula zero não existe em município com rede: é coletor devolvendo o
    // default em vez de erro.
    const payload = { ...payloadCompleto, demografia: { populacao: 0 } };
    const resultados = avaliarFontesVivas(payload);
    expect(resultados.find((r) => r.nome.includes("população"))?.situacao).toBe("falha");
  });

  it("apenas alerta quando uma fonte acessória está fora do ar", () => {
    const payload = {
      ...payloadCompleto,
      fiscal: { ...payloadCompleto.fiscal, siconfi: { rcl: null } },
    };
    const resultados = avaliarFontesVivas(payload);
    expect(resultados.find((r) => r.nome.includes("RCL"))?.situacao).toBe("alerta");
    expect(resumir(resultados).falhas).toBe(0);
  });

  it("escala para falha quando a maioria das fontes acessórias some de uma vez", () => {
    // Um payload que preserva o essencial e zera o resto: é o formato exato do
    // desastre silencioso — PDF completo, 41 folhas, tudo "N/D" por dentro.
    const payload = {
      metadata: payloadCompleto.metadata,
      dados_basicos: payloadCompleto.dados_basicos,
      demografia: payloadCompleto.demografia,
      educacao: { total_matriculas: 3_200, total_escolas: 12, ideb_anos_iniciais: null },
      fiscal: {
        situacao_lrf: "Não informado",
        siconfi: { rcl: null },
        fundeb: { receita: { receita_total_prevista: 42_000_000 }, resumo: {} },
      },
      prefeito: "Não informado",
    };
    const resultados = avaliarFontesVivas(payload);
    const panorama = resultados.find((r) => r.nome.includes("panorama"));
    expect(panorama?.situacao).toBe("falha");
    expect(resumir(resultados).codigoDeSaida).toBe(1);
  });

  it("não emite panorama quando as quedas ficam no limite tolerado", () => {
    const sondas: SondaDeFonte[] = [
      { fonte: "A", caminho: "a", essencial: false },
      { fonte: "B", caminho: "b", essencial: false },
    ];
    // 1 de 2 = 50%, que não é *maior* que o limite de 50%.
    const resultados = avaliarFontesVivas({ a: 1, b: null }, sondas);
    expect(LIMITE_DE_FONTES_VAZIAS).toBe(0.5);
    expect(resultados.some((r) => r.nome.includes("panorama"))).toBe(false);
  });

  it("trata payload totalmente ausente como falha", () => {
    expect(resumir(avaliarFontesVivas({})).falhas).toBeGreaterThan(0);
  });
});

describe("avaliarSaude", () => {
  it("aprova 200 com status ok", () => {
    expect(avaliarSaude(200, { status: "ok", uptime: 42.7 }).situacao).toBe("ok");
  });

  it("reprova status HTTP diferente de 200", () => {
    expect(avaliarSaude(503, { status: "ok" }).situacao).toBe("falha");
  });

  it("reprova 200 que não afirma estar ok", () => {
    // Um 200 com corpo errado é o modo de falha mais traiçoeiro: o balanceador
    // considera o serviço vivo e o tráfego continua entrando.
    expect(avaliarSaude(200, { status: "degraded" }).situacao).toBe("falha");
    expect(avaliarSaude(200, null).situacao).toBe("falha");
  });
});

describe("avaliarContratoDeFolhas", () => {
  it("aprova quando o PDF entregue tem exatamente as folhas contratadas", () => {
    expect(avaliarContratoDeFolhas(41, 41).situacao).toBe("ok");
  });

  it("reprova divergência para mais e para menos", () => {
    expect(avaliarContratoDeFolhas(42, 41).situacao).toBe("falha");
    expect(avaliarContratoDeFolhas(40, 41).situacao).toBe("falha");
    expect(avaliarContratoDeFolhas(42, 41).detalhe).toContain("41");
  });
});

describe("avaliarAjusteDeEscala", () => {
  it("aprova quando nada precisou encolher", () => {
    expect(avaliarAjusteDeEscala([]).situacao).toBe("ok");
  });

  it("alerta, sem reprovar, quando páginas só couberam encolhidas", () => {
    // O conteúdo está lá — reverter produção por isso seria exagero. Mas é o
    // último aviso antes de o próximo município maior perder texto.
    const v = avaliarAjusteDeEscala([{ pagina: 12, escala: 0.9 }]);
    expect(v.situacao).toBe("alerta");
    expect(v.detalhe).toContain("p12");
    expect(resumir([v]).codigoDeSaida).toBe(0);
  });
});

describe("resumir", () => {
  it("alerta não derruba o deploy; falha derruba", () => {
    expect(
      resumir([
        { nome: "a", situacao: "ok", detalhe: "" },
        { nome: "b", situacao: "alerta", detalhe: "" },
      ]),
    ).toMatchObject({ situacao: "alerta", codigoDeSaida: 0, oks: 1, alertas: 1, falhas: 0 });

    expect(
      resumir([
        { nome: "a", situacao: "ok", detalhe: "" },
        { nome: "b", situacao: "falha", detalhe: "" },
      ]),
    ).toMatchObject({ situacao: "falha", codigoDeSaida: 1 });
  });

  it("lista vazia passa", () => {
    expect(resumir([]).codigoDeSaida).toBe(0);
  });
});

describe("exigeConsentimentoDeProducao", () => {
  it("libera qualquer alvo que não seja produção", () => {
    expect(exigeConsentimentoDeProducao("http://localhost:3100", false)).toBeNull();
  });

  it("barra produção sem opt-in, inclusive com barra final e caixa trocada", () => {
    expect(exigeConsentimentoDeProducao(URL_DE_PRODUCAO, false)).toContain("--producao");
    expect(exigeConsentimentoDeProducao(`${URL_DE_PRODUCAO}/`, false)).not.toBeNull();
    expect(exigeConsentimentoDeProducao(URL_DE_PRODUCAO.toUpperCase(), false)).not.toBeNull();
  });

  it("libera produção com opt-in explícito", () => {
    expect(exigeConsentimentoDeProducao(URL_DE_PRODUCAO, true)).toBeNull();
  });
});
