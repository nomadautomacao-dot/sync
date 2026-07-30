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

  it("gera exatamente 4 páginas — 2 de ofício e 2 de questionário", () => {
    const paginas = render().match(/<section class="page/g)?.length ?? 0;
    expect(paginas).toBe(4);
  });

  it("numera o rodapé de 1 a 4", () => {
    const saida = render();
    for (let i = 1; i <= 4; i++) expect(saida).toContain(`<span>${i} / 4</span>`);
  });

  it("assina como Global Company Consultorias, sem menção a Rocha Prime", () => {
    const saida = render();

    expect(saida).toContain("Global Company Consultorias");
    expect(saida).not.toContain("Rocha Prime");
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

  /**
   * Rotatividade do secretário e consórcio intermunicipal saíram no corte: não
   * movem receita nem travam repasse. Seguem vivas na página "Quem dirige a
   * educação" do Raio-X, que é interno.
   */
  it("não pergunta o que só interessa ao diagnóstico interno", () => {
    const saida = render();

    expect(saida).not.toContain("tempo de cargo");
    expect(saida).not.toContain("consórcio intermunicipal");
  });

  it("dá linha de resposta para cada pergunta", () => {
    const saida = render();
    const perguntas = (saida.match(/class="q-pergunta"/g) ?? []).length;
    const linhas = (saida.match(/class="q-linha"/g) ?? []).length;

    expect(perguntas).toBe(15);
    expect(linhas).toBe(perguntas);
  });

  /**
   * O usuário cortou as perguntas que "não têm nada com nada". Critério que
   * sobrou: a resposta muda receita do FUNDEB ou trava repasse. Estas são as
   * que saíram — se alguma voltar, o ofício engordou sem ganhar valor.
   */
  it("não traz de volta as perguntas que não movem dinheiro", () => {
    const saida = render();

    expect(saida).not.toContain("UNDIME");
    expect(saida).not.toContain("acompanhamento jurídico");
    expect(saida).not.toContain("equipe fixa de manutenção");
    expect(saida).not.toContain("instrumentos urbanísticos");
    expect(saida).not.toContain("absenteísmo");
    expect(saida).not.toContain("organograma da secretaria");
    // "formação continuada" segue aparecendo na descrição do Referencial
    // Curricular (documento pedido) — o que saiu foi a PERGUNTA sobre ela.
    expect(saida).not.toContain("Existe programa de formação continuada");
  });

  it("nomeia as seções pelo efeito financeiro, não pelo tema administrativo", () => {
    const saida = render();

    expect(saida).toContain("o que multiplica o valor-aluno");
    expect(saida).toContain("o piso de 70% do fundo");
    expect(saida).toContain("O que trava repasse");
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

    expect(saida).toContain("Existe sala de recursos multifuncionais");
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
  it("equilibra as perguntas entre as duas páginas", () => {
    const grupos = distribuirQuestionario(montarQuestionario(modelo()));
    const pesos = grupos.map((g) => g.reduce((t, s) => t + s.itens.length, 0));

    expect(pesos).toHaveLength(2);
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

describe("contexto da declaração étnica", () => {
  it("omite as contagens quando as duas são zero — 0 e 0 é ruído", () => {
    const saida = render();

    expect(saida).toContain("Os segmentos indígena e quilombola ponderam de 1,40 a 2,17");
    expect(saida).not.toContain("0 matrículas com cor/raça indígena declarada");
  });

  it("imprime as contagens quando o município tem população indígena", () => {
    const saida = render({
      relatorio_dirigido_base: {
        equidadeTerritorial: {
          quilombola: { populacao: 0, emIdadeEscolar: 0, matriculasNosSegmentos: 0, razaoAtendimento: null, sinalConferencia: false },
          indigena: { populacao: 71691, emIdadeEscolar: 15647, matriculasNosSegmentos: 142, razaoAtendimento: null, sinalConferencia: true },
          fatorFaixa: { minimo: 1.4, maximo: 2.17 },
        },
        escolasTerritorio: {
          ano: 2025,
          escolas: [{ codigo: "1", rural: false, dif: 0, lat: null, lng: null, matriculas: 1000, transporte: null, racas: [0, 900, 0, 0, 0, 100] }],
          resumo: { total: 1, comCoordenada: 0, rurais: 0, porDiferenciada: {}, alunosTransporte: 0, pctTransporte: null, corRaca: null, corRacaTotais: { matriculas: 1000, indigena: 100, negra: 0, naoDeclarada: 0 } },
        },
      },
    });

    expect(saida).toContain("100 matrículas com cor/raça indígena declarada");
    expect(saida).toContain("142 no segmento indígena");
  });
});
