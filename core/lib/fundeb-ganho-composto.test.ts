import { describe, expect, it } from "vitest";

import { comporGanho, parcelaVaar, referenciaVaarPorMatricula } from "./fundeb-ganho-composto";
import type { ParcelaGanhoFundeb, ReceitasFundeb } from "@/modules/levantamento-fundeb/types";

/**
 * O ganho da capa já foi `receita × multiplicador`: +R$ 136 milhões (+68%) em
 * Senador Canedo/GO, que não recebe complementação nenhuma da União. Estes
 * testes guardam a soma de parcelas que o substituiu.
 */
describe("ganho composto", () => {
  const canedo: ReceitasFundeb = {
    receitaContribuicaoMunicipal: 200_722_290.59,
    complementacaoVAAF: 0, complementacaoVAAT: 0, complementacaoVAAR: 0,
    totalReceitas: 200_722_290.59,
  };
  const vaar: ParcelaGanhoFundeb = {
    chave: "vaar", titulo: "VAAR a recuperar", valor: 17_755_530, regra: "", pagina: 5, natureza: "referencia",
  };

  it("soma as parcelas e fecha componente por componente", () => {
    const g = comporGanho({
      receitas: canedo, vaar, lacunas: { total: 0 },
      cenario: { valor: 3_178_840, matriculas: 1_094, mecanismo: "cada matrícula-equivalente a mais vale R$ 6.377,30 no fundo de GO" },
    });
    const p = g.total;

    expect(p.parcelas?.map((x) => x.chave)).toEqual(["vaar", "matriculas"]);
    // A regra da parcela diz o ritmo e o mecanismo, não só o total.
    expect(p.parcelas?.[1].regra).toContain("no ritmo que uma em cada quatro redes do país alcançou");
    expect(p.parcelas?.[1].regra).toContain("R$ 6.377,30 no fundo de GO");
    expect(p.totalGanho).toBe(17_755_530 + 3_178_840);
    // Uma ordem de grandeza abaixo dos +68% do multiplicador.
    expect(p.ganhoPercentual).toBeGreaterThan(5);
    expect(p.ganhoPercentual).toBeLessThan(15);
    expect(p.multiplicadorAplicado).toBeNull();
    expect(p.natureza).toBe("composta");

    const redistribuicao = p.totalProjetado - p.vaafProjetado - p.vaatProjetado - p.vaarProjetado;
    expect(p.vaarGanho).toBe(17_755_530);
    // Sem VAAF nem VAAT, todo o ganho de matrícula cai na redistribuição.
    expect(redistribuicao - canedo.receitaContribuicaoMunicipal).toBeCloseTo(3_178_840, 2);
  });

  it("reparte o ganho de matrícula na proporção do que o município já recebe", () => {
    const g = comporGanho({
      receitas: { receitaContribuicaoMunicipal: 50, complementacaoVAAF: 30, complementacaoVAAT: 20, complementacaoVAAR: 0, totalReceitas: 100 },
      vaar: null, lacunas: { total: 10, maiorTitulo: "Creche declarada em jornada parcial" }, cenario: null,
    });

    expect(g.total.vaafGanho).toBe(3);
    expect(g.total.vaatGanho).toBe(2);
    expect(g.total.vaarGanho).toBe(0);
    expect(g.total.totalProjetado).toBe(110);
    expect(g.total.parcelas?.[0].titulo).toBe("Lacunas de declaração ao Censo — creche declarada em jornada parcial");
  });

  it("separa o que é apurado do que depende de ação da rede", () => {
    const g = comporGanho({
      receitas: canedo, vaar, lacunas: { total: 664_827.8 },
      cenario: { valor: 1_000_000, matriculas: 300 },
    });

    expect(g.recuperavel.totalGanho).toBe(664_827.8);
    expect(g.recuperavel.natureza).toBe("recuperavel");
    expect(g.upside?.ganhoAdicional).toBe(17_755_530 + 1_000_000);
    expect(g.upside?.vetores).toHaveLength(2);
  });

  it("não inventa ganho quando nenhuma parcela se sustenta", () => {
    const g = comporGanho({ receitas: canedo, vaar: null, lacunas: null, cenario: null });

    expect(g.total.totalGanho).toBe(0);
    expect(g.total.totalProjetado).toBe(canedo.totalReceitas);
    expect(g.upside).toBeNull();
  });
});

describe("referência do VAAR por matrícula", () => {
  it("escala com a rede, em vez de repetir a mediana em reais do estado", () => {
    const goias = referenciaVaarPorMatricula("GO", 2026);

    // Em reais, a mediana dos habilitados de GO é R$ 528 mil — o valor de um
    // município de porte mediano, não de uma rede de 25 mil alunos.
    expect(goias?.entes).toBeGreaterThan(100);
    expect(goias?.porMatricula).toBeGreaterThan(500);
    expect(goias?.porMatricula).toBeLessThan(1_000);
  });

  it("monta a parcela de quem reprovou, com a conta na regra", () => {
    const parcela = parcelaVaar("5220454", 2026, 24_943);

    expect(parcela?.titulo).toBe("VAAR a recuperar — condicionalidades II e III");
    expect(parcela?.valor).toBeGreaterThan(10_000_000);
    expect(parcela?.regra).toContain("× 24.943 matrículas da rede");
    expect(parcela?.natureza).toBe("referencia");
  });

  it("não reivindica VAAR de quem já recebe", () => {
    // Alta Floresta D'Oeste/RO é beneficiária em 2026.
    expect(parcelaVaar("1100015", 2026, 3_000)).toBeNull();
  });

  it("não reivindica VAAR sem a rede dimensionada", () => {
    expect(parcelaVaar("5220454", 2026, 0)).toBeNull();
  });
});
