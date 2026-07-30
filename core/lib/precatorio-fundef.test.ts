import { describe, expect, it } from "vitest";

import {
  ehContaPrecatorioFundef,
  janelaExercicios,
  lerPrecatorioFundef,
  PRIMEIRO_EXERCICIO_EC114,
} from "@/core/lib/precatorio-fundef";

/**
 * O nome da conta chega do SICONFI com o travessão quebrado (`¿`) e com acento
 * em "precatórios". Os dois códigos abaixo são reais: até 2021 o precatório do
 * FUNDEF era `1.7.1.8.13.0.0` e de 2022 em diante é `1.7.1.9.56.0.0`, com o
 * mesmo texto. É a armadilha que esta lib existe para não cair.
 */
const NOME_CONTA =
  "1.7.1.9.56.0.0 - Transferências Decorrentes de Decisão Judicial (precatórios) Relativas ao Fundo de Manutenção e Desenvolvimento do Ensino Fundamental e de Valorização do Magistério ¿ FUNDEF";

function linha(codigo: string, valor: number, conta = NOME_CONTA) {
  return { cod_conta: codigo, conta, coluna: "Receitas Brutas Realizadas", valor };
}

function exercicio(ano: number, itens: ReturnType<typeof linha>[] = [], entregou = true) {
  return { exercicio: ano, itens, entregou };
}

describe("casamento da conta", () => {
  it("reconhece a conta pelo nome, sob qualquer código", () => {
    expect(ehContaPrecatorioFundef(NOME_CONTA)).toBe(true);
    expect(
      ehContaPrecatorioFundef(
        "1.7.1.8.13.0.0 - Transferências Decorrentes de Decisão Judicial (precatórios) Relativas ao FUNDEF",
      ),
    ).toBe(true);
  });

  it("não confunde com as contas de FUNDEB, que são vizinhas na tabela", () => {
    expect(
      ehContaPrecatorioFundef(
        "1.7.1.5.00.0.0 - Transferências de Recursos de Complementação da União ao FUNDEB",
      ),
    ).toBe(false);
    expect(ehContaPrecatorioFundef("1.7.1.9.99.0.0 - Outras Transferências da União")).toBe(false);
    expect(ehContaPrecatorioFundef(undefined)).toBe(false);
  });
});

describe("a janela de exercícios", () => {
  it("termina no último exercício com DCA publicada, não no corrente", () => {
    const janela = janelaExercicios(2026);
    expect(janela[janela.length - 1]).toBe(2025);
    expect(janela).toHaveLength(6);
    expect(janela).toEqual([...janela].sort((a, b) => a - b));
  });
});

describe("a mudança de código de conta entre 2021 e 2022", () => {
  /**
   * O caso que motivou o casamento por nome. Rafael Jambeiro/BA declarou R$
   * 40,8 mi em 2020 sob `1.7.1.8.13.0.0`. Buscar só o código novo devolveria
   * zero — e zero, aqui, seria uma afirmação falsa sobre R$ 42 milhões.
   */
  it("soma os dois códigos e registra que a fonte trocou de código", () => {
    const r = lerPrecatorioFundef("2925956", [
      exercicio(2020, [linha("RO1.7.1.8.13.0.0", 40_811_940.79)]),
      exercicio(2021, [linha("RO1.7.1.8.13.0.0", 1_284_818.78)]),
      exercicio(2022, [linha("RO1.7.1.9.56.0.0", 100)]),
      exercicio(2023),
      exercicio(2024),
      exercicio(2025),
    ]);

    expect(r.total).toBe(42_096_859.57);
    expect(r.exercicios.map((e) => e.codigoConta)).toEqual([
      "1.7.1.8.13.0.0",
      "1.7.1.8.13.0.0",
      "1.7.1.9.56.0.0",
    ]);
    expect(r.observacoes.join(" ")).toContain("mais de um código");
  });

  it("descarta o prefixo RO, que é do demonstrativo e não da conta", () => {
    const r = lerPrecatorioFundef("1", [exercicio(2024, [linha("RO1.7.1.9.56.0.0", 10)])]);
    expect(r.exercicios[0].codigoConta).toBe("1.7.1.9.56.0.0");
  });
});

describe("a fronteira da EC nº 114/2021", () => {
  it("só calcula os 60% sobre o que entrou a partir de 2022", () => {
    const r = lerPrecatorioFundef("2925956", [
      exercicio(2020, [linha("RO1.7.1.8.13.0.0", 40_811_940.79)]),
      exercicio(2021, [linha("RO1.7.1.8.13.0.0", 1_284_818.78)]),
      exercicio(2022),
      exercicio(2023),
      exercicio(2024),
      exercicio(2025),
    ]);

    expect(r.recebeu).toBe(true);
    expect(r.totalAnterior).toBe(42_096_759.57);
    expect(r.totalSobEc114).toBe(0);
    // O ponto todo: recebeu R$ 42 milhões e o mínimo de abono é zero, porque a
    // regra não existia. Quem imprimir isso como "obrigação de R$ 0,00" mente.
    expect(r.minimoAbono).toBe(0);
    expect(r.observacoes.join(" ")).toContain("antes de 2022");
  });

  it("aplica os 60% ao que entrou sob a EC", () => {
    const r = lerPrecatorioFundef("2510105", [
      exercicio(2022, [linha("RO1.7.1.9.56.0.0", 938_562.78)]),
      exercicio(2023, [linha("RO1.7.1.9.56.0.0", 733_121.91)]),
      exercicio(2024, [linha("RO1.7.1.9.56.0.0", 787_562.16)]),
    ]);

    expect(r.total).toBe(2_459_246.85);
    expect(r.minimoAbono).toBe(1_475_548.11);
    expect(r.saldoMde).toBe(983_698.74);
    expect(r.minimoAbono + r.saldoMde).toBeCloseTo(r.totalSobEc114, 2);
    expect(r.primeiroExercicio).toBe(2022);
    expect(r.ultimoExercicio).toBe(2024);
  });

  it("trata o primeiro exercício sob a EC como fronteira fechada", () => {
    const r = lerPrecatorioFundef("1", [
      exercicio(PRIMEIRO_EXERCICIO_EC114 - 1, [linha("RO1.7.1.8.13.0.0", 1000)]),
      exercicio(PRIMEIRO_EXERCICIO_EC114, [linha("RO1.7.1.9.56.0.0", 1000)]),
    ]);

    expect(r.exercicios.map((e) => e.sobEc114)).toEqual([false, true]);
  });
});

describe("lacuna não é ausência", () => {
  it("nomeia os exercícios sem DCA em vez de contá-los como zero", () => {
    const r = lerPrecatorioFundef("1", [
      exercicio(2023, [], false),
      exercicio(2024, [linha("RO1.7.1.9.56.0.0", 500)]),
      exercicio(2025, [], false),
    ]);

    expect(r.semDeclaracao).toEqual([2023, 2025]);
    expect(r.observacoes.join(" ")).toContain("lacuna, não ausência");
    expect(r.total).toBe(500);
  });

  it("devolve não-recebeu quando as DCAs existem e nenhuma traz a conta", () => {
    const r = lerPrecatorioFundef("2924009", [
      exercicio(2024, [linha("RO1.7.1.5.00.0.0", 26_840_750.28, "1.7.1.5.00.0.0 - FUNDEB")]),
      exercicio(2025, [linha("RO1.7.1.5.00.0.0", 27_000_000, "1.7.1.5.00.0.0 - FUNDEB")]),
    ]);

    expect(r.recebeu).toBe(false);
    expect(r.total).toBe(0);
    expect(r.exercicios).toEqual([]);
    expect(r.semDeclaracao).toEqual([]);
  });
});

describe("higiene da leitura", () => {
  it("ignora coluna que não seja a receita realizada", () => {
    const r = lerPrecatorioFundef("1", [
      {
        exercicio: 2024,
        entregou: true,
        itens: [{ ...linha("RO1.7.1.9.56.0.0", 900), coluna: "Deduções - FUNDEB" }],
      },
    ]);

    expect(r.recebeu).toBe(false);
  });

  it("ignora valor zerado ou negativo — não é recebimento", () => {
    const r = lerPrecatorioFundef("1", [
      exercicio(2024, [linha("RO1.7.1.9.56.0.0", 0)]),
      exercicio(2025, [linha("RO1.7.1.9.56.0.0", -12)]),
    ]);

    expect(r.recebeu).toBe(false);
  });

  it("ordena os exercícios mesmo que as respostas cheguem fora de ordem", () => {
    const r = lerPrecatorioFundef("1", [
      exercicio(2025, [linha("RO1.7.1.9.56.0.0", 3)]),
      exercicio(2023, [linha("RO1.7.1.9.56.0.0", 1)]),
      exercicio(2024, [linha("RO1.7.1.9.56.0.0", 2)]),
    ]);

    expect(r.exercicios.map((e) => e.exercicio)).toEqual([2023, 2024, 2025]);
  });
});
