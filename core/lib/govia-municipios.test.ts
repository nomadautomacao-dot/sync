import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/municipios/buscar/route";
import {
  findGoviaMunicipio,
  listGoviaMunicipiosByRegionalContext,
  searchGoviaMunicipios,
} from "@/core/lib/govia-compat";
import { lerJsonDeDados } from "@/core/lib/dados-arquivo";

describe("identificação de municípios sem conexão com o IBGE", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("unable to verify the first certificate")));
  });

  afterEach(() => {
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("a rota do autocomplete retorna HTTP 200 quando a rede está indisponível", async () => {
    const response = await GET(new NextRequest("http://localhost/api/municipios/buscar?q=Serra%20do%20Ramalho"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      count: 1,
      data: [{ codigo_ibge: "2930154", nome: "Serra do Ramalho", uf: "BA", regiao: "Nordeste" }],
    });
  });

  it("normaliza acentos, filtra a UF e preserva aliases", async () => {
    expect(await searchGoviaMunicipios("sao paulo", " sp ")).toContainEqual({
      codigo_ibge: "3550308", nome: "São Paulo", uf: "SP", regiao: "Sudeste",
    });
    expect(await searchGoviaMunicipios("Dona Eusebia", "MG")).toContainEqual({
      codigo_ibge: "3122900", nome: "Dona Euzébia", uf: "MG", regiao: "Sudeste",
    });
    expect(await searchGoviaMunicipios("Serra do Ramalho", "SP")).toEqual([]);
  });

  it("busca por código completo ou prefixo e limita os resultados", async () => {
    expect(await searchGoviaMunicipios("2930154")).toHaveLength(1);
    expect((await searchGoviaMunicipios("293015"))[0]?.codigo_ibge).toBe("2930154");
    expect(await searchGoviaMunicipios("santa")).toHaveLength(20);
    expect(await searchGoviaMunicipios(" ")).toEqual([]);
  });

  it("resolve a cidade selecionada, inclusive por nome ou código de seis dígitos", async () => {
    for (const params of [
      { codigo_ibge: "2930154" },
      { codigo_ibge: "29-30154" },
      { codigo_ibge: "293015" },
      { nome: "serra do ramalho", uf: "ba" },
    ]) {
      const municipio = await findGoviaMunicipio(params);
      expect(municipio?.id).toBe(2930154);
      expect(municipio?.["regiao-imediata"]?.["regiao-intermediaria"]?.nome).toBeTruthy();
    }
  });

  it("não converte código inválido em município diferente", async () => {
    for (const codigo_ibge of ["2703209", "29301", "29301540", "abc"]) {
      expect(await findGoviaMunicipio({ codigo_ibge })).toBeNull();
    }
    expect((await findGoviaMunicipio({ codigo_ibge: "2703205" }))?.nome).toBe("Igreja Nova");
  });

  it("mantém as sugestões regionais sem rede", async () => {
    const municipios = await listGoviaMunicipiosByRegionalContext({ uf: "BA", excludeCodigoIbge: "2930154" });
    expect(municipios.length).toBeGreaterThan(0);
    expect(municipios.every((m) => m.uf === "BA" && m.codigo_ibge !== "2930154")).toBe(true);
  });

  it("inclui um catálogo nacional com códigos únicos e dados regionais", () => {
    const { municipios } = lerJsonDeDados<{ municipios: Array<{
      id: number; nome: string;
      "regiao-imediata": { "regiao-intermediaria": { UF: { sigla: string } } };
    }> }>("data/ibge/municipios.json");
    expect(municipios.length).toBeGreaterThan(5500);
    expect(new Set(municipios.map((m) => m.id)).size).toBe(municipios.length);
    expect(new Set(municipios.map((m) => m["regiao-imediata"]["regiao-intermediaria"].UF.sigla)).size).toBe(27);
    expect(municipios.every((m) => /^\d{7}$/.test(String(m.id)) && m.nome)).toBe(true);
  });
});
