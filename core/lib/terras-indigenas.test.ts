import { describe, expect, it } from "vitest";

import { getTerrasIndigenas } from "@/core/lib/terras-indigenas";
import { getEscolasTerritorio } from "@/core/lib/escolas-territorio";

const PAULO_AFONSO = "2924009";
const MANAUS = "1302603";
const SAO_GABRIEL = "1303809";
const IBATEGUARA = "2703007";

describe("cadastro da FUNAI por município", () => {
  it("devolve null onde a FUNAI não registra aldeia", () => {
    expect(getTerrasIndigenas(IBATEGUARA)).toBeNull();
    expect(getTerrasIndigenas("0000000")).toBeNull();
    expect(getTerrasIndigenas("")).toBeNull();
  });

  it("liga cada aldeia à terra indígena pelo código, não pelo nome", () => {
    const t = getTerrasIndigenas(PAULO_AFONSO)!;

    expect(t.aldeias).toHaveLength(3);
    for (const aldeia of t.aldeias) {
      expect(aldeia.terra, `${aldeia.nome} ficou sem terra`).not.toBeNull();
      expect(aldeia.terra!.nome).not.toBe("");
      expect(aldeia.terra!.fase).not.toBe("");
    }
  });

  it("agrupa as terras sem repetir quando várias aldeias são da mesma", () => {
    const t = getTerrasIndigenas(MANAUS)!;
    const codigos = t.terras.map((x) => x.codigo);

    expect(new Set(codigos).size).toBe(codigos.length);
    expect(t.terras.length).toBeLessThanOrEqual(t.aldeias.length);
  });
});

describe("o cruzamento com a rede escolar", () => {
  /**
   * O achado que motivou o dataset. Paulo Afonso tem três aldeias no cadastro
   * da FUNAI e nenhuma escola municipal declarada em terra indígena no Censo —
   * apesar de haver escola municipal a 1,3 km da primeira. O segmento indígena
   * é o de maior ponderação do FUNDEB, então a conferência vale dinheiro.
   */
  it("sinaliza município com aldeia registrada e nenhuma escola declarada", () => {
    const t = getTerrasIndigenas(PAULO_AFONSO)!;
    const escolas = getEscolasTerritorio(PAULO_AFONSO)!;

    expect(escolas.escolas.some((e) => e.dif === 2)).toBe(false);
    expect(t.escolasIndigenas).toBe(0);
    expect(t.registroSemDeclaracao).toBe(true);
    // Há escola municipal perto — o que falta é a classificação, não a escola.
    expect(t.aldeiasSemEscolaAlguma).toBe(0);
    expect(t.aldeiasSemEscolaIndigena).toBe(3);
  });

  it("não sinaliza onde o Censo já declara escola indígena", () => {
    for (const codigo of [MANAUS, SAO_GABRIEL]) {
      const t = getTerrasIndigenas(codigo)!;
      expect(t.escolasIndigenas).toBeGreaterThan(0);
      expect(t.registroSemDeclaracao).toBe(false);
    }
  });

  /** Distância é sempre em relação ao mais próximo, e nunca negativa. */
  it("mede a distância até a escola mais próxima, em km", () => {
    const t = getTerrasIndigenas(SAO_GABRIEL)!;
    const comDistancia = t.aldeias.filter((a) => a.kmAteEscola !== null);

    expect(comDistancia.length).toBeGreaterThan(100);
    for (const a of comDistancia) {
      expect(a.kmAteEscola!).toBeGreaterThanOrEqual(0);
      // A escola indígena mais próxima nunca pode estar mais perto que a
      // escola mais próxima de todas — ela é um subconjunto.
      if (a.kmAteEscolaIndigena !== null) {
        expect(a.kmAteEscolaIndigena).toBeGreaterThanOrEqual(a.kmAteEscola! - 0.05);
      }
    }
  });

  it("conta como fora do raio quem não tem escola indígena alguma", () => {
    const t = getTerrasIndigenas(PAULO_AFONSO)!;

    for (const a of t.aldeias) expect(a.kmAteEscolaIndigena).toBeNull();
    expect(t.aldeiasSemEscolaIndigena).toBe(t.aldeiasComCoordenada);
  });

  it("só conta no denominador a aldeia que tem coordenada", () => {
    const t = getTerrasIndigenas(SAO_GABRIEL)!;

    expect(t.aldeiasComCoordenada).toBeLessThanOrEqual(t.aldeias.length);
    expect(t.aldeiasSemEscolaIndigena).toBeLessThanOrEqual(t.aldeiasComCoordenada);
    expect(t.aldeiasSemEscolaAlguma).toBeLessThanOrEqual(t.aldeiasComCoordenada);
  });
});

describe("integridade do dataset", () => {
  it("traz fase e modalidade do processo demarcatório", () => {
    const t = getTerrasIndigenas(SAO_GABRIEL)!;
    const fases = new Set(t.terras.map((x) => x.fase));

    expect(fases.size).toBeGreaterThan(0);
    for (const terra of t.terras) {
      expect(terra.hectares === null || terra.hectares > 0).toBe(true);
      expect(typeof terra.fronteira).toBe("boolean");
    }
  });

  it("aceita o código com máscara", () => {
    expect(getTerrasIndigenas("2.924.009")?.aldeias).toHaveLength(3);
  });
});
