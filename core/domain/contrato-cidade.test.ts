import { describe, expect, it } from "vitest";

import {
  diasParaVencer,
  estaVigente,
  podeTransicionar,
  valorGlobalCents,
  type EstadoDoContrato,
} from "./contrato-cidade";

const AGORA = new Date("2026-08-14T15:00:00.000Z");

describe("valorGlobalCents", () => {
  it("multiplica mensal por meses, em centavos", () => {
    expect(valorGlobalCents({ valorMensalCents: 2_750_000, quantidadeMeses: 12 })).toBe(
      33_000_000,
    );
  });
});

describe("estaVigente", () => {
  it("assinado dentro do prazo é vigente; vencido não é", () => {
    expect(estaVigente({ estado: "assinado", vigenciaFim: "2026-12-31" }, AGORA)).toBe(true);
    expect(estaVigente({ estado: "assinado", vigenciaFim: "2026-08-13" }, AGORA)).toBe(false);
  });

  it("vence no próprio dia ainda vale o dia inteiro", () => {
    expect(estaVigente({ estado: "assinado", vigenciaFim: "2026-08-14" }, AGORA)).toBe(true);
  });

  it("minuta e cancelado nunca são vigentes", () => {
    expect(estaVigente({ estado: "minuta", vigenciaFim: "2026-12-31" }, AGORA)).toBe(false);
    expect(estaVigente({ estado: "cancelado", vigenciaFim: "2026-12-31" }, AGORA)).toBe(false);
  });

  it("assinado sem data de fim conta como vigente — dado incompleto não rebaixa", () => {
    expect(estaVigente({ estado: "assinado" }, AGORA)).toBe(true);
  });
});

describe("diasParaVencer", () => {
  it("conta os dias até o fim", () => {
    expect(diasParaVencer({ estado: "assinado", vigenciaFim: "2026-12-31" }, AGORA)).toBe(139);
    expect(diasParaVencer({ estado: "assinado", vigenciaFim: "2026-08-14" }, AGORA)).toBe(0);
  });

  it("negativo quando já venceu", () => {
    expect(diasParaVencer({ estado: "assinado", vigenciaFim: "2026-08-10" }, AGORA)).toBe(-4);
  });

  it("null sem data ou fora de assinado", () => {
    expect(diasParaVencer({ estado: "assinado" }, AGORA)).toBeNull();
    expect(diasParaVencer({ estado: "minuta", vigenciaFim: "2026-12-31" }, AGORA)).toBeNull();
  });
});

describe("podeTransicionar", () => {
  const casos: [EstadoDoContrato, EstadoDoContrato, boolean][] = [
    ["minuta", "assinado", true],
    ["minuta", "cancelado", true],
    ["minuta", "encerrado", false],
    ["assinado", "encerrado", true],
    ["assinado", "cancelado", true],
    ["assinado", "minuta", false],
    ["encerrado", "assinado", false],
    ["cancelado", "minuta", false],
  ];

  it.each(casos)("%s → %s = %s", (de, para, esperado) => {
    expect(podeTransicionar(de, para)).toBe(esperado);
  });

  it("estado igual não é transição", () => {
    expect(podeTransicionar("minuta", "minuta")).toBe(false);
  });
});
