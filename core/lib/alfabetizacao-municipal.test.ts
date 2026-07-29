import { describe, expect, it } from "vitest";
import {
  getAlfabetizacaoMunicipal,
  interpretarAlfabetizacao,
} from "./alfabetizacao-municipal";

const NIVEIS = {
  0: "Abaixo do nível 1 (até 40%)",
  1: "Nível 1 (40% a 50%)",
  2: "Nível 2 (50% a 60%)",
  3: "Nível 3 (60% a 70%)",
  4: "Nível 4 (70% a 80%)",
  5: "Nível 5 (acima de 80%)",
};
const CONTEXTO = {
  anoAvaliacao: 2025,
  niveis: NIVEIS,
  fonte: "INEP",
  fonteUfs: "INEP UF",
};

describe("interpretarAlfabetizacao", () => {
  const registro = {
    uf: "AM",
    resultados: { "2023": 52, "2024": 50, "2025": 58 },
    metas: { "2024": 57, "2025": 61, "2026": 66, "2030": 80 },
    nivel: 2,
    participacao: 81.7,
  };

  it("marca cumpriu/não cumpriu ano a ano contra a meta do próprio município", () => {
    const r = interpretarAlfabetizacao(registro, null, CONTEXTO)!;
    expect(r.serie.map((s) => s.ano)).toEqual([2023, 2024, 2025]);
    expect(r.serie.map((s) => s.cumpriu)).toEqual([null, false, false]);
    expect(r.ultimo.ano).toBe(2025);
    expect(r.ultimo.valor).toBe(58);
    expect(r.ultimo.meta).toBe(61);
  });

  it("mede a variação da série e o ritmo do último intervalo", () => {
    const r = interpretarAlfabetizacao(registro, null, CONTEXTO)!;
    // 52 → 58 = +6 pontos; último intervalo 50 → 58 = +8 por ano.
    expect(r.variacaoPontos).toBe(6);
    expect(r.ritmoObservado).toBe(8);
  });

  it("aponta a próxima meta e o ritmo que a meta final exige", () => {
    const r = interpretarAlfabetizacao(registro, null, CONTEXTO)!;
    expect(r.proximaMeta).toEqual({ ano: 2026, meta: 66, faltamPontos: 8 });
    // 80 - 58 = 22 pontos em 5 anos = 4,4/ano.
    expect(r.metaFinal).toEqual({ ano: 2030, meta: 80, ritmoNecessario: 4.4 });
  });

  it("nunca chama de próxima uma meta de ano já avaliado", () => {
    const r = interpretarAlfabetizacao(registro, null, CONTEXTO)!;
    expect(r.proximaMeta!.ano).toBeGreaterThan(r.ultimo.ano);
  });

  it("classifica participação abaixo de 80% como frágil", () => {
    expect(interpretarAlfabetizacao(registro, null, CONTEXTO)!.participacaoFragil).toBe(false);
    const fragil = interpretarAlfabetizacao(
      { ...registro, participacao: 62.4 },
      null,
      CONTEXTO,
    )!;
    expect(fragil.participacaoFragil).toBe(true);
  });

  it("usa a UF como régua apenas no mesmo ano do último resultado", () => {
    const comUf = interpretarAlfabetizacao(
      registro,
      { resultados: { "2024": 49, "2025": 57 } },
      CONTEXTO,
    )!;
    expect(comUf.uf).toEqual({ sigla: "AM", valor: 57, ano: 2025 });

    const semAnoCorrespondente = interpretarAlfabetizacao(
      registro,
      { resultados: { "2019": 40 } },
      CONTEXTO,
    )!;
    expect(semAnoCorrespondente.uf).toBeNull();
  });

  it("traduz o nível pela escala oficial do Compromisso", () => {
    expect(interpretarAlfabetizacao(registro, null, CONTEXTO)!.nivelRotulo).toBe(
      "Nível 2 (50% a 60%)",
    );
  });

  it("sem resultado publicado, devolve null em vez de série vazia", () => {
    expect(
      interpretarAlfabetizacao({ ...registro, resultados: {} }, null, CONTEXTO),
    ).toBeNull();
  });

  it("série de um único ano não inventa variação nem ritmo", () => {
    const r = interpretarAlfabetizacao(
      { ...registro, resultados: { "2025": 58 } },
      null,
      CONTEXTO,
    )!;
    expect(r.variacaoPontos).toBeNull();
    expect(r.ritmoObservado).toBeNull();
  });
});

describe("getAlfabetizacaoMunicipal", () => {
  it("lê Manaus do dataset com meta pactuada e participação", () => {
    const r = getAlfabetizacaoMunicipal("1302603")!;
    expect(r).not.toBeNull();
    expect(r.ultimo.ano).toBe(2025);
    expect(r.ultimo.valor).toBeGreaterThan(0);
    expect(r.ultimo.meta).not.toBeNull();
    expect(r.participacao).not.toBeNull();
    expect(r.uf?.sigla).toBe("AM");
    // A meta final do Compromisso para municípios é numérica (80%).
    expect(r.metaFinal?.ano).toBe(2030);
  });

  it("devolve null gracioso para município fora da divulgação", () => {
    expect(getAlfabetizacaoMunicipal("0000000")).toBeNull();
  });
});
