import { describe, expect, it } from "vitest";

import {
  definicaoDaIniciativa,
  estaAtrasada,
  estadoInicial,
  etapaCumpridaAoEncerrar,
  eventosDaIniciativa,
  novaIniciativa,
  podeEditarIniciativa,
  repartirIniciativas,
  catalogoDeTipos,
  chaveDoTipo,
  TIPOS_PADRAO,
  type IniciativaDaCidade,
} from "./cidade-iniciativas";

const AUTOR = { uid: "u1", nome: "Tais Nunes" };

function iniciativa(campos: Partial<IniciativaDaCidade> = {}): IniciativaDaCidade {
  return {
    id: "i1",
    tipo: "capacitacao",
    nome: "Avanços para a Educação",
    estado: "em_andamento",
    inicio: "2026-10-10",
    autorUid: "u1",
    autorNome: "Tais Nunes",
    criadoEm: "2026-09-01T12:00:00.000Z",
    ...campos,
  };
}

describe("catálogo de tipos", () => {
  it("o padrão não repete key e só a capacitação comporta formação", () => {
    const keys = TIPOS_PADRAO.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(TIPOS_PADRAO.filter((t) => t.temFormacao).map((t) => t.key)).toEqual(["capacitacao"]);
    expect(TIPOS_PADRAO.every((t) => t.doSistema)).toBe(true);
  });

  it("junta os do sistema com os que a equipe criou", () => {
    const catalogo = catalogoDeTipos([
      { key: "formacao-continuada", rotulo: "Formação continuada", temFormacao: true },
    ]);
    expect(catalogo).toHaveLength(5);
    expect(catalogo.at(-1)).toMatchObject({ key: "formacao-continuada", doSistema: false });
  });

  /*
   * Sem isto, cadastrar um tipo chamado "capacitacao" apagaria da tela o
   * comportamento de carga horária que o built-in carrega — e ninguém ligaria
   * uma coisa à outra ao ver o formulário sem os campos.
   */
  it("personalizado não substitui um do sistema com a mesma chave", () => {
    const catalogo = catalogoDeTipos([
      { key: "capacitacao", rotulo: "Capacitacao (cópia)", temFormacao: false },
    ]);
    expect(catalogo).toHaveLength(4);
    expect(definicaoDaIniciativa("capacitacao", catalogo).temFormacao).toBe(true);
  });

  /*
   * É o que sustenta apagar um tipo. Um `throw` aqui derrubaria a aba inteira
   * no dia em que alguém removesse um tipo que ainda tem projeto usando — e o
   * projeto antigo não pode sumir porque o vocabulário mudou.
   */
  it("tipo fora do catálogo não estoura: vira rótulo neutro", () => {
    const definicao = definicaoDaIniciativa("congresso-regional", TIPOS_PADRAO);
    expect(definicao.rotulo).toBe("congresso-regional");
    expect(definicao.temFormacao).toBe(false);
  });
});

describe("chave a partir do que a pessoa digitou", () => {
  /*
   * O rótulo é lido; a chave é gravada em todo projeto do tipo. Derivá-la sem
   * acento e sem espaço evita que "Formação Continuada" e "formação
   * continuada " virem dois tipos que a tela mostra iguais e a base separa.
   */
  it("tira acento, caixa e espaço", () => {
    expect(chaveDoTipo("Formação Continuada")).toBe("formacao-continuada");
    expect(chaveDoTipo("  formação continuada  ")).toBe("formacao-continuada");
  });

  it("colapsa pontuação e não deixa hífen nas pontas", () => {
    expect(chaveDoTipo("Assessoria — técnica!")).toBe("assessoria-tecnica");
    expect(chaveDoTipo("...projeto...")).toBe("projeto");
  });

  it("texto sem letra devolve vazio, e quem chama recusa", () => {
    expect(chaveDoTipo("   ")).toBe("");
    expect(chaveDoTipo("!!!")).toBe("");
  });
});

describe("estado inicial", () => {
  it("cadastrada antes de começar nasce planejada", () => {
    expect(estadoInicial("2026-10-10", "2026-09-04")).toBe("planejada");
  });

  /* Quem lança em novembro a capacitação de outubro está registrando, não
     agendando — nascer "planejada" encheria a tela de plano que já terminou. */
  it("cadastrada depois de começar nasce em andamento", () => {
    expect(estadoInicial("2026-10-10", "2026-11-20")).toBe("em_andamento");
  });

  it("cadastrada no próprio dia já está em andamento", () => {
    expect(estadoInicial("2026-10-10", "2026-10-10")).toBe("em_andamento");
  });
});

describe("atraso", () => {
  it("passou do fim e ninguém encerrou", () => {
    expect(estaAtrasada(iniciativa({ fim: "2026-10-10" }), "2026-10-11")).toBe(true);
  });

  it("no próprio dia do fim ainda não atrasou — o dia é inteiro", () => {
    expect(estaAtrasada(iniciativa({ fim: "2026-10-10" }), "2026-10-10")).toBe(false);
  });

  /* Serviço contínuo não tem data para acabar. Marcá-lo de vermelho todo dia
     ensinaria a equipe a ignorar o vermelho. */
  it("iniciativa sem fim nunca atrasa", () => {
    expect(estaAtrasada(iniciativa({ tipo: "servico", fim: undefined }), "2030-01-01")).toBe(
      false,
    );
  });

  it("encerrada não atrasa, nem concluída nem cancelada", () => {
    expect(estaAtrasada(iniciativa({ fim: "2020-01-01", estado: "concluida" }), "2026-09-04")).toBe(
      false,
    );
    expect(estaAtrasada(iniciativa({ fim: "2020-01-01", estado: "cancelada" }), "2026-09-04")).toBe(
      false,
    );
  });
});

describe("quem edita", () => {
  it("quem abriu, quem responde e quem administra", () => {
    const i = iniciativa({ autorUid: "u1", responsavelId: "u2" });
    expect(podeEditarIniciativa(i, "u1", "member")).toBe(true);
    expect(podeEditarIniciativa(i, "u2", "member")).toBe(true);
    expect(podeEditarIniciativa(i, "u9", "admin")).toBe(true);
  });

  /* Mais frouxo que evento de propósito: iniciativa é estado combinado de
     trabalho, não registro de autoria. Mas estranho continua sendo estranho. */
  it("quem não tem nada com ela não edita", () => {
    expect(podeEditarIniciativa(iniciativa(), "u9", "member")).toBe(false);
    expect(podeEditarIniciativa(iniciativa(), "u9", "viewer")).toBe(false);
  });
});

describe("elo com o cronograma", () => {
  it("concluir cumpre a etapa apontada", () => {
    expect(
      etapaCumpridaAoEncerrar({ etapaModeloKey: "capacitacao" }, "concluida"),
    ).toBe("capacitacao");
  });

  /* Cancelar é decisão de não fazer. Marcar a etapa como cumprida por causa
     dela seria registrar entrega que não houve. */
  it("cancelar não cumpre etapa nenhuma", () => {
    expect(etapaCumpridaAoEncerrar({ etapaModeloKey: "capacitacao" }, "cancelada")).toBeNull();
  });

  it("iniciativa sem etapa apontada não mexe no cronograma", () => {
    expect(etapaCumpridaAoEncerrar({ etapaModeloKey: undefined }, "concluida")).toBeNull();
  });
});

describe("repartição da lista", () => {
  const hoje = "2026-09-04";

  it("separa nos três blocos", () => {
    const lista = repartirIniciativas(
      [
        iniciativa({ id: "a", estado: "em_andamento" }),
        iniciativa({ id: "b", estado: "planejada", inicio: "2026-12-01" }),
        iniciativa({ id: "c", estado: "concluida" }),
        iniciativa({ id: "d", estado: "cancelada" }),
      ],
      hoje,
    );
    expect(lista.emAndamento.map((i) => i.id)).toEqual(["a"]);
    expect(lista.planejadas.map((i) => i.id)).toEqual(["b"]);
    expect(lista.encerradas.map((i) => i.id).sort()).toEqual(["c", "d"]);
  });

  /* Planejada cuja data de início já passou não é mais plano: é trabalho que
     devia ter começado. Deixá-la no bloco de planejadas a esconderia de quem
     olha "o que está rodando". */
  it("planejada com início vencido cai em andamento", () => {
    const lista = repartirIniciativas(
      [iniciativa({ id: "x", estado: "planejada", inicio: "2026-08-01" })],
      hoje,
    );
    expect(lista.emAndamento.map((i) => i.id)).toEqual(["x"]);
    expect(lista.planejadas).toEqual([]);
  });

  it("em andamento ordena pelo que vence primeiro, e sem fim vai para o fim", () => {
    const lista = repartirIniciativas(
      [
        iniciativa({ id: "sem-fim", fim: undefined }),
        iniciativa({ id: "tarde", fim: "2026-12-01" }),
        iniciativa({ id: "cedo", fim: "2026-10-01" }),
      ],
      hoje,
    );
    expect(lista.emAndamento.map((i) => i.id)).toEqual(["cedo", "tarde", "sem-fim"]);
  });

  it("encerradas vêm da mais recente para a mais antiga", () => {
    const lista = repartirIniciativas(
      [
        iniciativa({ id: "velha", estado: "concluida", concluidaEm: "2026-01-10" }),
        iniciativa({ id: "nova", estado: "concluida", concluidaEm: "2026-08-10" }),
      ],
      hoje,
    );
    expect(lista.encerradas.map((i) => i.id)).toEqual(["nova", "velha"]);
  });
});

describe("filtro da linha do tempo", () => {
  const eventos = [
    { id: "e1", iniciativaId: "i1" },
    { id: "e2", iniciativaId: "i2" },
    { id: "e3" },
  ];

  it("filtra pelo fio da iniciativa", () => {
    expect(eventosDaIniciativa(eventos, "i1").map((e) => e.id)).toEqual(["e1"]);
  });

  /*
   * A regressão que importa nesta feature. A cidade já tem dezenas de
   * registros anteriores ao campo `iniciativaId`; um filtro que o exigisse os
   * faria sumir da tela em silêncio no dia do deploy — e a linha do tempo é a
   * aba de entrada da ficha.
   */
  it('"tudo" devolve inclusive o que nunca teve iniciativa', () => {
    expect(eventosDaIniciativa(eventos, null).map((e) => e.id)).toEqual(["e1", "e2", "e3"]);
  });

  it("não devolve a lista original: ordenar a cópia não mexe na fonte", () => {
    const copia = eventosDaIniciativa(eventos, null);
    expect(copia).not.toBe(eventos);
  });

  it("iniciativa sem nenhum acontecimento devolve lista vazia, não tudo", () => {
    expect(eventosDaIniciativa(eventos, "i9")).toEqual([]);
  });
});

describe("novo documento", () => {
  const agora = new Date("2026-09-04T12:00:00.000Z");

  it("guarda carga horária e formador na capacitação", () => {
    const doc = novaIniciativa(
      {
        tipo: "capacitacao",
        nome: "  Avanços para a Educação  ",
        inicio: "2026-10-10",
        cargaHoraria: 6,
        formador: " Tais Nunes ",
      },
      AUTOR,
      agora,
    );
    expect(doc.nome).toBe("Avanços para a Educação");
    expect(doc.cargaHoraria).toBe(6);
    expect(doc.formador).toBe("Tais Nunes");
    expect(doc.estado).toBe("planejada");
  });

  /* Carga horária de um "serviço" seria dado órfão: o próximo a ler o
     documento não saberia se é informação ou resto de uma edição de tipo. */
  it("descarta formação em tipo que não a comporta", () => {
    const doc = novaIniciativa(
      { tipo: "servico", nome: "Assessoria mensal", inicio: "2026-10-10", cargaHoraria: 6, formador: "Tais" },
      AUTOR,
      agora,
    );
    expect(doc).not.toHaveProperty("cargaHoraria");
    expect(doc).not.toHaveProperty("formador");
  });

  /* `undefined` é valor inválido no Firestore: o campo tem que não existir. */
  it("campo vazio não vira chave undefined no documento", () => {
    const doc = novaIniciativa(
      { tipo: "projeto", nome: "Projeto", inicio: "2026-10-10", objetivo: "   " },
      AUTOR,
      agora,
    );
    expect(Object.values(doc).every((v) => v !== undefined)).toBe(true);
    expect(doc).not.toHaveProperty("objetivo");
    expect(doc).not.toHaveProperty("fim");
  });

  it("carimba autoria e criação", () => {
    const doc = novaIniciativa({ tipo: "projeto", nome: "P", inicio: "2026-10-10" }, AUTOR, agora);
    expect(doc.autorUid).toBe("u1");
    expect(doc.autorNome).toBe("Tais Nunes");
    expect(doc.criadoEm).toBe("2026-09-04T12:00:00.000Z");
  });
});
