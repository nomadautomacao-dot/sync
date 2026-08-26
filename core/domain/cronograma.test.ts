import { describe, expect, it } from "vitest";

import {
  MODELO_DE_IMPLANTACAO,
  estaAtrasada,
  hojeEmData,
  montarCronogramaDoModelo,
  novaOrdemAposMover,
  ordenarCronograma,
  proximaOrdem,
  resumoDoCronograma,
  somarDias,
  type EtapaDoCronograma,
} from "./cronograma";

const AGORA = new Date("2026-08-13T15:00:00.000Z");

function etapa(parcial: Partial<EtapaDoCronograma>): EtapaDoCronograma {
  return {
    id: "e1",
    ordem: 0,
    nome: "Etapa",
    prazo: "2026-09-01",
    estado: "pendente",
    criadoEm: "2026-08-01T00:00:00.000Z",
    ...parcial,
  };
}

describe("somarDias", () => {
  it("atravessa a virada do mês", () => {
    expect(somarDias("2026-08-30", 3)).toBe("2026-09-02");
  });

  it("atravessa a virada do ano", () => {
    expect(somarDias("2026-12-30", 5)).toBe("2027-01-04");
  });

  it("acerta ano bissexto", () => {
    expect(somarDias("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("não anda um dia sozinho por causa de fuso", () => {
    // O erro que isto trava: montar a data em horário local faz um fuso a oeste
    // de Greenwich devolver o dia anterior na volta para texto.
    expect(somarDias("2026-08-13", 0)).toBe("2026-08-13");
    expect(somarDias("2026-01-01", 0)).toBe("2026-01-01");
  });

  it("recusa data inválida em vez de devolver lixo", () => {
    expect(() => somarDias("13/08/2026", 1)).toThrow();
  });
});

describe("montarCronogramaDoModelo", () => {
  it("copia o modelo inteiro, na ordem", () => {
    const etapas = montarCronogramaDoModelo("2026-08-13", AGORA);
    expect(etapas).toHaveLength(MODELO_DE_IMPLANTACAO.length);
    expect(etapas.map((e) => e.ordem)).toEqual(
      MODELO_DE_IMPLANTACAO.map((_, indice) => indice),
    );
  });

  it("conta os prazos a partir do início", () => {
    const etapas = montarCronogramaDoModelo("2026-08-13", AGORA);
    expect(etapas[0].prazo).toBe("2026-08-13");
    // A última do modelo é o relatório de resultados, 180 dias depois.
    expect(etapas[etapas.length - 1].prazo).toBe(somarDias("2026-08-13", 180));
  });

  it("marca a origem de cada etapa", () => {
    const etapas = montarCronogramaDoModelo("2026-08-13", AGORA);
    expect(etapas.every((e) => Boolean(e.modeloKey))).toBe(true);
    expect(etapas.every((e) => e.estado === "pendente")).toBe(true);
  });

  it("as chaves do modelo não se repetem", () => {
    // Chave repetida faria duas etapas diferentes se confundirem na origem.
    const chaves = MODELO_DE_IMPLANTACAO.map((e) => e.key);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it("o modelo está em ordem crescente de prazo", () => {
    const dias = MODELO_DE_IMPLANTACAO.map((e) => e.diasAposInicio);
    expect([...dias].sort((a, b) => a - b)).toEqual(dias);
  });
});

describe("estaAtrasada", () => {
  it("acusa o que passou do prazo sem ser concluído", () => {
    expect(estaAtrasada(etapa({ prazo: "2026-08-01" }), AGORA)).toBe(true);
  });

  it("dá o dia inteiro a quem vence hoje", () => {
    // Marcar como atrasada às 00h01 do próprio dia seria mentira.
    expect(estaAtrasada(etapa({ prazo: hojeEmData(AGORA) }), AGORA)).toBe(false);
  });

  it("não acusa o que já foi concluído, mesmo fora do prazo", () => {
    expect(estaAtrasada(etapa({ prazo: "2026-08-01", estado: "concluida" }), AGORA)).toBe(false);
  });
});

describe("resumoDoCronograma", () => {
  const etapas = [
    etapa({ id: "a", ordem: 0, prazo: "2026-08-01", estado: "concluida" }),
    etapa({ id: "b", ordem: 1, prazo: "2026-08-05", estado: "em_andamento" }),
    etapa({ id: "c", ordem: 2, prazo: "2026-09-01", estado: "pendente" }),
  ];

  it("conta concluídas e atrasadas", () => {
    const r = resumoDoCronograma(etapas, AGORA);
    expect(r.total).toBe(3);
    expect(r.concluidas).toBe(1);
    expect(r.atrasadas).toBe(1);
    expect(r.percentual).toBe(33);
  });

  it("aponta a próxima na ordem do cronograma", () => {
    expect(resumoDoCronograma(etapas, AGORA).proxima?.id).toBe("b");
  });

  it("não devolve próxima quando tudo está concluído", () => {
    const tudo = etapas.map((e) => ({ ...e, estado: "concluida" as const }));
    const r = resumoDoCronograma(tudo, AGORA);
    expect(r.proxima).toBeNull();
    expect(r.percentual).toBe(100);
  });

  it("devolve 0% e não NaN quando não há etapa", () => {
    const r = resumoDoCronograma([], AGORA);
    expect(r.percentual).toBe(0);
    expect(r.proxima).toBeNull();
  });
});

describe("ordenarCronograma", () => {
  it("respeita a posição e desempata pelo prazo", () => {
    const fora = [
      etapa({ id: "c", ordem: 2, prazo: "2026-09-01" }),
      etapa({ id: "b1", ordem: 1, prazo: "2026-08-20" }),
      etapa({ id: "b2", ordem: 1, prazo: "2026-08-10" }),
    ];
    expect(ordenarCronograma(fora).map((e) => e.id)).toEqual(["b2", "b1", "c"]);
  });

  it("não muda a lista que recebeu", () => {
    const entrada = [etapa({ id: "z", ordem: 5 }), etapa({ id: "a", ordem: 1 })];
    ordenarCronograma(entrada);
    expect(entrada.map((e) => e.id)).toEqual(["z", "a"]);
  });
});

describe("novaOrdemAposMover", () => {
  const lista = [
    etapa({ id: "a", ordem: 0 }),
    etapa({ id: "b", ordem: 1 }),
    etapa({ id: "c", ordem: 2 }),
    etapa({ id: "d", ordem: 3 }),
  ];

  it("move para baixo e renumera a lista inteira", () => {
    expect(novaOrdemAposMover(lista, "a", "c")).toEqual([
      { id: "b", ordem: 0 },
      { id: "c", ordem: 1 },
      { id: "a", ordem: 2 },
      { id: "d", ordem: 3 },
    ]);
  });

  it("move para cima", () => {
    expect(novaOrdemAposMover(lista, "d", "b")).toEqual([
      { id: "a", ordem: 0 },
      { id: "d", ordem: 1 },
      { id: "b", ordem: 2 },
      { id: "c", ordem: 3 },
    ]);
  });

  it("renumera até os empates herdados do modelo antigo", () => {
    // Duas avulsas criadas juntas empatavam na mesma ordem; depois do primeiro
    // arrasto a numeração fica sequencial e o empate deixa de existir.
    const comEmpate = [
      etapa({ id: "a", ordem: 5 }),
      etapa({ id: "b", ordem: 5 }),
      etapa({ id: "c", ordem: 9 }),
    ];
    expect(novaOrdemAposMover(comEmpate, "c", "a")).toEqual([
      { id: "c", ordem: 0 },
      { id: "a", ordem: 1 },
      { id: "b", ordem: 2 },
    ]);
  });

  it("soltar no mesmo lugar ou id desconhecido não grava nada", () => {
    expect(novaOrdemAposMover(lista, "a", "a")).toBeNull();
    expect(novaOrdemAposMover(lista, "x", "b")).toBeNull();
    expect(novaOrdemAposMover(lista, "a", "x")).toBeNull();
  });
});

describe("proximaOrdem", () => {
  it("põe a avulsa no fim", () => {
    expect(proximaOrdem([etapa({ ordem: 0 }), etapa({ ordem: 7 })])).toBe(8);
  });

  it("começa em zero no cronograma vazio", () => {
    expect(proximaOrdem([])).toBe(0);
  });
});
