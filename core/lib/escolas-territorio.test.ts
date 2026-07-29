import { describe, expect, it } from "vitest";

import {
  getEscolasTerritorio,
  resumirTerritorio,
  type EscolaTerritorio,
} from "@/core/lib/escolas-territorio";

function escola(parcial: Partial<EscolaTerritorio> & { codigo: string }): EscolaTerritorio {
  return { rural: false, dif: 0, lat: null, lng: null, matriculas: null, transporte: null, racas: null, ...parcial };
}

describe("resumo do território escolar", () => {
  it("conta diferenciadas por código e calcula o % de transporte sobre as escolas com dado", () => {
    const r = resumirTerritorio([
      escola({ codigo: "1", dif: 8, rural: true, matriculas: 100, transporte: 80 }),
      escola({ codigo: "2", dif: 8, rural: true, matriculas: 50, transporte: 20 }),
      escola({ codigo: "3", dif: 2, lat: -3, lng: -60 }),
      escola({ codigo: "4", matriculas: 850, transporte: 0 }),
    ]);

    expect(r.porDiferenciada[8]).toBe(2);
    expect(r.porDiferenciada[2]).toBe(1);
    expect(r.rurais).toBe(2);
    expect(r.comCoordenada).toBe(1);
    // 100 de 1.000 matrículas com dado = 10% — a escola sem matrícula não
    // entra no denominador para não diluir o percentual.
    expect(r.alunosTransporte).toBe(100);
    expect(r.pctTransporte).toBe(10);
  });

  it("sem dado de transporte, o percentual é null em vez de zero", () => {
    const r = resumirTerritorio([escola({ codigo: "1" })]);
    expect(r.pctTransporte).toBeNull();
    expect(r.alunosTransporte).toBe(0);
    expect(r.corRaca).toBeNull();
  });

  it("compõe cor/raça por zona — o recorte que o agregado municipal esconde", () => {
    // racas = [ND, branca, preta, parda, amarela, indígena]
    const r = resumirTerritorio([
      escola({ codigo: "1", racas: [10, 30, 10, 40, 0, 10] }), // urbana: 50% negra
      escola({ codigo: "2", rural: true, racas: [0, 5, 15, 65, 0, 15] }), // rural: 80% negra
    ]);

    expect(r.corRaca?.urbana.matriculas).toBe(100);
    expect(r.corRaca?.urbana.negraPct).toBe(50);
    expect(r.corRaca?.rural.negraPct).toBe(80);
    expect(r.corRaca?.rural.indigenaPct).toBe(15);
    expect(r.corRaca?.urbana.naoDeclaradaPct).toBe(10);
  });
});

describe("leitura do dataset", () => {
  it("traz o caso conhecido da sonda (Manaus): ribeirinhas e transporte", () => {
    const m = getEscolasTerritorio("1302603")!;
    expect(m).not.toBeNull();
    expect(m.ano).toBe(2025);
    expect(m.resumo.total).toBe(508);
    expect(m.resumo.porDiferenciada[8]).toBe(37);
    expect(m.resumo.comCoordenada).toBeGreaterThan(450);
    expect(m.resumo.alunosTransporte).toBeGreaterThan(10_000);
  });

  it("devolve null para município inexistente", () => {
    expect(getEscolasTerritorio("0000000")).toBeNull();
  });
});
