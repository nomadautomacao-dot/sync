import { describe, expect, it } from "vitest";

import { levantarAchados, varreduraLimpa, TIERS } from "@/core/lib/municipal-xray-achados";
import { mapMunicipalXrayModel } from "@/core/lib/municipal-xray-template";

function modelo(currentPayload: Record<string, unknown>) {
  return mapMunicipalXrayModel({
    basePayload: {},
    currentPayload,
    baseYear: 2024,
    currentYear: 2026,
    generatedAt: new Date("2026-07-30T12:00:00.000Z"),
  });
}

const VAAR_REPROVADO = {
  exercicio: 2025,
  habilitado: false,
  beneficiario: false,
  complementacao: 0,
  reprovadas: ["III"],
  condIVEstadual: false,
  referencia: { medianaUf: 2_303_028, ufBeneficiadas: 40, ufAvaliadas: 62 },
  pendencia: null,
};

describe("levantamento de achados do Raio-X", () => {
  it("não inventa achado onde as bases não devolveram nada", () => {
    expect(levantarAchados(modelo({}))).toEqual([]);
  });

  /**
   * A regra central do módulo. O valor da obra parada vem do painel do FNDE;
   * a matrícula fora do segmento não tem R$ publicado, e estimá-lo dependeria
   * do VAAF do exercício seguinte, que não existe na emissão.
   */
  it("imprime R$ só quando a fonte publicou o R$", () => {
    const achados = levantarAchados(
      modelo({
        relatorio_dirigido_base: {
          obrasFnde: {
            totalObras: 3,
            paralisadas: 2,
            inacabadas: 0,
            emRetomada: 1,
            valorParadoEstimado: 4_900_000,
            obrasCriticas: [],
          },
        },
      }),
    );

    const obra = achados.find((a) => a.onde === "Obras FNDE");
    expect(obra?.valor).toBe(4_900_000);
    expect(obra?.medida).toBeNull();
  });

  it("ordena por urgência antes de qualquer critério de valor", () => {
    const achados = levantarAchados(
      modelo({
        relatorio_fundeb: {
          idebAnosIniciais: [{ ano: 2023, idebVerificado: 4.0, metaProjetada: 5.0 }],
        },
        relatorio_dirigido_base: {
          vaar: VAAR_REPROVADO,
        },
      }),
    );

    // O IDEB abaixo da meta é tier 4; o VAAR zerado é tier 1 — e vem antes
    // mesmo sem R$ publicado, porque é dinheiro que já não entrou.
    expect(achados[0].tier).toBe(TIERS.perdido);
    expect(achados[0].onde).toBe("Complementações da União");
    expect(achados[achados.length - 1].tier).toBe(TIERS.resultado);
  });

  it("nomeia a condicionalidade reprovada e usa a mediana da UF como régua", () => {
    const achados = levantarAchados(modelo({ relatorio_dirigido_base: { vaar: VAAR_REPROVADO } }));

    expect(achados[0].titulo).toContain("III");
    expect(achados[0].medida).toContain("R$ 0 recebidos");
    expect(achados[0].medida).toContain("mediana dos habilitados da UF");
    expect(achados[0].valor).toBeNull();
  });

  /**
   * Reprovação estadual na Cond. IV (ICMS educacional) zera todo mundo na UF.
   * Cobrar gestão local por isso é diagnóstico errado, e a ação muda: é
   * articulação com o estado, não plano de rede.
   */
  it("separa a reprovação do estado da reprovação do município", () => {
    const achados = levantarAchados(
      modelo({
        relatorio_dirigido_base: {
          vaar: { ...VAAR_REPROVADO, condIVEstadual: true, reprovadas: ["IV"] },
        },
      }),
    );

    expect(achados[0].titulo).toContain("reprovação do estado");
    expect(achados[0].mecanismo).toContain("articulação estadual");
  });

  it("todo achado traz ação, prazo e a seção que o prova", () => {
    const achados = levantarAchados(
      modelo({
        relatorio_dirigido_base: {
          vaar: VAAR_REPROVADO,
          obrasFnde: { totalObras: 2, paralisadas: 1, inacabadas: 0, emRetomada: 0, valorParadoEstimado: 900_000, obrasCriticas: [] },
        },
        relatorio_fundeb: {
          idebAnosFinais: [{ ano: 2023, idebVerificado: 3.9, metaProjetada: 4.8 }],
        },
      }),
    );

    expect(achados.length).toBeGreaterThan(2);
    for (const a of achados) {
      expect(a.acao.length).toBeGreaterThan(20);
      expect(a.prazo.length).toBeGreaterThan(3);
      expect(a.onde.length).toBeGreaterThan(3);
      expect(a.mecanismo.length).toBeGreaterThan(20);
    }
  });
});

describe("varredura sem achado", () => {
  /**
   * O simétrico do levantamento. Base que não respondeu não é "limpo" — é
   * desconhecido, e não pode aparecer como ponto conferido, senão o dossiê
   * atesta o que não olhou.
   */
  it("não lista como conferido o que a fonte não respondeu", () => {
    expect(varreduraLimpa(modelo({}))).toEqual([]);
  });

  it("lista a habilitação quando ela existe e está em ordem", () => {
    const limpos = varreduraLimpa(
      modelo({
        relatorio_dirigido_base: {
          vaar: { ...VAAR_REPROVADO, habilitado: true, beneficiario: true, reprovadas: [] },
          obrasFnde: { totalObras: 2, paralisadas: 0, inacabadas: 0, emRetomada: 0, valorParadoEstimado: 0, obrasCriticas: [] },
        },
      }),
    );

    expect(limpos).toContain("VAAR habilitado nas cinco condicionalidades");
    expect(limpos).toContain("nenhuma obra parada no painel do FNDE");
  });

  /**
   * As duas listas dividem o mesmo universo: nenhum ponto pode sair nas duas,
   * senão o resumo se contradiz na mesma folha.
   */
  it("não põe o mesmo ponto nas duas listas", () => {
    const m = modelo({
      relatorio_dirigido_base: {
        vaar: VAAR_REPROVADO,
        obrasFnde: { totalObras: 2, paralisadas: 0, inacabadas: 0, emRetomada: 0, valorParadoEstimado: 0, obrasCriticas: [] },
      },
    });

    expect(levantarAchados(m).some((a) => a.onde === "Obras FNDE")).toBe(false);
    expect(varreduraLimpa(m)).toContain("nenhuma obra parada no painel do FNDE");
    expect(varreduraLimpa(m)).not.toContain("VAAR habilitado nas cinco condicionalidades");
  });
});
