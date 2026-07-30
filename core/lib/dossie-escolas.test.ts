import { describe, expect, it } from "vitest";

import { montarDossieEscolas } from "@/core/lib/dossie-escolas";
import { getEscolasTerritorio } from "@/core/lib/escolas-territorio";
import { getIdebEscolas } from "@/core/lib/ideb-escolas";

const PAULO_AFONSO = "2924009";
const MANAUS = "1302603";
const IBATEGUARA = "2703007";

describe("montagem do Dossiê das Escolas", () => {
  /**
   * A regra de cobertura do módulo. Se o join partisse da divulgação do IDEB,
   * creche e pré-escola pura ficariam de fora — e são justamente as de maior
   * fator de ponderação. A base é o Censo Escolar, sempre.
   */
  it("traz toda a rede municipal, não só as escolas com IDEB", () => {
    const d = montarDossieEscolas(PAULO_AFONSO)!;
    const territorio = getEscolasTerritorio(PAULO_AFONSO)!;
    const ideb = getIdebEscolas(PAULO_AFONSO)!;

    expect(d.escolas).toHaveLength(territorio.escolas.length);
    expect(d.escolas.length).toBeGreaterThan(ideb.escolas.length);
  });

  it("não perde nenhuma escola no join", () => {
    const d = montarDossieEscolas(MANAUS)!;
    const codigos = new Set(d.escolas.map((e) => e.codigo));

    expect(d.cobertura.total).toBe(d.escolas.length);
    expect(codigos.size).toBe(d.escolas.length);
  });

  it("devolve null onde os microdados não trouxeram a rede", () => {
    expect(montarDossieEscolas("0000000")).toBeNull();
  });

  it("declara a cobertura de cada base, que é diferente entre elas", () => {
    const c = montarDossieEscolas(MANAUS)!.cobertura;

    expect(c.comIdeb).toBeLessThan(c.total);
    expect(c.comInse).toBeLessThan(c.total);
    expect(c.comCoordenada).toBeLessThanOrEqual(c.total);
  });

  /**
   * A ordenação é a tese do dossiê: quem tem sinal grave vem primeiro, porque
   * um documento de 500 blocos que começa pela ordem alfabética não é lido.
   */
  it("põe o sinal mais grave no topo", () => {
    const d = montarDossieEscolas(MANAUS)!;
    const primeiroSemSinalGrave = d.escolas.findIndex(
      (e) =>
        !e.sinais.includes("sem-resultado-participacao") &&
        !e.sinais.includes("abaixo-do-esperado-para-o-contexto"),
    );
    const ultimoComSinalGrave = d.escolas.reduce(
      (ultimo, e, i) =>
        e.sinais.includes("sem-resultado-participacao") ||
        e.sinais.includes("abaixo-do-esperado-para-o-contexto")
          ? i
          : ultimo,
      -1,
    );

    expect(primeiroSemSinalGrave).toBeGreaterThan(ultimoComSinalGrave);
  });

  /**
   * O sinal que o dossiê existe para produzir: escola que vai abaixo da mediana
   * da própria rede tendo contexto socioeconômico acima da mediana. Um ranking
   * de IDEB puro esconde essa escola, porque lá embaixo só aparecem as de
   * contexto mais difícil.
   */
  it("identifica a escola que vai pior do que o contexto dela explica", () => {
    const d = montarDossieEscolas(MANAUS)!;
    const alvo = d.escolas.filter((e) =>
      e.sinais.includes("abaixo-do-esperado-para-o-contexto"),
    );

    expect(alvo.length).toBeGreaterThan(0);
    const medianaInse = d.resumo.inseMedio!;
    for (const e of alvo) {
      expect(e.inse).toBeGreaterThan(medianaInse);
    }
  });

  /**
   * Ibateguara/AL tem as quatro escolas com IDEB divulgado em 100% de
   * aprovação e IDEB entre 9,2 e 9,8 — contra 4,9 de média em Paulo Afonso. O
   * IDEB é fluxo × proficiência, e aprovação integral põe o fluxo no teto. Não
   * é erro da base, é mecanismo — e precisa estar nomeado, senão o número
   * parece conquista.
   */
  it("nomeia aprovação de 100% como fluxo no teto", () => {
    const d = montarDossieEscolas(IBATEGUARA)!;

    expect(d.resumo.aprovacaoIntegral).toBeGreaterThan(0);
    const comIdeb = d.escolas.filter((e) => e.ai?.ideb != null);
    for (const e of comIdeb) {
      if (e.ai?.aprovacao === 100) expect(e.sinais).toContain("aprovacao-integral");
    }
  });

  it("soma as matrículas de toda a rede, não só das escolas avaliadas", () => {
    const d = montarDossieEscolas(PAULO_AFONSO)!;
    const somaDireta = d.escolas.reduce((t, e) => t + (e.matriculas ?? 0), 0);

    expect(d.resumo.matriculas).toBe(somaDireta);
    expect(d.resumo.matriculas).toBeGreaterThan(0);
  });

  it("rotula a localização diferenciada pelo dicionário do INEP", () => {
    const d = montarDossieEscolas(MANAUS)!;
    const dif = d.escolas.filter((e) => e.dif > 0);

    expect(dif.length).toBeGreaterThan(0);
    for (const e of dif) {
      expect(e.difRotulo).toBeTruthy();
      expect(e.sinais).toContain("localizacao-diferenciada");
    }
  });
});
