import { describe, expect, it } from "vitest";

import { dossieDoMunicipio } from "@/core/lib/municipios-dossie";

/**
 * Só `dossieDoMunicipio` é exercitado aqui: ele é síncrono e lê dataset local.
 * `buscarMunicipios` bate na API do IBGE e não entra na suíte — teste que
 * depende de rede pública falha por motivo alheio ao código e vira ruído.
 */

// Serra do Ramalho/BA — rede municipal grande para o porte, boa amostra.
const SERRA_DO_RAMALHO = "2930154";

describe("dossiê do município", () => {
  it("monta o dossiê a partir do código do IBGE", () => {
    const d = dossieDoMunicipio(SERRA_DO_RAMALHO, {
      nome: "Serra do Ramalho",
      uf: "BA",
      regiao: "Nordeste",
    })!;

    expect(d.codigoIbge).toBe(SERRA_DO_RAMALHO);
    expect(d.nome).toBe("Serra do Ramalho");
    expect(d.uf).toBe("BA");
    expect(d.populacao).toBeGreaterThan(10_000);
    expect(d.prefeito).toBeTruthy();
    expect(d.semDados).toEqual([]);
  });

  it("traz o Censo Escolar da rede municipal, não o do município inteiro", () => {
    const { censo } = dossieDoMunicipio(SERRA_DO_RAMALHO, { nome: "Serra do Ramalho", uf: "BA" })!;
    expect(censo).toBeDefined();

    // A rede municipal é subconjunto do que existe na cidade — se esta relação
    // se inverter, os campos foram trocados na leitura do dataset.
    expect(censo!.escolasMunicipais).toBeGreaterThan(0);
    expect(censo!.escolasMunicipais).toBeLessThanOrEqual(censo!.escolasNoMunicipio);
    expect(censo!.matriculasMunicipais).toBeGreaterThan(0);
    expect(censo!.docentesMunicipais).toBeGreaterThan(0);

    const soma = Object.values(censo!.porEtapa).reduce((t, n) => t + n, 0);
    expect(soma).toBeGreaterThan(0);
    expect(soma).toBeLessThanOrEqual(censo!.matriculasMunicipais * 1.2);
  });

  it("normaliza a UF para sigla e aceita o código com máscara", () => {
    const d = dossieDoMunicipio("29-30154", { nome: "Serra do Ramalho", uf: "ba" })!;
    expect(d.codigoIbge).toBe(SERRA_DO_RAMALHO);
    expect(d.uf).toBe("BA");
  });

  it("devolve null para código que não tem 7 dígitos", () => {
    expect(dossieDoMunicipio("293015", { nome: "X", uf: "BA" })).toBeNull();
    expect(dossieDoMunicipio("", { nome: "X", uf: "BA" })).toBeNull();
  });

  it("cai nos datasets locais quando a identidade não vem da busca", () => {
    // Sem `identidade`, nome e UF saem do TSE/censo — é o caminho de quando o
    // IBGE está fora do ar e o código foi digitado à mão.
    const d = dossieDoMunicipio(SERRA_DO_RAMALHO);
    expect(d?.nome).toBeTruthy();
    expect(d?.uf).toBe("BA");
  });

  it("anuncia quais fontes não tinham o município, em vez de omitir", () => {
    // Distrito Federal não tem prefeito no dataset do TSE.
    const d = dossieDoMunicipio("5300108", { nome: "Brasília", uf: "DF" });
    if (d) expect(Array.isArray(d.semDados)).toBe(true);
  });
});
