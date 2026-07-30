import { describe, expect, it } from "vitest";

import {
  montarCondicoes,
  montarCorrente,
  montarSerie,
  type DossieEquidade,
} from "@/core/lib/dossie-equidade";
import { generateDossieEquidadeHtml } from "@/core/lib/dossie-equidade-template";
import { getCorRacaHistorico } from "@/core/lib/cor-raca-historico";
import { avaliarPovo } from "@/core/lib/equidade-territorial";
import { getEscolasTerritorio } from "@/core/lib/escolas-territorio";

const SERRA_DO_RAMALHO = "2930758";
const MANAUS = "1302603";

describe("série lida como cadastro antes de composição", () => {
  /**
   * Serra do Ramalho vai de 42,1% de não declaração em 2023 a 8,0% em 2025, e a
   * matrícula "preta ou parda" sobe de 51,9% a 83,1% no mesmo intervalo. Ler
   * isso como mudança demográfica seria afirmar que a rede ficou 31 pontos mais
   * negra em dois anos — o que aconteceu foi a secretaria preencher o campo.
   */
  it("marca o ano em que o cadastro mudou, não a demografia", () => {
    const h = getCorRacaHistorico(SERRA_DO_RAMALHO)!;
    const s = montarSerie(h.municipal, "municipal");

    expect(s.anosComMudanca.length).toBeGreaterThan(0);
    expect(s.variacaoNaoDeclarada).toBeLessThan(-20);

    const ano2024 = s.anos.find((a) => a.ano === 2024)!;
    expect(ano2024.mudouCadastro).toBe(true);
    expect(ano2024.variacaoNaoDeclarada).toBeLessThan(-5);
  });

  it("não marca mudança onde a série é estável", () => {
    const h = getCorRacaHistorico(MANAUS)!;
    const s = montarSerie(h.municipal, "municipal");

    expect(s.anosComMudanca).toEqual([]);
    for (const a of s.anos) expect(a.mudouCadastro).toBe(false);
  });

  it("o primeiro ano da série não tem variação, e não é mudança", () => {
    const h = getCorRacaHistorico(MANAUS)!;
    const s = montarSerie(h.municipal, "municipal");

    expect(s.anos[0].variacaoNaoDeclarada).toBeNull();
    expect(s.anos[0].mudouCadastro).toBe(false);
  });

  it("os percentuais de um ano somam 100", () => {
    const h = getCorRacaHistorico(MANAUS)!;
    for (const a of montarSerie(h.publica, "publica").anos) {
      const soma = Object.values(a.pct).reduce((t, v) => t + (v ?? 0), 0);
      expect(soma).toBeGreaterThan(99);
      expect(soma).toBeLessThan(101);
    }
  });

  /** O HTML precisa dizer que os anos deixaram de ser comparáveis. */
  it("avisa no documento que a comparação entre anos não vale", () => {
    const html = gerar({
      series: [montarSerie(getCorRacaHistorico(SERRA_DO_RAMALHO)!.municipal, "municipal")],
    });
    expect(html).toContain("não é mudança demográfica");
    expect(html).toContain("não são comparáveis");
  });
});

describe("a corrente de três elos", () => {
  const valorEquivalente = 6000;

  it("monetiza só o acréscimo do fator sobre a referência 1,00", () => {
    const povo = avaliarPovo(5000, 1000, 100);
    const c = montarCorrente("indigena", povo, 400, valorEquivalente);

    expect(c.vaoDeclaracaoParaPonderacao).toBe(300);
    // Menor fator indígena da Portaria é 1,40 — o acréscimo é 0,40.
    expect(c.valorDerivado).toBeCloseTo(300 * 0.4 * valorEquivalente, 2);
  });

  /**
   * O campo de cor/raça do Censo Escolar não tem categoria quilombola. Inventar
   * um número para o elo do meio transformaria pergunta de campo em afirmação
   * sem fonte — a lacuna é dita em palavras.
   */
  it("deixa o elo do meio vazio para quilombola, e explica no documento", () => {
    const povo = avaliarPovo(1000, 300, 0);
    const c = montarCorrente("quilombola", povo, null, valorEquivalente);

    expect(c.elos[1].valor).toBeNull();
    expect(c.vaoDeclaracaoParaPonderacao).toBeNull();
    expect(c.valorDerivado).toBeNull();

    const html = gerar({ correntes: [c] });
    expect(html).toContain("nenhuma delas é quilombola");
    expect(html).toContain("não será inventado");
  });

  it("não produz vão negativo quando a ponderação supera a declaração", () => {
    const povo = avaliarPovo(1000, 300, 400);
    const c = montarCorrente("indigena", povo, 200, valorEquivalente);

    expect(c.vaoDeclaracaoParaPonderacao).toBe(0);
    expect(c.valorDerivado).toBe(0);
  });

  it("não monetiza sem a Portaria da UF", () => {
    const c = montarCorrente("indigena", avaliarPovo(5000, 1000, 100), 400, null);
    expect(c.valorDerivado).toBeNull();
  });

  it("produz as três perguntas de campo em qualquer caso", () => {
    const c = montarCorrente("indigena", avaliarPovo(0, 0, 0), 0, valorEquivalente);
    expect(c.perguntas).toHaveLength(3);
  });
});

describe("territórios e fatores", () => {
  it("liga cada condição declarada ao fator do segmento correspondente", () => {
    const territorio = getEscolasTerritorio(MANAUS)!.resumo;
    const condicoes = montarCondicoes(territorio);

    expect(condicoes.length).toBeGreaterThan(0);
    const indigena = condicoes.find((c) => c.codigo === 2);
    if (indigena) expect(indigena.fatorExemplo).toBe(1.4);
    const assentamento = condicoes.find((c) => c.codigo === 1);
    if (assentamento) expect(assentamento.fatorExemplo).toBe(1.15);
  });

  it("ordena da condição mais frequente para a menos", () => {
    const condicoes = montarCondicoes(getEscolasTerritorio(MANAUS)!.resumo);
    const escolas = condicoes.map((c) => c.escolas);
    expect([...escolas].sort((a, b) => b - a)).toEqual(escolas);
  });

  it("devolve lista vazia sem território", () => {
    expect(montarCondicoes(null)).toEqual([]);
  });
});

describe("HTML do Dossiê da Equidade", () => {
  it("imprime uma linha por ano de série e um bloco por corrente", () => {
    const series = [
      montarSerie(getCorRacaHistorico(MANAUS)!.municipal, "municipal"),
      montarSerie(getCorRacaHistorico(MANAUS)!.publica, "publica"),
    ];
    const correntes = [
      montarCorrente("indigena", avaliarPovo(5000, 1000, 100), 400, 6000),
      montarCorrente("quilombola", avaliarPovo(1000, 300, 0), null, 6000),
    ];
    const html = gerar({ series, correntes });

    expect(html.match(/<tr class="ano-serie /g) ?? []).toHaveLength(
      series.reduce((t, s) => t + s.anos.length, 0),
    );
    expect(html.match(/<article class="corrente">/g) ?? []).toHaveLength(2);
  });

  /**
   * A regra que governa o documento. Se ela sumir do texto, some também a
   * fronteira entre apontar lacuna de registro e afirmar pertencimento.
   */
  it("declara que pertencimento é autodeclaração e não estima ninguém", () => {
    const html = gerar({});
    expect(html).toContain("Pertencimento é autodeclaração");
    expect(html).toContain("nem estima quantos deveriam se declarar");
  });

  /** A distinção contraintuitiva que carrega o dinheiro. */
  it("repete que a ponderação segue a escola, não o aluno", () => {
    const html = gerar({
      correntes: [montarCorrente("indigena", avaliarPovo(5000, 1000, 100), 400, 6000)],
    });
    expect(html.match(/segue a (<b>)?localização/g)?.length ?? 0).toBeGreaterThan(0);
    expect(html).toContain("não a cor/raça do aluno");
  });

  it("não afirma resultado de cliente nem histórico de contratos", () => {
    const html = gerar({});
    for (const proibido of [
      /j[áa] recuperamos/i,
      /nossos clientes/i,
      /case de sucesso/i,
      /municípios atendidos/i,
    ]) {
      expect(html).not.toMatch(proibido);
    }
  });
});

function gerar(over: Partial<DossieEquidade> = {}): string {
  const dossie: DossieEquidade = {
    municipio: "TESTE",
    uf: "BA",
    historico: null,
    series: [],
    equidade: null,
    territorial: null,
    correntes: [],
    territorio: null,
    condicoes: [],
    assentamentos: null,
    vaar: null,
    anoCensoEscolar: 2025,
    ausencias: [],
    resumo: {
      naoDeclaradaPct: 8,
      cadastroFragil: false,
      negraPct: 83.2,
      diferencaNegraRuralUrbana: 3.7,
      povosComSinal: 0,
      valorDerivadoTotal: null,
      condicionalidadeIII: null,
    },
    ...over,
  };

  return generateDossieEquidadeHtml({
    municipio: dossie.municipio,
    uf: dossie.uf,
    codigoIbge: SERRA_DO_RAMALHO,
    dossie,
    geradoEm: new Date("2026-07-30T12:00:00.000Z"),
  });
}
