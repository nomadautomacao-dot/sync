import { describe, expect, it } from "vitest";

import { getIdebEscolas } from "@/core/lib/ideb-escolas";
import { getSituacaoVaar } from "@/core/lib/fundeb-vaar";

/**
 * A tese do dataset: a marca `nd` (resultado retido por participação < 80%)
 * é o rastro, escola a escola, da Condicionalidade II do VAAR. Estes testes
 * travam a ordenação — o sinal grave primeiro — e a ligação com o VAAR no
 * caso real que os dois datasets confirmam.
 */
describe("Saeb e IDEB por escola", () => {
  it("traz a rede municipal identificada, com nome e código INEP", () => {
    const r = getIdebEscolas("2930154")!; // Serra do Ramalho/BA

    expect(r.uf).toBe("BA");
    expect(r.escolas.length).toBeGreaterThan(10);
    for (const escola of r.escolas.slice(0, 5)) {
      // Código INEP real: 8 dígitos com prefixo da UF (29 = BA).
      expect(escola.codigo).toMatch(/^29\d{6}$/);
      expect(escola.nome.length).toBeGreaterThan(3);
    }
  });

  it("ordena o sinal grave primeiro: ND, depois pior IDEB", () => {
    const r = getIdebEscolas("1100080")!; // Costa Marques/RO
    const nds = r.escolas.map((e) => e.ai?.nd === true || e.af?.nd === true);

    // Todos os ND vêm antes de qualquer não-ND.
    const primeiroNaoNd = nds.indexOf(false);
    expect(nds.slice(primeiroNaoNd).every((v) => v === false)).toBe(true);
    expect(r.resumo.semResultadoPorParticipacao).toBeGreaterThan(0);
  });

  it("liga o ND à Condicionalidade II no caso que os dois datasets confirmam", () => {
    // Costa Marques reprovou na Cond. II do VAAR 2026 e tem escolas com
    // resultado retido por participação no Saeb 2023 — o rastro e a sanção,
    // cada um na sua fonte oficial.
    const vaar = getSituacaoVaar("1100080")!;
    expect(vaar.reprovadas).toContain("II");

    const r = getIdebEscolas("1100080")!;
    const nd = r.escolas.filter((e) => e.ai?.nd || e.af?.nd);
    expect(nd.length).toBeGreaterThanOrEqual(2);
    for (const escola of nd) expect(escola.nome.length).toBeGreaterThan(3);
  });

  it("calcula a amplitude que a média municipal esconde", () => {
    const r = getIdebEscolas("2930154")!;
    if (r.resumo.amplitudeAi !== null) {
      expect(r.resumo.amplitudeAi).toBeCloseTo(
        (r.resumo.melhorIdebAi ?? 0) - (r.resumo.piorIdebAi ?? 0),
        1,
      );
      expect(r.resumo.amplitudeAi).toBeGreaterThanOrEqual(0);
    }
  });

  it("devolve null para município desconhecido em vez de lançar", () => {
    expect(getIdebEscolas("0000000")).toBeNull();
    expect(getIdebEscolas("")).toBeNull();
  });
});
