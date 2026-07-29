import { describe, expect, it } from "vitest";
import { getEmendasMunicipio } from "./emendas-municipais";

describe("getEmendasMunicipio", () => {
  it("devolve a série anual de Manaus com o recorte de educação e autores", () => {
    const registro = getEmendasMunicipio("1302603");
    expect(registro).not.toBeNull();
    const anos = registro!.anos.map((a) => a.ano);
    expect(anos).toEqual([...anos].sort());
    const a2024 = registro!.anos.find((a) => a.ano === 2024);
    expect(a2024).toBeDefined();
    expect(a2024!.empenhado).toBeGreaterThan(0);
    expect(a2024!.empenhadoEducacao).toBeGreaterThan(0);
    expect(a2024!.empenhadoEducacao).toBeLessThanOrEqual(a2024!.empenhado);
    expect(registro!.autoresEducacao.length).toBeGreaterThan(0);
    expect(registro!.fonte).toContain("Portal da Transparência");
  });

  it("devolve null gracioso para código inexistente", () => {
    expect(getEmendasMunicipio("0000000")).toBeNull();
  });
});
