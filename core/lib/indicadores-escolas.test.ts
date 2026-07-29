import { describe, expect, it } from "vitest";

import {
  cruzarContextoResultado,
  getIndicadoresEscolas,
  resumirIndicadores,
  type IndicadoresEscola,
} from "@/core/lib/indicadores-escolas";

function escola(parcial: Partial<IndicadoresEscola> & { codigo: string }): IndicadoresEscola {
  return {
    nome: `Escola ${parcial.codigo}`,
    inse: null,
    inseNivel: null,
    inseAlunos: null,
    icg: null,
    tdiFund: null,
    aprovacaoFund: null,
    abandonoFund: null,
    docentesAdequadosFund: null,
    ...parcial,
  };
}

describe("resumo dos indicadores por escola", () => {
  it("pondera o INSE da rede pelos respondentes, não pela média simples", () => {
    // 100 alunos a 4,0 e 10 alunos a 6,0: a média simples (5,0) esconderia
    // que quase toda a rede vive no contexto mais duro.
    const r = resumirIndicadores([
      escola({ codigo: "1", inse: 4.0, inseAlunos: 100 }),
      escola({ codigo: "2", inse: 6.0, inseAlunos: 10 }),
    ]);
    expect(r.inseMedioRede).toBeCloseTo(4.18, 2);
  });

  it("nomeia a escola do pior abandono e da pior distorção", () => {
    const r = resumirIndicadores([
      escola({ codigo: "1", nome: "A", abandonoFund: 1.2, tdiFund: 30 }),
      escola({ codigo: "2", nome: "B", abandonoFund: 8.4, tdiFund: 12 }),
      escola({ codigo: "3", nome: "C", abandonoFund: 0 }),
    ]);
    expect(r.comAbandono).toBe(2);
    expect(r.piorAbandono).toEqual({ nome: "B", valor: 8.4 });
    expect(r.piorDistorcao).toEqual({ nome: "A", valor: 30 });
  });

  it("devolve nulls quando nenhuma escola tem o dado", () => {
    const r = resumirIndicadores([escola({ codigo: "1" })]);
    expect(r.inseMedioRede).toBeNull();
    expect(r.piorAbandono).toBeNull();
    expect(r.mediaDocentesAdequados).toBeNull();
  });
});

describe("cruzamento contexto × resultado", () => {
  const rede = [
    escola({ codigo: "1", nome: "Dura que performa", inse: 4.0 }),
    escola({ codigo: "2", nome: "Dura que sofre", inse: 4.2 }),
    escola({ codigo: "3", nome: "Mediana", inse: 4.8 }),
    escola({ codigo: "4", nome: "Favorável que entrega", inse: 5.4 }),
    escola({ codigo: "5", nome: "Favorável que não converte", inse: 5.6 }),
  ];
  const ideb = new Map([
    ["1", 5.8],
    ["2", 3.9],
    ["3", 4.8],
    ["4", 5.5],
    ["5", 4.1],
  ]);

  it("acha a resiliente (contexto duro, resultado alto) e o alerta (o inverso)", () => {
    const c = cruzarContextoResultado(ideb, rede)!;
    expect(c.avaliadas).toBe(5);
    expect(c.medianaInse).toBe(4.8);
    expect(c.medianaIdeb).toBe(4.8);
    expect(c.resiliente?.nome).toBe("Dura que performa");
    expect(c.alerta?.nome).toBe("Favorável que não converte");
  });

  it("não inventa medianas com menos de 5 pares", () => {
    expect(cruzarContextoResultado(ideb, rede.slice(0, 4))).toBeNull();
  });

  it("ignora escolas sem INSE ou sem IDEB em vez de tratá-las como zero", () => {
    const c = cruzarContextoResultado(
      ideb,
      [...rede, escola({ codigo: "6", nome: "Sem INSE" }), escola({ codigo: "7", nome: "Sem IDEB", inse: 3.0 })],
    )!;
    expect(c.avaliadas).toBe(5);
  });
});

describe("leitura do dataset", () => {
  it("agrega o caso conhecido da sonda (Alta Floresta D'Oeste/RO)", () => {
    // EMEIEF Ana Nery, valores conferidos na planilha do INEP em 2026-07-29.
    const m = getIndicadoresEscolas("1100015")!;
    expect(m).not.toBeNull();
    const anaNery = m.escolas.find((e) => e.codigo === "11024372")!;
    expect(anaNery.inse).toBe(4.29);
    expect(anaNery.inseNivel).toBe(3);
    expect(anaNery.tdiFund).toBe(13.7);
    expect(anaNery.aprovacaoFund).toBe(97.1);
    expect(anaNery.docentesAdequadosFund).toBe(30.8);
    expect(m.anos.inse).toBe(2023);
  });

  it("ordena do sinal de fluxo mais grave para o menos", () => {
    const m = getIndicadoresEscolas("1100015")!;
    const abandonos = m.escolas.map((e) => e.abandonoFund ?? -1);
    for (let i = 1; i < abandonos.length; i++) {
      if (abandonos[i - 1] !== abandonos[i]) {
        expect(abandonos[i - 1]).toBeGreaterThanOrEqual(abandonos[i]);
      }
    }
  });

  it("devolve null para município inexistente", () => {
    expect(getIndicadoresEscolas("0000000")).toBeNull();
  });
});
