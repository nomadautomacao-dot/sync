import { describe, expect, it } from "vitest";

import { dataDeReferenciaDoCenso, janelaDoCenso } from "./calendario-fundeb";

/**
 * O mesmo levantamento diz coisas diferentes em março e em novembro: o Censo
 * fotografa a rede na última quarta-feira de maio, e matrícula aberta depois
 * dela só conta no ano seguinte.
 */
describe("data de referência do Censo", () => {
  it("é a última quarta-feira de maio", () => {
    expect(dataDeReferenciaDoCenso(2026)).toBe("2026-05-27");
    expect(dataDeReferenciaDoCenso(2027)).toBe("2027-05-26");
    expect(dataDeReferenciaDoCenso(2028)).toBe("2028-05-31");
  });
});

describe("o que ainda dá tempo, conforme o mês da emissão", () => {
  const em = (iso: string) => janelaDoCenso(new Date(`${iso}T12:00:00-03:00`));

  it("em fevereiro há tempo para crescer a rede para o Censo do próprio ano", () => {
    const j = em("2027-02-10");
    expect(j.fase).toBe("preparacao");
    expect(j.censoDaMatricula).toBe(2027);
    expect(j.receitaDaMatricula).toBe(2028);
    expect(j.fracaoDoPrimeiroCiclo).toBeLessThan(0.4);
  });

  it("em abril só cabe o que é rápido", () => {
    const j = em("2027-04-20");
    expect(j.fase).toBe("reta-final");
    expect(j.censoDaMatricula).toBe(2027);
    expect(j.acoes.join(" ")).toContain("fica para o Censo 2028");
  });

  it("em junho a rede está congelada: matrícula nova só no Censo seguinte, declaração ainda neste", () => {
    const j = em("2027-06-15");
    expect(j.fase).toBe("coleta");
    expect(j.censoDaMatricula).toBe(2028);
    expect(j.censoDaDeclaracao).toBe(2027);
    expect(j.receitaDaDeclaracao).toBe(2028);
  });

  it("até 23/10/2026 ainda se retifica o Censo de 2026", () => {
    const j = em("2026-10-20");
    expect(j.fase).toBe("retificacao");
    expect(j.retificacaoEstimada).toBe(false);
    expect(j.censoDaDeclaracao).toBe(2026);
  });

  it("em novembro de 2026 o Censo fechou e o primeiro ciclo é o de 2027, com metade de um ano", () => {
    const j = em("2026-11-12");
    expect(j.fase).toBe("encerrado");
    expect(j.censoDaMatricula).toBe(2027);
    expect(j.receitaDaMatricula).toBe(2028);
    expect(j.censoDaDeclaracao).toBe(2027);
    expect(j.dataDeReferencia).toBe("2027-05-26");
    expect(j.mesesAteReferencia).toBeCloseTo(6.4, 1);
    expect(j.fracaoDoPrimeiroCiclo).toBeCloseTo(0.53, 2);
  });

  it("logo depois de maio o próximo Censo tem quase um ano inteiro", () => {
    expect(em("2027-06-01").fracaoDoPrimeiroCiclo).toBeGreaterThan(0.95);
  });

  it("marca a retificação como estimada fora de 2026", () => {
    expect(em("2027-09-10").retificacaoEstimada).toBe(true);
  });

  it("recusa data inválida", () => {
    expect(() => janelaDoCenso(new Date("x"))).toThrow();
  });
});
