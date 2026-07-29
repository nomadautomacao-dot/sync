import { describe, expect, it } from "vitest";

import { analisarEntregas } from "@/core/lib/siconfi-entregas";

/**
 * A régua do risco VAAT: DCA até 30/4 (LRF art. 51) e, decisivo, até 31/8
 * (Lei 14.113/2020, art. 13, §4º). A análise é pura de propósito — a rede fica
 * em `getPontualidadeFiscal` — para que cada regra da régua seja testável com
 * fixture no formato real do extrato do Siconfi.
 */

function dca(exercicio: number, data: string | null, instituicao = "Prefeitura Municipal de Teste") {
  return {
    exercicio,
    instituicao,
    entregavel: "Balanço Anual (DCA)",
    periodo: 1,
    data_status: data ?? undefined,
    status_relatorio: data ? "HO" : null,
  };
}

const AGORA = new Date("2026-07-29T12:00:00Z");

describe("análise de entregas do Siconfi", () => {
  it("DCA no prazo nos dois ciclos → risco baixo", () => {
    const r = analisarEntregas(
      { 2025: [dca(2025, "2026-04-22T12:00:00Z")], 2024: [dca(2024, "2025-03-30T12:00:00Z")], 2026: [] },
      2026,
      AGORA,
    );

    expect(r.risco).toBe("baixo");
    expect(r.dca[0].diasAlemDoPrazo).toBeLessThanOrEqual(0);
    expect(r.dca[0].estourouCorteVaat).toBe(false);
    expect(r.dca[0].homologada).toBe(true);
  });

  it("DCA depois de 31/8 → risco alto, porque é o cenário que inabilita", () => {
    const r = analisarEntregas(
      { 2025: [dca(2025, "2026-04-01T12:00:00Z")], 2024: [dca(2024, "2025-09-15T12:00:00Z")], 2026: [] },
      2026,
      AGORA,
    );

    expect(r.risco).toBe("alto");
    expect(r.dca[1].estourouCorteVaat).toBe(true);
  });

  it("DCA atrasada mas antes do corte → risco médio", () => {
    // O hábito do atraso é o aviso: no ano apertado ele vira estouro.
    const r = analisarEntregas(
      { 2025: [dca(2025, "2026-06-10T12:00:00Z")], 2024: [dca(2024, "2025-04-10T12:00:00Z")], 2026: [] },
      2026,
      AGORA,
    );

    expect(r.risco).toBe("medio");
    expect(r.dca[0].diasAlemDoPrazo).toBeGreaterThan(0);
    expect(r.dca[0].estourouCorteVaat).toBe(false);
  });

  it("DCA ausente com prazo vencido conta o atraso até hoje", () => {
    const r = analisarEntregas({ 2025: [], 2024: [dca(2024, "2025-04-01T12:00:00Z")], 2026: [] }, 2026, AGORA);

    const ultima = r.dca[0];
    expect(ultima.entregueEm).toBeNull();
    // De 30/4 a 29/7 são ~90 dias de atraso corrente.
    expect(ultima.diasAlemDoPrazo).toBeGreaterThan(80);
    // 31/8 ainda não chegou: o corte não está estourado — está em risco.
    expect(ultima.estourouCorteVaat).toBeNull();
    expect(r.risco).toBe("medio");
  });

  it("ignora as entregas da Câmara — a habilitação é do Executivo", () => {
    const r = analisarEntregas(
      {
        2025: [dca(2025, "2026-09-20T12:00:00Z", "Câmara de Vereadores de Teste")],
        2024: [dca(2024, "2025-04-01T12:00:00Z")],
        2026: [],
      },
      2026,
      AGORA,
    );

    // A DCA da Câmara fora do corte não pode contaminar a leitura do ente.
    expect(r.dca[0].entregueEm).toBeNull();
  });

  it("conta RREO e RGF do exercício corrente", () => {
    const rreo = (periodo: number) => ({
      exercicio: 2026,
      instituicao: "Prefeitura Municipal de Teste",
      entregavel: "Relatório Resumido de Execução Orçamentária",
      periodo,
      data_status: "2026-05-01T12:00:00Z",
      status_relatorio: "HO",
    });
    const r = analisarEntregas(
      { 2026: [rreo(1), rreo(2), { ...rreo(1), entregavel: "Relatório de Gestão Fiscal" }], 2025: [], 2024: [] },
      2026,
      AGORA,
    );

    expect(r.rreoEntregues).toBe(2);
    expect(r.rgfEntregues).toBe(1);
  });
});
