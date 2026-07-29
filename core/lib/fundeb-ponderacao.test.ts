import { describe, expect, it } from "vitest";

import ponderadas from "@/data/fnde/matriculas-ponderadas-2026.json";
import { getPonderacaoMunicipal } from "@/core/lib/fundeb-ponderacao";

/**
 * Os fatores deste dataset não são transcritos de norma nenhuma — são
 * derivados dividindo a aba ponderada pela aba crua da planilha do FNDE. Isso
 * é mais fiel (a planilha diverge da Resolução CIF em alguns segmentos, e o
 * dinheiro segue a planilha), mas depende de as três abas estarem alinhadas
 * linha a linha. Um desalinhamento produziria fatores plausíveis e errados.
 *
 * As travas são fatos externos: a lei fixa 1,00 para anos iniciais urbano, o
 * campo acrescenta 15% e indígena/quilombola acrescentam 40%. Se a derivação
 * regredir, essas três relações quebram antes de o número virar argumento
 * comercial.
 */
const arquivo = ponderadas as {
  segmentos: string[];
  fatores: { vaaf: (number | null)[]; vaat: (number | null)[] };
};

function fator(nome: string, tabela: "vaaf" | "vaat" = "vaaf"): number | null {
  const indice = arquivo.segmentos.indexOf(nome);
  expect(indice, `segmento ausente: ${nome}`).toBeGreaterThanOrEqual(0);
  return arquivo.fatores[tabela][indice];
}

describe("fatores de ponderação derivados da planilha do FNDE", () => {
  it("usa anos iniciais urbano como referência 1,00", () => {
    // Art. 7º, §1º da Lei 14.113/2020 define esta etapa como a unidade.
    expect(fator("Anos Iniciais Fundamental Urbano")).toBe(1);
  });

  it("acrescenta 15% ao campo e 40% a indígena e quilombola", () => {
    expect(fator("Anos Iniciais Fundamental Campo")).toBeCloseTo(1.15, 4);
    expect(fator("Anos Iniciais Fundamental Indígena")).toBeCloseTo(1.4, 4);
    expect(fator("Anos Iniciais Fundamental Quilombola")).toBeCloseTo(1.4, 4);
  });

  it("mantém o teto em creche integral indígena e quilombola", () => {
    // 1,55 (creche integral) × 1,40 = 2,17 — o maior fator do FUNDEB.
    expect(fator("Creche Integral Pública Urbano")).toBeCloseTo(1.55, 4);
    expect(fator("Creche Integral Pública Indígena")).toBeCloseTo(2.17, 4);
    expect(fator("Creche Integral Pública Quilombola")).toBeCloseTo(2.17, 4);
  });

  it("preserva a divergência entre a planilha do FNDE e a Resolução CIF", () => {
    // A Res. CIF 5/2024 dá 1,10 às conveniadas parciais no VAAT; a planilha
    // operacional aplica 1,27 na creche e 1,16 na pré-escola. Derivar do dado
    // é justamente o que evita transcrever o número que não foi usado.
    expect(fator("Creche Parcial Conveniada Urbano", "vaat")).toBeCloseTo(1.27, 4);
    expect(fator("Pré-Escola Parcial Conveniada Urbano", "vaat")).toBeCloseTo(1.16, 4);
  });

  it("o VAAT nunca pondera abaixo do VAAF no mesmo segmento", () => {
    arquivo.segmentos.forEach((nome, indice) => {
      const f = arquivo.fatores.vaaf[indice];
      const t = arquivo.fatores.vaat[indice];
      if (f === null || t === null) return;
      expect(t, `segmento ${nome}`).toBeGreaterThanOrEqual(f);
    });
  });
});

describe("ponderação de um município", () => {
  it("a soma dos segmentos reconstrói a ponderada publicada", () => {
    // Se a junção segmento↔fator estivesse deslocada, a soma não fecharia.
    for (const codigo of ["2801207", "3550308", "1302603", "3136959"]) {
      const p = getPonderacaoMunicipal(codigo);
      expect(p, `município ${codigo} ausente`).not.toBeNull();

      const soma = p!.segmentos.reduce((total, s) => total + s.equivalentes, 0);
      // Tolerância de 1%: as células da planilha vêm arredondadas a duas casas.
      expect(Math.abs(soma - p!.ponderadaVaaf) / p!.ponderadaVaaf).toBeLessThan(0.01);
    }
  });

  it("o fator médio fica dentro da faixa possível dos fatores", () => {
    const p = getPonderacaoMunicipal("2801207")!;
    expect(p.fatorMedio).toBeGreaterThanOrEqual(1);
    expect(p.fatorMedio).toBeLessThanOrEqual(2.17);
  });

  it("a matrícula bruta nunca supera a ponderada", () => {
    // Nenhum fator do FUNDEB é menor que 1, então ponderar só pode somar.
    for (const codigo of ["2801207", "3550308", "1302603"]) {
      const p = getPonderacaoMunicipal(codigo)!;
      expect(p.ponderadaVaaf).toBeGreaterThanOrEqual(p.matriculas);
    }
  });

  it("quantifica a creche parcial como oportunidade de ponderação", () => {
    const p = getPonderacaoMunicipal("3550308")!;
    const creche = p.oportunidades.find((o) => o.chave === "creche-integral");

    if (creche) {
      expect(creche.matriculas).toBeGreaterThan(0);
      // O salto de 1,25 para 1,55 vale 0,30 por matrícula.
      expect(creche.ganhoEquivalentes).toBeCloseTo(creche.matriculas * 0.3, 0);
    }
  });

  it("devolve null para código inexistente em vez de lançar", () => {
    expect(getPonderacaoMunicipal("0000000")).toBeNull();
    expect(getPonderacaoMunicipal("")).toBeNull();
  });
});
