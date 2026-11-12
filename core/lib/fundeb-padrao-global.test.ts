import { describe, expect, it } from "vitest";

import { CASOS_GLOBAL, medirCaso, padraoGlobal } from "./fundeb-padrao-global";

/**
 * O Padrão Global é medido nos municípios atendidos, sobre a base do Censo.
 * Estes testes guardam o que ele mede — e o que ele de propósito não mede.
 */
describe("Padrão Global", () => {
  it("mede todos os casos e tira a mediana", () => {
    const p = padraoGlobal()!;

    expect(p.casos).toHaveLength(CASOS_GLOBAL.filter((c) => medirCaso(c) !== null).length);
    // Mediana dos casos: cerca de 11% da rede ao ano em matrícula ponderada,
    // contra cerca de 1% da rede mediana do país.
    expect(p.porAno).toBeGreaterThan(0.09);
    expect(p.porAno).toBeLessThan(0.14);
    expect(p.melhorAno).toBeGreaterThan(p.porAno);
    expect(p.acumulado).toBeGreaterThan(0.3);
  });

  it("mostra os casos como foram, inclusive o que não cresceu", () => {
    const serra = medirCaso(CASOS_GLOBAL.find((c) => c.nome === "Serra do Ramalho")!)!;
    const bonfim = medirCaso(CASOS_GLOBAL.find((c) => c.nome === "Senhor do Bonfim")!)!;

    // Serra do Ramalho não cresceu matrícula na janela: entra na mediana assim mesmo.
    expect(Math.abs(serra.ganhoAcumulado)).toBeLessThan(0.02);
    expect(serra.transicoes).toBe(2);
    expect(bonfim.ganhoAcumulado).toBeGreaterThan(0.45);
    expect(bonfim.transicoes).toBe(3);
  });

  it("caso em curso só entra quando há dois Censos na janela", () => {
    const juvenilia = CASOS_GLOBAL.find((c) => c.nome === "Juvenília")!;

    // Cliente desde 2026: sem o Censo de 2026 na base, ainda não há o que medir.
    // Quando o Censo de 2026 entrar, este teste falha de propósito: é a hora de
    // conferir quanto Juvenília cresceu e o que isso faz com a mediana — entre
    // 2022 e 2025 a rede cresceu 1% ao ano, e nesse ritmo o padrão cairia de
    // 11,4% para cerca de 7,9%. Confirmado o caso, apague estas três linhas.
    expect(juvenilia.censoFim).toBeUndefined();
    expect(medirCaso(juvenilia)).toBeNull();
    expect(padraoGlobal()!.casos.map((c) => c.nome)).not.toContain("Juvenília");
  });

  it("usa matrícula, não receita: a entrada no VAAT em 2024 foi do estado inteiro", () => {
    // O padrão é matrícula ponderada sobre a rede. Um ritmo de receita dos casos
    // (Senhor do Bonfim +287% de 2023 a 2026) seria várias vezes maior.
    expect(padraoGlobal()!.porAno).toBeLessThan(0.5);
  });
});
