import { describe, expect, it } from "vitest";

import {
  LEVANTAMENTO_TOTAL_PAGINAS,
  generateLevantamentoHtml,
  type LevantamentoTemplateInput,
} from "@/core/lib/fundeb-levantamento-template";
import { getSituacaoVaar } from "@/core/lib/fundeb-vaar";
import { getPonderacaoMunicipal } from "@/core/lib/fundeb-ponderacao";
import type { RelatorioFundeb } from "@/modules/levantamento-fundeb/types";

/**
 * `core/lib/fundeb-levantamento-pdf.ts` compara a contagem de páginas do PDF
 * com `LEVANTAMENTO_TOTAL_PAGINAS` e **lança** se divergirem. Uma página a
 * mais no template sem atualizar a constante — ou o contrário — derruba a
 * geração em produção, não no desenvolvimento.
 *
 * O relatório também é montado a partir de um payload cujos campos são quase
 * todos opcionais. Um município sem VAAR, sem Censo ou sem SICONFI tem de
 * gerar as mesmas páginas, com traço no lugar do número.
 */

/**
 * Fixture deliberadamente esquálido: só o que o tipo exige, tudo o mais
 * ausente. Se alguma página quebrar com dado faltando, é aqui que aparece.
 */
function relatorioMinimo(): RelatorioFundeb {
  const zerado = {
    vaafAtual: 0, vaafProjetado: 0, vaafGanho: 0,
    vaatAtual: 0, vaatProjetado: 0, vaatGanho: 0,
    vaarAtual: 0, vaarProjetado: 0, vaarGanho: 0,
    totalAtual: 0, totalProjetado: 0, totalGanho: 0, ganhoPercentual: 0,
  };

  return {
    geradoEm: "2026-07-28T12:00:00.000Z",
    identificacao: {
      municipioNome: "Município de Teste",
      uf: "SE",
      codigoIBGE: "2801207",
      exercicio: 2026,
      fonte: "teste",
    },
    receitas: {
      complementacaoVAAF: 0,
      complementacaoVAAT: 0,
      complementacaoVAAR: 0,
      totalReceitas: 0,
    },
    projecao: zerado,
    projecaoRecuperavel: zerado,
    projecaoComercial: null,
    upsideCondicionado: null,
    perfilComercial: null,
    cronogramaVAAF: [],
    sistemas: [],
    obrasPAC2: [],
    situacaoPAR: "",
    caminhoEscola: [],
    pdde: [],
    observacoesOperacionais: [],
    idebAnosIniciais: [],
    idebAnosFinais: [],
    idebEnsinoMedio: [],
    censoEscolar: null,
  } as unknown as RelatorioFundeb;
}

function paginas(html: string): number {
  return html.match(/<section class="page/g)?.length ?? 0;
}

function gerar(overrides: Partial<LevantamentoTemplateInput> = {}): string {
  return generateLevantamentoHtml({ relatorio: relatorioMinimo(), ...overrides });
}

describe("template do Levantamento FUNDEB", () => {
  it("respeita o contrato de páginas que o renderer confere", () => {
    expect(paginas(gerar())).toBe(LEVANTAMENTO_TOTAL_PAGINAS);
  });

  it("mantém a contagem de páginas com o payload completo", () => {
    const html = gerar({
      payload: {
        relatorio_dirigido_base: { vaar: getSituacaoVaar("3304557") },
      } as LevantamentoTemplateInput["payload"],
    });

    expect(paginas(html)).toBe(LEVANTAMENTO_TOTAL_PAGINAS);
  });

  it("nomeia a condicionalidade reprovada em vez de conjecturar", () => {
    // Antes do dataset do VAAR o relatório dizia que a ausência da parcela
    // "pode estar ligada às condições de habilitação". Agora ela é nomeada.
    const html = gerar({
      payload: {
        relatorio_dirigido_base: { vaar: getSituacaoVaar("3304557") },
      } as LevantamentoTemplateInput["payload"],
    });

    expect(html).not.toContain("pode estar ligada");
    expect(html).toContain("Não habilitado ao VAAR");
    // Rio de Janeiro reprovou nas condicionalidades III e IV em 2026.
    expect(html).toMatch(/reprovado em 2 condicionalidades/);
  });

  it("atribui ao estado a reprovação que cascateia, e não ao município", () => {
    const html = gerar({
      payload: {
        relatorio_dirigido_base: { vaar: getSituacaoVaar("3300100") },
      } as LevantamentoTemplateInput["payload"],
    });

    expect(html).toContain("A reprovação não é do município");
    expect(html).toContain("Nenhuma ação municipal reverte isso");
  });

  it("mostra o valor recebido para quem é beneficiário", () => {
    const html = gerar({
      payload: {
        relatorio_dirigido_base: { vaar: getSituacaoVaar("5208707") },
      } as LevantamentoTemplateInput["payload"],
    });

    expect(html).toContain("Habilitado ao VAAR");
    expect(html).toContain("beneficiário do rateio");
    expect(html).not.toContain("A reprovação não é do município");
  });

  it("gera as páginas novas mesmo sem os datasets", () => {
    const html = gerar();
    expect(paginas(html)).toBe(LEVANTAMENTO_TOTAL_PAGINAS);
    expect(html).toContain("Situação no VAAR não disponível");
    expect(html).toContain("Matrícula ponderada não disponível");
  });

  it("mostra o denominador ponderado ao lado da matrícula bruta", () => {
    // A receita do fundo é proporcional a Σ(matrícula × fator), e os fatores
    // vão de 1,00 a 2,17. Sem esta página o relatório apresenta uma receita
    // cuja formação não explica.
    const ponderacao = getPonderacaoMunicipal("2801207")!;
    const html = gerar({
      payload: {
        relatorio_dirigido_base: { ponderacao },
      } as LevantamentoTemplateInput["payload"],
    });

    expect(paginas(html)).toBe(LEVANTAMENTO_TOTAL_PAGINAS);
    expect(html).toContain("Matrículas-equivalentes");
    expect(html).toContain("Fator médio da rede");
    expect(html).not.toContain("Matrícula ponderada não disponível");
  });
});
