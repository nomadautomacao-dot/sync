import { describe, expect, it } from "vitest";

import {
  estaLida,
  naoLidas,
  novaNotificacao,
  visivelPara,
  type Notificacao,
} from "./notificacoes";

const AGORA = new Date("2026-08-23T15:00:00.000Z");

function notificacao(parcial: Partial<Notificacao>): Notificacao {
  return {
    id: "n1",
    groupId: "g1",
    destinatarioUid: "u1",
    tipo: "comentario_evento",
    titulo: "Comentário novo",
    lida: false,
    criadoEm: "2026-08-23T12:00:00.000Z",
    ...parcial,
  };
}

describe("novaNotificacao", () => {
  it("nasce não lida, carimbada e com a origem", () => {
    const n = novaNotificacao(
      { destinatarioUid: null, tipo: "pergunta_mural", titulo: " Pergunta no mural " },
      { uid: "u9", nome: "Tais" },
      AGORA,
    );
    expect(n).toEqual({
      destinatarioUid: null,
      tipo: "pergunta_mural",
      titulo: "Pergunta no mural",
      lida: false,
      criadoEm: AGORA.toISOString(),
      origemUid: "u9",
      origemNome: "Tais",
    });
  });

  it("resumo e link em branco viram ausência, não string vazia", () => {
    const n = novaNotificacao(
      { destinatarioUid: "u1", tipo: "emissao_erro", titulo: "Falhou", resumo: "  ", link: "" },
      { uid: "u9", nome: "Tais" },
      AGORA,
    );
    expect(n.resumo).toBeUndefined();
    expect(n.link).toBeUndefined();
  });
});

describe("visivelPara", () => {
  it("a de grupo aparece para qualquer pessoa; a pessoal, só para a destinatária", () => {
    expect(visivelPara(notificacao({ destinatarioUid: null }), "u2")).toBe(true);
    expect(visivelPara(notificacao({ destinatarioUid: "u1" }), "u1")).toBe(true);
    expect(visivelPara(notificacao({ destinatarioUid: "u1" }), "u2")).toBe(false);
  });
});

describe("estaLida", () => {
  it("notificação pessoal lê o próprio campo `lida`", () => {
    expect(estaLida(notificacao({ lida: false }), "u1", null)).toBe(false);
    expect(estaLida(notificacao({ lida: true }), "u1", null)).toBe(true);
  });

  it("a de grupo compara com o carimbo de leitura da pessoa", () => {
    const doGrupo = notificacao({
      destinatarioUid: null,
      criadoEm: "2026-08-23T12:00:00.000Z",
    });
    // Sem carimbo, tudo é novo.
    expect(estaLida(doGrupo, "u2", null)).toBe(false);
    // Criada depois do carimbo: ainda não vista.
    expect(estaLida(doGrupo, "u2", "2026-08-23T11:00:00.000Z")).toBe(false);
    // Criada no carimbo ou antes: vista.
    expect(estaLida(doGrupo, "u2", "2026-08-23T12:00:00.000Z")).toBe(true);
    // O campo `lida` do documento compartilhado não manda em nada.
    expect(estaLida(notificacao({ ...doGrupo, lida: true }), "u2", null)).toBe(false);
  });

  it("aviso dirigido a outra pessoa nunca conta para mim", () => {
    expect(estaLida(notificacao({ destinatarioUid: "u9", lida: false }), "u1", null)).toBe(true);
  });
});

describe("naoLidas", () => {
  it("mistura pessoais não lidas com as de grupo mais novas que o carimbo", () => {
    const lista = [
      notificacao({ id: "pessoal-nova", lida: false }),
      notificacao({ id: "pessoal-lida", lida: true }),
      notificacao({ id: "grupo-nova", destinatarioUid: null, criadoEm: "2026-08-23T13:00:00.000Z" }),
      notificacao({ id: "grupo-velha", destinatarioUid: null, criadoEm: "2026-08-23T10:00:00.000Z" }),
      notificacao({ id: "de-outro", destinatarioUid: "u9", lida: false }),
    ];
    const pendentes = naoLidas(lista, "u1", "2026-08-23T11:00:00.000Z");
    expect(pendentes.map((n) => n.id)).toEqual(["pessoal-nova", "grupo-nova"]);
  });
});
