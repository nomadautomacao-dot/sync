import { describe, expect, it } from "vitest";
import { interpretarCauc, lerExtratoCauc } from "./cauc-requisitos";

/**
 * Extrato sintético no formato exato do Tesouro: três linhas de preâmbulo,
 * cabeçalho com os códigos dos itens, campos entre aspas separados por `;`.
 */
const CSV = [
  '"Data da Pesquisa: 29/07/2026"',
  '"Tipo de Ente: Municípios"',
  '"Abrangência: CNPJ principal dos Entes Federados"',
  '"UF";"Nome do Ente Federado";"Código IBGE";"Código SIAFI";"Região";"População";"Fonte";"1.1";"3.2.3";"5.5";"5.7";"3.6"',
  // Município regular: tudo comprovado, um item desabilitado.
  '"AM";"Manaus";"1302603";"0255";"N";"1802525";;"Desabilitado";"30/07/26";"30/01/27";"30/01/27";"29/07/26"',
  // Município com pendências, uma delas de educação (3.2.3 = Anexo 8 ao SIOPE).
  '"AC";"Acrelândia";"1200013";"0643";"N";"12538";;"Desabilitado";"!";"30/01/27";"!";"29/07/26"',
].join("\n");

const extrato = lerExtratoCauc(CSV);

describe("lerExtratoCauc", () => {
  it("lê a data da pesquisa do preâmbulo e converte para ISO", () => {
    expect(extrato.dataPesquisa).toBe("2026-07-29");
  });

  it("conta o panorama nacional de entes com ao menos uma pendência", () => {
    expect(extrato.total).toBe(2);
    expect(extrato.comPendencia).toBe(1);
  });

  it("identifica as colunas de item pelo nome, não pela posição", () => {
    // Um extrato com itens novos no meio não pode deslocar a leitura.
    const comItemNovo = lerExtratoCauc(
      [
        '"Data da Pesquisa: 29/07/2026"',
        '"Tipo de Ente: Municípios"',
        '"Abrangência: CNPJ principal"',
        '"UF";"Nome do Ente Federado";"Código IBGE";"Código SIAFI";"Região";"População";"Fonte";"1.1";"9.9";"5.5"',
        '"AM";"Manaus";"1302603";"0255";"N";"1802525";;"29/07/26";"!";"30/01/27"',
      ].join("\n"),
    );
    const r = interpretarCauc(comItemNovo, "1302603")!;
    expect(r.pendencias.map((p) => p.codigo)).toEqual(["9.9"]);
    // Item desconhecido ganha rótulo genérico em vez de sumir.
    expect(r.pendencias[0].rotulo).toContain("9.9");
    expect(r.requisitos.find((x) => x.codigo === "5.5")?.situacao).toBe("comprovado");
  });
});

describe("interpretarCauc", () => {
  it("separa comprovado, pendente e desabilitado — sem tratar desabilitado como falha", () => {
    const r = interpretarCauc(extrato, "1302603")!;
    expect(r.pendencias).toHaveLength(0);
    expect(r.comprovados).toBe(4);
    expect(r.desabilitados).toBe(1);
    expect(r.requisitos.find((x) => x.codigo === "1.1")?.situacao).toBe("desabilitado");
  });

  it("nomeia as pendências e destaca as de educação/FUNDEB", () => {
    const r = interpretarCauc(extrato, "1200013")!;
    expect(r.pendencias.map((p) => p.codigo)).toEqual(["3.2.3", "5.7"]);
    expect(r.pendenciasEducacao.map((p) => p.codigo)).toEqual(["3.2.3", "5.7"]);
    expect(r.pendencias[0].rotulo).toContain("Anexo 8");
    expect(r.pendenciasEducacao[1].rotulo).toContain("VAAT");
  });

  it("aponta o requisito comprovado que vence primeiro", () => {
    const r = interpretarCauc(extrato, "1302603")!;
    expect(r.proximoVencimento).toEqual({
      codigo: "3.6",
      rotulo: "Transparência da execução orçamentária e financeira em meio eletrônico",
      validadeAte: "2026-07-29",
    });
  });

  it("propaga o panorama nacional para dar régua à pendência local", () => {
    expect(interpretarCauc(extrato, "1302603")!.panorama).toEqual({ comPendencia: 1, total: 2 });
  });

  it("município fora do extrato devolve null", () => {
    expect(interpretarCauc(extrato, "9999999")).toBeNull();
  });

  it("aceita o código com máscara, normalizando os dígitos", () => {
    expect(interpretarCauc(extrato, "1.302.603")).not.toBeNull();
  });

  it("recusa extrato sem cabeçalho reconhecível em vez de devolver dado vazio", () => {
    expect(() => lerExtratoCauc('"qualquer coisa"\n"outra"\n"terceira"\n"sem cabecalho"')).toThrow(
      /Cabeçalho/,
    );
  });
});
