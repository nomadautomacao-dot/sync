import { describe, expect, it } from "vitest";

import {
  estaEmAberto,
  novoPost,
  podeEditarPost,
  podeResolver,
  repartirMural,
  type PostDoMural,
} from "./mural";

const AGORA = new Date("2026-08-13T15:00:00.000Z");

function post(parcial: Partial<PostDoMural>): PostDoMural {
  return {
    id: "p1",
    tipo: "recado",
    texto: "Aviso à equipe",
    autorUid: "u1",
    autorNome: "Tais",
    criadoEm: "2026-08-13T12:00:00.000Z",
    ...parcial,
  };
}

describe("estaEmAberto", () => {
  it("só pergunta sem resposta aceita cobra alguém", () => {
    expect(estaEmAberto(post({ tipo: "pergunta" }))).toBe(true);
  });

  it("recado não fica pendente — ele foi dado", () => {
    // Uma caixa que acusa tudo o que não foi respondido acusaria "bom dia".
    expect(estaEmAberto(post({ tipo: "recado" }))).toBe(false);
    expect(estaEmAberto(post({ tipo: "arquivo" }))).toBe(false);
  });

  it("pergunta encerrada sai da conta", () => {
    const resolvida = post({ tipo: "pergunta", resolvidoEm: AGORA.toISOString() });
    expect(estaEmAberto(resolvida)).toBe(false);
  });
});

describe("repartirMural", () => {
  const entrada = [
    post({ id: "aberta-antiga", tipo: "pergunta", criadoEm: "2026-08-01T10:00:00.000Z" }),
    post({ id: "aberta-nova", tipo: "pergunta", criadoEm: "2026-08-12T10:00:00.000Z" }),
    post({ id: "recado-novo", criadoEm: "2026-08-13T10:00:00.000Z" }),
    post({ id: "recado-velho", criadoEm: "2026-07-01T10:00:00.000Z" }),
    post({
      id: "resolvida",
      tipo: "pergunta",
      criadoEm: "2026-08-10T10:00:00.000Z",
      resolvidoEm: "2026-08-11T10:00:00.000Z",
    }),
  ];

  it("põe a pergunta mais antiga no topo das em aberto", () => {
    // A que espera há mais tempo é a mais constrangedora.
    const { emAberto } = repartirMural(entrada);
    expect(emAberto.map((p) => p.id)).toEqual(["aberta-antiga", "aberta-nova"]);
  });

  it("põe o mais recente no topo da conversa", () => {
    const { conversa } = repartirMural(entrada);
    expect(conversa.map((p) => p.id)).toEqual(["recado-novo", "resolvida", "recado-velho"]);
  });

  it("não repete a pergunta em aberto nos dois blocos", () => {
    // Duplicar faria alguém responder duas vezes ou ver dois assuntos.
    const { emAberto, conversa } = repartirMural(entrada);
    const repetidos = emAberto.filter((a) => conversa.some((c) => c.id === a.id));
    expect(repetidos).toEqual([]);
  });

  it("não perde post", () => {
    const { emAberto, conversa } = repartirMural(entrada);
    expect([...emAberto, ...conversa]).toHaveLength(entrada.length);
  });

  it("não muda a lista que recebeu", () => {
    const ordemOriginal = entrada.map((p) => p.id);
    repartirMural(entrada);
    expect(entrada.map((p) => p.id)).toEqual(ordemOriginal);
  });
});

describe("podeResolver", () => {
  const pergunta = post({ tipo: "pergunta", autorUid: "u1" });

  it("quem perguntou encerra", () => {
    expect(podeResolver(pergunta, "u1", false)).toBe(true);
  });

  it("quem administra também", () => {
    expect(podeResolver(pergunta, "u2", true)).toBe(true);
  });

  it("quem respondeu não encerra sozinho", () => {
    // A resposta certa quem reconhece é quem tinha a dúvida.
    expect(podeResolver(pergunta, "u2", false)).toBe(false);
  });

  it("recado não se encerra — não estava aberto", () => {
    expect(podeResolver(post({ autorUid: "u1" }), "u1", true)).toBe(false);
  });
});

describe("podeEditarPost", () => {
  it("só o autor reescreve a própria fala", () => {
    expect(podeEditarPost(post({ autorUid: "u1" }), "u1")).toBe(true);
    expect(podeEditarPost(post({ autorUid: "u1" }), "u2")).toBe(false);
  });
});

describe("novoPost", () => {
  const autor = { uid: "u1", nome: "Tais Cristina" };

  it("carimba autoria e data", () => {
    const doc = novoPost({ tipo: "recado", texto: "  Reunião adiada  " }, autor, AGORA);
    expect(doc.autorUid).toBe("u1");
    expect(doc.autorNome).toBe("Tais Cristina");
    expect(doc.criadoEm).toBe(AGORA.toISOString());
    expect(doc.texto).toBe("Reunião adiada");
  });

  it("não grava chave vazia — o Firestore recusa undefined", () => {
    const doc = novoPost({ tipo: "recado", texto: "Sem cidade" }, autor, AGORA);
    expect(doc).not.toHaveProperty("cityId");
    expect(doc).not.toHaveProperty("cityName");
    expect(doc).not.toHaveProperty("anexo");
  });

  it("guarda o vínculo com a cidade quando há", () => {
    const doc = novoPost(
      { tipo: "pergunta", texto: "Falta o ofício?", cityId: "c1", cityName: "Igaci" },
      autor,
      AGORA,
    );
    expect(doc.cityId).toBe("c1");
    expect(doc.cityName).toBe("Igaci");
  });
});
