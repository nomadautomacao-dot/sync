import { afterEach, describe, expect, it, vi } from "vitest";

import {
  limparSegredos,
  montarEntrada,
  registrarErro,
  registrarInfo,
} from "./structured-log";

const TIPO_ERRO_REPORTADO =
  "type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("montarEntrada — contrato com o Error Reporting", () => {
  it("marca erro com severity, @type e a stack dentro de message", () => {
    // Estes três campos são o contrato inteiro: sem `severity: ERROR` a
    // entrada não é erro; sem `@type` ela fica só no Logging e nunca chega ao
    // Error Reporting; sem stack em `message` o agrupamento não acontece.
    const erro = new Error("FNDE devolveu 502");
    const entrada = montarEntrada("ERROR", "Raio-X municipal", erro);

    expect(entrada.severity).toBe("ERROR");
    expect(entrada["@type"]).toBe(TIPO_ERRO_REPORTADO);
    expect(entrada.message).toContain("FNDE devolveu 502");
    expect(entrada.message).toContain("structured-log.test");
    expect(entrada.message).toContain("[Raio-X municipal]");
  });

  it("não marca @type em severidades que não são erro", () => {
    expect(montarEntrada("INFO", "Raio-X", "3 páginas ajustadas")["@type"]).toBeUndefined();
    expect(montarEntrada("WARNING", "Raio-X", "SICONFI fora do ar")["@type"]).toBeUndefined();
  });

  it("promove o contexto a campos próprios, pesquisáveis no Logs Explorer", () => {
    const entrada = montarEntrada("ERROR", "Raio-X", new Error("x"), {
      codigoIbge: "2703106",
      exercicio: 2026,
    });
    expect(entrada.codigoIbge).toBe("2703106");
    expect(entrada.exercicio).toBe(2026);
  });

  it("impede o contexto de sobrescrever os campos do protocolo", () => {
    // Um campo de negócio chamado "message" apagaria a stack e o evento
    // deixaria de ser agrupável.
    const entrada = montarEntrada("ERROR", "Raio-X", new Error("original"), {
      message: "sequestrado",
      severity: "INFO",
      "@type": "outro",
    });
    expect(entrada.message).toContain("original");
    expect(entrada.severity).toBe("ERROR");
    expect(entrada["@type"]).toBe(TIPO_ERRO_REPORTADO);
  });

  it("aguenta o que não é Error — throw de string e de objeto", () => {
    expect(montarEntrada("ERROR", "e", "só uma string").message).toContain("só uma string");
    const deObjeto = montarEntrada("ERROR", "e", { code: 500 });
    expect(deObjeto.message).toContain("500");
    expect((deObjeto.erro as { nome: string }).nome).toBe("NonError");
  });

  it("aguenta Error sem stack", () => {
    const erro = new Error("sem rastro");
    erro.stack = undefined;
    expect(montarEntrada("ERROR", "e", erro).message).toContain("sem rastro");
  });
});

describe("limparSegredos", () => {
  it("redige token de query string", () => {
    // `qedu-api.ts` monta URL com QEDU_TOKEN; um fetch que falha traz a URL
    // inteira na mensagem, e log é lugar de onde segredo não sai mais.
    const sujo = "fetch failed: https://api.qedu.org.br/v1/x?token=abc123SEGREDO&ano=2024";
    const limpo = limparSegredos(sujo);
    expect(limpo).not.toContain("abc123SEGREDO");
    expect(limpo).toContain("token=[REDIGIDO]");
    expect(limpo).toContain("ano=2024");
  });

  it("cobre as variações usuais de nome de parâmetro", () => {
    for (const chave of ["api_key", "apikey", "secret", "password", "access_token"]) {
      expect(limparSegredos(`?${chave}=xyz`)).toContain("[REDIGIDO]");
    }
  });

  it("redige também dentro da mensagem e do contexto da entrada", () => {
    const entrada = montarEntrada("ERROR", "QEdu", new Error("falhou em ?token=xyz"), {
      url: "https://x/y?api_key=zzz",
    });
    expect(JSON.stringify(entrada)).not.toContain("xyz");
    expect(entrada.url).toContain("[REDIGIDO]");
  });
});

describe("escrita", () => {
  it("em produção sai como uma única linha JSON no stderr", () => {
    // Cloud Run captura stderr e faz o parse por linha: JSON quebrado em
    // várias linhas vira várias entradas de texto e perde o agrupamento.
    vi.stubEnv("NODE_ENV", "production");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    registrarErro("Raio-X municipal", new Error("boom"), { codigoIbge: "2703106" });

    expect(spy).toHaveBeenCalledTimes(1);
    const linha = spy.mock.calls[0][0] as string;
    expect(linha.split("\n")).toHaveLength(1);
    const objeto = JSON.parse(linha);
    expect(objeto.severity).toBe("ERROR");
    expect(objeto["@type"]).toBe(TIPO_ERRO_REPORTADO);
    expect(objeto.codigoIbge).toBe("2703106");
  });

  it("fora de produção sai legível, sem JSON de uma linha", () => {
    vi.stubEnv("NODE_ENV", "development");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    registrarInfo("Raio-X", "2 páginas ajustadas", { paginas: [12, 30] });
    const saida = spy.mock.calls[0][0] as string;
    expect(saida).toContain("[INFO] [Raio-X] 2 páginas ajustadas");
    expect(() => JSON.parse(saida)).toThrow();
  });

  it("não estoura com referência circular no contexto", () => {
    // Logger que derruba a rota some com a mensagem e com o erro original.
    vi.stubEnv("NODE_ENV", "production");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const circular: Record<string, unknown> = { nome: "x" };
    circular.eu = circular;

    expect(() => registrarErro("e", new Error("boom"), { circular })).not.toThrow();
    expect(JSON.parse(spy.mock.calls[0][0] as string).circular.eu).toBe("[circular]");
  });

  it("não estoura com BigInt no contexto", () => {
    vi.stubEnv("NODE_ENV", "production");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    // `BigInt(10)` e não `10n`: o target do projeto é ES2017, que não tem
    // literal de BigInt.
    expect(() => registrarErro("e", new Error("boom"), { grande: BigInt(10) })).not.toThrow();
    expect(JSON.parse(spy.mock.calls[0][0] as string).grande).toBe("10");
  });
});
