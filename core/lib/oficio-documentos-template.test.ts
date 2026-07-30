import { describe, expect, it } from "vitest";

import { mapMunicipalXrayModel } from "@/core/lib/municipal-xray-template";
import {
  distribuirQuestionario,
  generateOficioDocumentosHtml,
  montarQuestionario,
  RESPONSAVEL_PADRAO,
  type OficioParams,
} from "@/core/lib/oficio-documentos-template";

const PARAMS: OficioParams = {
  numero: "014/2026",
  prazoDias: 3,
  emitidoEm: new Date("2026-07-30T12:00:00.000Z"),
  responsavel: RESPONSAVEL_PADRAO,
  anoCenso: 2025,
};

function modelo(payload: Record<string, unknown> = {}) {
  return mapMunicipalXrayModel({
    basePayload: {},
    currentPayload: {
      dados_basicos: { nome: "Ibateguara", uf: "AL", codigo_ibge: "2703007" },
      ...payload,
    },
    baseYear: 2025,
    currentYear: 2026,
    generatedAt: new Date("2026-07-30T12:00:00.000Z"),
  });
}

function render(payload?: Record<string, unknown>, params: Partial<OficioParams> = {}) {
  return generateOficioDocumentosHtml(modelo(payload), { ...PARAMS, ...params });
}

describe("ofício de solicitação de documentos", () => {
  it("endereça o documento à cidade do relatório, com código IBGE", () => {
    const saida = render();

    expect(saida).toContain("Secretaria Municipal de Educação de Ibateguara — AL");
    expect(saida).toContain("2703007");
    expect(saida).toContain("diagnóstico técnico da rede municipal de ensino de Ibateguara");
  });

  it("usa a numeração e o prazo informados", () => {
    const saida = render(undefined, { numero: "014/2026", prazoDias: 5 });

    expect(saida).toContain("Ofício nº 014/2026");
    expect(saida).toContain("<b>5 dias</b>");
  });

  it("lista os cinco documentos e detalha cada um", () => {
    const saida = render();

    expect(saida).toContain("Portaria de Matrículas 2026");
    expect(saida).toContain("Lei de Sistema / Rede de Ensino");
    expect(saida).toContain("Referencial Curricular do Município");
    expect(saida).toContain("Diretrizes de Ensino");
    expect(saida).toContain("Censo Escolar 2025");
    // A página 2 explica cada um pelos três eixos.
    expect(saida).toContain("Também chamado de");
    expect(saida).toContain("Para que serve na análise");
    expect(saida).toContain("Onde costuma estar");
  });

  it("traz o contato do responsável nas duas páginas do ofício", () => {
    const saida = render();

    expect(saida).toContain("Adriel Pereira Tavares");
    expect(saida).toContain("(77) 99700-5880");
    expect(saida).toContain("rochaprime10@hotmail.com");
  });

  it("gera exatamente 5 páginas — 2 de ofício e 3 de questionário", () => {
    const paginas = render().match(/<section class="page/g)?.length ?? 0;
    expect(paginas).toBe(5);
  });

  it("numera o rodapé de 1 a 5", () => {
    const saida = render();
    for (let i = 1; i <= 5; i++) expect(saida).toContain(`<span>${i} / 5</span>`);
  });

  it("embute o logo em base64 — o Chromium do PDF roda sem rede", () => {
    const saida = render();
    expect(saida).toContain("data:image/png;base64,");
    expect(saida).not.toContain('src="/global-sync-icon.png"');
  });
});

describe("questionário — tom de coleta, não de veredito", () => {
  /**
   * Este é o único documento do dossiê que a prefeitura recebe. Os contextos
   * herdados do roteiro interno do Raio-X julgavam a gestão ("sem CAE o PNAE
   * fica irregular"); aqui eles imprimem o registro público e param.
   */
  it("não emite juízo sobre a gestão nos contextos", () => {
    const saida = render();

    expect(saida).not.toContain("fica irregular");
    expect(saida).not.toContain("lacuna de controle relevante");
    expect(saida).not.toContain("maior preditor de projeto interrompido");
    expect(saida).not.toContain("Existência não é funcionamento");
  });

  it("apresenta o registro público como ponto de partida a confirmar", () => {
    const saida = render();

    expect(saida).toContain("ele aparece em itálico sob a pergunta");
    expect(saida).toContain("o que precisa ser confirmado ou atualizado");
  });

  it("diz que rotatividade e consórcio não têm base pública, sem culpar ninguém", () => {
    const saida = render();

    expect(saida).toContain("A MUNIC não pesquisa tempo de cargo");
    expect(saida).toContain("Não há base pública de consórcios de educação");
  });

  it("dá linha de resposta para cada pergunta", () => {
    const saida = render();
    const perguntas = (saida.match(/class="q-pergunta"/g) ?? []).length;
    const linhas = (saida.match(/class="q-linha"/g) ?? []).length;

    expect(perguntas).toBeGreaterThanOrEqual(28);
    expect(linhas).toBe(perguntas);
  });

  it("preenche o contexto com o dado do município quando existe", () => {
    const saida = render({
      relatorio_dirigido_base: {
        historico: {
          anos: [{ ano: 2026, anoBaseCenso: 2025, totalMatriculasMunicipais: 5000, educacaoEspecial: 120 }],
        },
      },
    });

    expect(saida).toContain("120 matrículas em educação especial");
  });

  it("omite o contexto quando a fonte não respondeu, mantendo a pergunta", () => {
    const saida = render();

    expect(saida).toContain("Existe núcleo ou sala de recursos multifuncionais");
    expect(saida).not.toContain("N/D matrículas em educação especial");
  });
});

describe("distribuicao do questionario em paginas", () => {
  /**
   * Mesma regressão estrutural do roteiro que vivia no Raio-X: corte por
   * índice fixo cabia exatamente e transbordava em silêncio ao ganhar
   * pergunta nova, porque o contrato conta seções no DOM e não folhas
   * impressas.
   */
  it("equilibra as perguntas entre as três páginas", () => {
    const grupos = distribuirQuestionario(montarQuestionario(modelo()));
    const pesos = grupos.map((g) => g.reduce((t, s) => t + s.itens.length, 0));

    expect(pesos).toHaveLength(3);
    expect(Math.min(...pesos)).toBeGreaterThan(0);
    expect(Math.max(...pesos)).toBeLessThanOrEqual(Math.min(...pesos) * 2);
    expect(pesos.reduce((t, x) => t + x, 0)).toBe(
      montarQuestionario(modelo()).reduce((t, s) => t + s.itens.length, 0),
    );
  });

  it("preserva a ordem das seções ao cortar", () => {
    const secoes = montarQuestionario(modelo());
    const achatado = distribuirQuestionario(secoes).flat();

    expect(achatado.map((s) => s.titulo)).toEqual(secoes.map((s) => s.titulo));
  });
});
