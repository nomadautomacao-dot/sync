import { describe, expect, it } from "vitest";
import { compararMandatos, getCicloPolitico } from "./alternancia-politica";

describe("compararMandatos", () => {
  const atual = { municipio: "X", uf: "AM", nomeCompleto: "Maria Da Silva", partido: "PT", eleicao: "2024" };

  it("reconhece reeleição pelo nome, ignorando acento e caixa", () => {
    expect(
      compararMandatos(
        { municipio: "X", uf: "AM", nomeCompleto: "MARÍA  DA SILVA", partido: "PT" },
        atual,
      ),
    ).toBe("reeleicao");
  });

  it("reeleição vale mesmo com troca de partido no meio do caminho", () => {
    expect(
      compararMandatos(
        { municipio: "X", uf: "AM", nomeCompleto: "Maria Da Silva", partido: "MDB" },
        atual,
      ),
    ).toBe("reeleicao");
  });

  it("separa sucessão no mesmo partido de alternância", () => {
    expect(
      compararMandatos({ municipio: "X", uf: "AM", nomeCompleto: "João Souza", partido: "PT" }, atual),
    ).toBe("sucessao_mesmo_partido");
    expect(
      compararMandatos({ municipio: "X", uf: "AM", nomeCompleto: "João Souza", partido: "MDB" }, atual),
    ).toBe("alternancia");
  });

  it("sem mandato anterior ou sem partido, não afirma alternância", () => {
    expect(compararMandatos(null, atual)).toBe("indeterminado");
    expect(
      compararMandatos({ municipio: "X", uf: "AM", nomeCompleto: "João Souza" }, atual),
    ).toBe("indeterminado");
  });
});

describe("getCicloPolitico", () => {
  it("lê o mandato em curso e projeta o calendário a partir do pleito", () => {
    const ciclo = getCicloPolitico("1302603")!;
    expect(ciclo).not.toBeNull();
    expect(ciclo.atual.eleicao).toBe(2024);
    expect(ciclo.mandato).toEqual({ inicio: 2025, fim: 2028 });
    expect(ciclo.proximaEleicao).toBe(2028);
  });

  it("degrada para indeterminado quando o pleito anterior não está na base", () => {
    // Manaus não consta no dataset de 2020: a comparação é impossível e não
    // pode ser inventada como alternância.
    const ciclo = getCicloPolitico("1302603")!;
    expect(ciclo.anterior).toBeNull();
    expect(ciclo.situacao).toBe("indeterminado");
  });

  it("classifica um município presente nos dois pleitos", () => {
    // Iranduba/AM está nas duas bases.
    const ciclo = getCicloPolitico("1301852")!;
    expect(ciclo.anterior).not.toBeNull();
    expect(["reeleicao", "sucessao_mesmo_partido", "alternancia"]).toContain(ciclo.situacao);
  });

  it("traz o panorama nacional como régua, somando às três situações", () => {
    const ciclo = getCicloPolitico("1301852")!;
    const p = ciclo.panorama!;
    expect(p.total).toBeGreaterThan(4000);
    expect(p.reeleitos + p.sucessoes + p.alternancias).toBe(p.total);
  });

  it("município fora da base devolve null", () => {
    expect(getCicloPolitico("0000000")).toBeNull();
  });
});
