import { describe, expect, it } from "vitest";

import {
  calcularPlacar,
  montarDinheiro,
  montarItens,
  type FontesDever,
} from "./dever-de-casa";
import type { SituacaoVaar } from "./fundeb-vaar";

/**
 * O julgamento é puro de propósito: estes testes fixam as três regras do
 * doc-comment — item sem dono sai do denominador, sem dado não é
 * descumprimento, estimativa é nomeada.
 */

function fontesVazias(): FontesDever {
  return {
    cauc: null,
    pontualidade: null,
    siope: null,
    vaar: null,
    remuneracao: null,
    conciliacao: null,
    faixaCreche: null,
    contaCreche: null,
    alfabetizacao: null,
    ideb: [],
  };
}

function vaarBase(parcial: Partial<SituacaoVaar> = {}): SituacaoVaar {
  return {
    exercicio: 2026,
    fonte: "FNDE",
    uf: "AL",
    ente: "Igaci",
    habilitado: true,
    beneficiario: true,
    complementacao: 1_200_000,
    coeficiente: 0.001,
    condicionalidades: { I: true, II: true, III: true, IV: true, V: true },
    reprovadas: [],
    evoluiuAtendimento: true,
    evoluiuAprendizagem: true,
    pendencia: null,
    condIVEstadual: false,
    habilitadoSemRepasse: false,
    referencia: { medianaNacional: 900_000, medianaUf: 750_000, ufBeneficiadas: 40, ufAvaliadas: 102 },
    ...parcial,
  };
}

describe("montarItens", () => {
  it("sem nenhuma fonte, todo item é sem_dado — nunca descumprimento", () => {
    const itens = montarItens(fontesVazias()).flatMap((b) => b.itens);
    expect(itens.length).toBeGreaterThan(0);
    expect(itens.every((i) => i.veredito === "sem_dado")).toBe(true);
  });

  it("Cond. IV reprovada no estado inteiro fica fora do alcance, não descumprida", () => {
    const f = fontesVazias();
    f.vaar = vaarBase({
      condicionalidades: { I: true, II: true, III: true, IV: false, V: true },
      reprovadas: ["IV"],
      condIVEstadual: true,
      beneficiario: false,
      complementacao: 0,
    });
    const itens = montarItens(f).flatMap((b) => b.itens);
    const condIV = itens.find((i) => i.id === "B-IV")!;
    expect(condIV.veredito).toBe("fora_do_alcance");
  });

  it("condicionalidade reprovada localmente é descumprimento com o motivo oficial", () => {
    const f = fontesVazias();
    f.vaar = vaarBase({
      condicionalidades: { I: false, II: true, III: true, IV: true, V: true },
      reprovadas: ["I"],
      pendencia: "Lei de gestão escolar não encaminhada",
      beneficiario: false,
      complementacao: 0,
    });
    const itens = montarItens(f).flatMap((b) => b.itens);
    const condI = itens.find((i) => i.id === "B-I")!;
    expect(condI.veredito).toBe("descumpre");
    expect(condI.medida).toContain("Lei de gestão escolar");
  });
});

describe("calcularPlacar", () => {
  it("sem_dado e fora_do_alcance saem do denominador da nota", () => {
    const f = fontesVazias();
    f.vaar = vaarBase({
      condicionalidades: { I: true, II: true, III: true, IV: false, V: true },
      reprovadas: ["IV"],
      condIVEstadual: true,
    });
    const placar = calcularPlacar(montarItens(f));
    // Só as quatro condicionalidades locais são verificáveis; IV está fora.
    expect(placar.avaliados).toBe(4);
    expect(placar.cumpre).toBe(4);
    expect(placar.foraDoAlcance).toBe(1);
    expect(placar.nota).toBe(10);
    expect(placar.rotulo).toBe("Faz o dever de casa");
  });

  it("nada verificável produz nota nula, não zero", () => {
    const placar = calcularPlacar(montarItens(fontesVazias()));
    expect(placar.avaliados).toBe(0);
    expect(placar.nota).toBeNull();
    expect(placar.rotulo).toBe("Sem dados suficientes");
  });

  it("parcial vale meio ponto", () => {
    const blocos = [
      {
        id: "contas" as const,
        titulo: "t",
        sub: "s",
        itens: [
          { id: "X1", titulo: "", criterio: "", medida: "", veredito: "cumpre" as const, fonte: "" },
          { id: "X2", titulo: "", criterio: "", medida: "", veredito: "parcial" as const, fonte: "" },
          { id: "X3", titulo: "", criterio: "", medida: "", veredito: "descumpre" as const, fonte: "" },
          { id: "X4", titulo: "", criterio: "", medida: "", veredito: "descumpre" as const, fonte: "" },
        ],
      },
    ];
    const placar = calcularPlacar(blocos);
    // (1 + 0,5) / 4 = 0,375 → nota 3,8 (arredondada a uma casa)
    expect(placar.nota).toBe(3.8);
    expect(placar.rotulo).toBe("Não faz o dever de casa");
  });
});

describe("montarDinheiro", () => {
  it("VAAR zerado por reprovação local entra como estimativa pela mediana da UF", () => {
    const f = fontesVazias();
    f.vaar = vaarBase({
      beneficiario: false,
      complementacao: 0,
      condicionalidades: { I: false, II: true, III: true, IV: true, V: true },
      reprovadas: ["I"],
    });
    const { naMesa } = montarDinheiro(f);
    expect(naMesa).toHaveLength(1);
    expect(naMesa[0].valor).toBe(750_000);
    expect(naMesa[0].estimativa).toBe(true);
  });

  it("reprovação só na Cond. IV estadual não vira dinheiro na mesa", () => {
    const f = fontesVazias();
    f.vaar = vaarBase({
      beneficiario: false,
      complementacao: 0,
      condicionalidades: { I: true, II: true, III: true, IV: false, V: true },
      reprovadas: ["IV"],
      condIVEstadual: true,
    });
    const { naMesa } = montarDinheiro(f);
    expect(naMesa).toHaveLength(0);
  });

  it("quem recebe VAAR não tem parcela na mesa", () => {
    const f = fontesVazias();
    f.vaar = vaarBase();
    const { naMesa } = montarDinheiro(f);
    expect(naMesa).toHaveLength(0);
  });

  it("potencial da creche fica separado da perda", () => {
    const f = fontesVazias();
    f.contaCreche = {
      populacao: 1000,
      matriculaTotal: 300,
      coberturaTotal: 30,
      metaPct: 50,
      matriculasAteMeta: 200,
      fatorIntegral: 1.3,
      equivalentes: 260,
      valorPorEquivalente: 5000,
      valorDerivado: 1_300_000,
    };
    const { naMesa, potencial } = montarDinheiro(f);
    expect(naMesa).toHaveLength(0);
    expect(potencial).toHaveLength(1);
    expect(potencial[0].valor).toBe(1_300_000);
    expect(potencial[0].estimativa).toBe(true);
  });
});
