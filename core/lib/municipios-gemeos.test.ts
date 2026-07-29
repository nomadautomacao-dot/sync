import { describe, expect, it } from "vitest";

import { getMunicipiosGemeos } from "@/core/lib/municipios-gemeos";

/**
 * O percentil só informa se a coorte comparar a mesma conta, apurada da mesma
 * forma, entre redes de porte de fato semelhante. Estes testes travam as três
 * condições — uma coorte mal recortada produziria percentis plausíveis e
 * enganosos, que é pior que não ter percentil.
 */
describe("gêmeos estatísticos", () => {
  it("monta a coorte pelo porte da rede, sem incluir o próprio município", () => {
    const g = getMunicipiosGemeos("2930154")!; // Serra do Ramalho/BA

    expect(g.uf).toBe("BA");
    expect(g.faixaPorte.tamanho).toBe(80);
    // A janela de porte precisa conter o alvo — vizinhos de matrícula, não
    // vizinhos de lista.
    expect(g.faixaPorte.minimo).toBeLessThanOrEqual(g.matriculas);
    expect(g.faixaPorte.maximo).toBeGreaterThanOrEqual(g.matriculas);
    // E precisa ser janela apertada: porte semelhante, não o estado inteiro.
    expect(g.faixaPorte.maximo - g.faixaPorte.minimo).toBeLessThan(g.matriculas);
  });

  it("cobre os indicadores centrais com coorte densa", () => {
    const g = getMunicipiosGemeos("2930154")!;
    const chaves = new Set(g.indicadores.map((i) => i.chave));

    for (const chave of ["fatorMedio", "crecheIntegral", "coberturaAee", "mde", "remuneracao70"]) {
      expect(chaves.has(chave), `indicador ${chave} ausente`).toBe(true);
    }
    for (const ind of g.indicadores) {
      expect(ind.comparaveis, ind.chave).toBeGreaterThanOrEqual(20);
      expect(ind.percentil, ind.chave).toBeGreaterThanOrEqual(0);
      expect(ind.percentil, ind.chave).toBeLessThanOrEqual(100);
    }
  });

  it("mantém o percentil coerente com a mediana da coorte", () => {
    // Acima da mediana → percentil acima de 50; abaixo → abaixo. Uma inversão
    // aqui faria o relatório elogiar o que deveria apontar.
    for (const codigo of ["2930154", "3550308", "1100049"]) {
      const g = getMunicipiosGemeos(codigo)!;
      for (const ind of g.indicadores) {
        if (ind.valor > ind.medianaPorte) expect(ind.percentil, `${codigo}·${ind.chave}`).toBeGreaterThanOrEqual(50);
        if (ind.valor < ind.medianaPorte) expect(ind.percentil, `${codigo}·${ind.chave}`).toBeLessThanOrEqual(50);
      }
    }
  });

  it("o fator médio da coorte fica na faixa possível dos fatores do fundo", () => {
    const g = getMunicipiosGemeos("3550308")!;
    const fator = g.indicadores.find((i) => i.chave === "fatorMedio")!;
    for (const valor of [fator.valor, fator.medianaPorte, fator.medianaUf ?? fator.medianaPorte]) {
      expect(valor).toBeGreaterThanOrEqual(1);
      expect(valor).toBeLessThanOrEqual(2.17);
    }
  });

  it("informa quanto da coorte capta o VAAR", () => {
    const g = getMunicipiosGemeos("2930154")!;
    expect(g.vaar).not.toBeNull();
    expect(g.vaar!.habilitadoCoortePct).toBeGreaterThan(0);
    expect(g.vaar!.habilitadoCoortePct).toBeLessThanOrEqual(100);
    expect(typeof g.vaar!.municipioHabilitado).toBe("boolean");
  });

  it("devolve null para código desconhecido em vez de lançar", () => {
    expect(getMunicipiosGemeos("0000000")).toBeNull();
    expect(getMunicipiosGemeos("")).toBeNull();
  });
});
