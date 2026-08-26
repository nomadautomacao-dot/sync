import { describe, expect, it } from "vitest";

import {
  estaPendente,
  estadoInicial,
  novoEvento,
  podeEditarEvento,
  repartirLinhaDoTempo,
  TIPOS_MANUAIS,
  type EventoDaCidade,
} from "./cidade-eventos";

const AGORA = new Date("2026-08-13T12:00:00.000Z");

function evento(parcial: Partial<EventoDaCidade>): EventoDaCidade {
  return {
    id: "e1",
    tipo: "reuniao",
    titulo: "Reunião com a secretária",
    quando: "2026-08-20T14:00:00.000Z",
    estado: "marcado",
    autorUid: "u1",
    autorNome: "Tais",
    criadoEm: "2026-08-10T09:00:00.000Z",
    ...parcial,
  };
}

describe("estadoInicial", () => {
  it("agenda o que é agendável e está no futuro", () => {
    expect(estadoInicial("reuniao", "2026-08-20T14:00:00.000Z", AGORA)).toBe("marcado");
    expect(estadoInicial("visita", "2026-08-20T14:00:00.000Z", AGORA)).toBe("marcado");
  });

  it("registra, e não agenda, o que já passou", () => {
    // Quem lança a reunião da semana passada está registrando.
    expect(estadoInicial("reuniao", "2026-08-01T14:00:00.000Z", AGORA)).toBe("realizado");
  });

  it("nunca agenda o que só se escreve depois de acontecer", () => {
    // Nascessem "marcado", cairiam na lista de pendências no instante seguinte
    // ao de serem escritos.
    for (const tipo of ["ligacao", "nota", "relatorio_campo"] as const) {
      expect(estadoInicial(tipo, "2026-12-01T14:00:00.000Z", AGORA)).toBe("realizado");
    }
  });
});

describe("estaPendente", () => {
  it("acusa o compromisso que passou sem desfecho", () => {
    expect(estaPendente(evento({ quando: "2026-08-01T14:00:00.000Z" }), AGORA)).toBe(true);
  });

  it("não acusa o que ainda vai acontecer", () => {
    expect(estaPendente(evento({}), AGORA)).toBe(false);
  });

  it("não acusa o que foi cancelado — alguém decidiu", () => {
    const cancelado = evento({ quando: "2026-08-01T14:00:00.000Z", estado: "cancelado" });
    expect(estaPendente(cancelado, AGORA)).toBe(false);
  });
});

describe("repartirLinhaDoTempo", () => {
  const entrada = [
    evento({ id: "futuro-longe", quando: "2026-09-10T10:00:00.000Z" }),
    evento({ id: "futuro-perto", quando: "2026-08-14T10:00:00.000Z" }),
    evento({ id: "vencido", quando: "2026-08-05T10:00:00.000Z" }),
    evento({ id: "antigo", quando: "2026-07-01T10:00:00.000Z", estado: "realizado" }),
    evento({ id: "recente", quando: "2026-08-11T10:00:00.000Z", estado: "realizado" }),
  ];

  it("põe o próximo compromisso no topo da agenda", () => {
    const { agenda } = repartirLinhaDoTempo(entrada, AGORA);
    expect(agenda.map((e) => e.id)).toEqual(["futuro-perto", "futuro-longe"]);
  });

  it("põe o acontecimento mais recente no topo do histórico", () => {
    // A ordem se inverte entre os blocos de propósito: no que passou interessa
    // o último, no que vem interessa o próximo.
    const { historico } = repartirLinhaDoTempo(entrada, AGORA);
    expect(historico.map((e) => e.id)).toEqual(["recente", "antigo"]);
  });

  it("separa a pendência da agenda", () => {
    const { pendencias, agenda } = repartirLinhaDoTempo(entrada, AGORA);
    expect(pendencias.map((e) => e.id)).toEqual(["vencido"]);
    expect(agenda.map((e) => e.id)).not.toContain("vencido");
  });

  it("não perde nem duplica evento", () => {
    const { agenda, pendencias, historico } = repartirLinhaDoTempo(entrada, AGORA);
    const total = [...agenda, ...pendencias, ...historico].map((e) => e.id);
    expect(total.sort()).toEqual(entrada.map((e) => e.id).sort());
  });

  it("não muda a lista que recebeu", () => {
    const original = entrada.map((e) => e.id);
    repartirLinhaDoTempo(entrada, AGORA);
    expect(entrada.map((e) => e.id)).toEqual(original);
  });
});

describe("podeEditarEvento", () => {
  it("deixa quem escreveu corrigir o próprio registro", () => {
    expect(podeEditarEvento(evento({ autorUid: "u1" }), "u1", "member")).toBe(true);
  });

  it("impede reescrever o registro de outra pessoa", () => {
    // O histórico da cidade é o que a equipe usa para se entender; registro
    // alterado por terceiro sem rastro corrói isso.
    expect(podeEditarEvento(evento({ autorUid: "u1" }), "u2", "member")).toBe(false);
    expect(podeEditarEvento(evento({ autorUid: "u1" }), "u2", "viewer")).toBe(false);
  });

  it("abre exceção para quem administra", () => {
    expect(podeEditarEvento(evento({ autorUid: "u1" }), "u2", "admin")).toBe(true);
    expect(podeEditarEvento(evento({ autorUid: "u1" }), "u2", "owner")).toBe(true);
  });
});

describe("novoEvento", () => {
  const autor = { uid: "u1", nome: "Tais Cristina" };

  it("carimba autoria e data de criação", () => {
    const doc = novoEvento(
      { tipo: "nota", titulo: "Ligar para o secretário", quando: AGORA.toISOString() },
      autor,
      AGORA,
    );
    expect(doc.autorUid).toBe("u1");
    expect(doc.autorNome).toBe("Tais Cristina");
    expect(doc.criadoEm).toBe(AGORA.toISOString());
  });

  it("não grava campo vazio — o Firestore recusa undefined", () => {
    const doc = novoEvento(
      { tipo: "nota", titulo: "  Nota  ", quando: AGORA.toISOString(), relato: "   " },
      autor,
      AGORA,
    );
    expect(doc).not.toHaveProperty("relato");
    expect(doc).not.toHaveProperty("participantes");
    expect(doc.titulo).toBe("Nota");
  });

  it("só oferece à mão o que a pessoa de fato escreve", () => {
    // `documento` e `etapa` nascem de anexar arquivo e de concluir etapa;
    // no formulário produziriam registro que não corresponde a nada.
    const chaves = TIPOS_MANUAIS.map((t) => t.key);
    expect(chaves).not.toContain("documento");
    expect(chaves).not.toContain("etapa");
    expect(chaves).toContain("reuniao");
  });
});

describe("anexo do evento", () => {
  const autor = { uid: "u1", nome: "Tais" };

  it("carrega o arquivo junto do acontecimento", () => {
    const doc = novoEvento(
      {
        tipo: "documento",
        titulo: "Análise anexada",
        quando: AGORA.toISOString(),
        anexo: { titulo: "Parecer.pdf", url: "https://x/parecer.pdf", documentoId: "d1" },
      },
      autor,
      AGORA,
    );
    expect(doc.anexo?.url).toBe("https://x/parecer.pdf");
    expect(doc.anexo?.documentoId).toBe("d1");
  });

  it("não grava a chave quando não há anexo", () => {
    // Firestore recusa `undefined`; a chave simplesmente não existe.
    const doc = novoEvento(
      { tipo: "nota", titulo: "Nota", quando: AGORA.toISOString() },
      autor,
      AGORA,
    );
    expect(doc).not.toHaveProperty("anexo");
  });

  it("documento nasce realizado — o arquivo já subiu", () => {
    expect(estadoInicial("documento", "2026-12-01T00:00:00.000Z", AGORA)).toBe("realizado");
  });
});
