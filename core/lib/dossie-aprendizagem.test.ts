import { describe, expect, it } from "vitest";

import {
  lerIdeb,
  montarDossieAprendizagem,
  montarSerieIdeb,
  montarSeries,
  type AnoIdeb,
} from "@/core/lib/dossie-aprendizagem";
import { generateDossieAprendizagemHtml } from "@/core/lib/dossie-aprendizagem-template";
import { getSaebDistribuicao, getReferenciaNacionalSaeb } from "@/core/lib/saeb-distribuicao";
import { getInepCensoMunicipalRecord } from "@/core/lib/inep-censo";
import { getRendimentoMunicipal } from "@/core/lib/rendimento-municipal";

const PAULO_AFONSO = "2924009";
const MANAUS = "1302603";
const IBATEGUARA = "2703007";
const SAO_PAULO = "3550308";

describe("distribuição de proficiência", () => {
  it("traz as quatro provas com os quatro grupos somando 100%", () => {
    const series = montarSeries(getSaebDistribuicao(MANAUS), getInepCensoMunicipalRecord(MANAUS));

    expect(series).toHaveLength(4);
    for (const s of series) {
      const soma = s.grupos.reduce((t, g) => t + g.pct, 0);
      expect(soma).toBeGreaterThan(99);
      expect(soma).toBeLessThan(101);
    }
  });

  /**
   * A regra que dá utilidade ao dossiê: percentual vira número de crianças.
   * A conversão é aproximada e o campo se chama `alunosAproximados` por isso —
   * mas ela tem de existir, senão o documento não muda conversa nenhuma.
   */
  it("converte percentual em crianças usando a matrícula da etapa", () => {
    const series = montarSeries(getSaebDistribuicao(SAO_PAULO), getInepCensoMunicipalRecord(SAO_PAULO));
    const lp5 = series.find((s) => s.chave === "lp5")!;

    expect(lp5.baseConversao).toBeGreaterThan(0);
    for (const g of lp5.grupos) expect(g.alunosAproximados).not.toBeNull();

    // A soma dos grupos convertidos reconstrói a base, a menos do arredondamento.
    const soma = lp5.grupos.reduce((t, g) => t + (g.alunosAproximados ?? 0), 0);
    expect(Math.abs(soma - lp5.baseConversao!)).toBeLessThan(5);
  });

  /** Sem Censo não há denominador — e o campo sai nulo em vez de inventado. */
  it("não converte em crianças sem a matrícula da etapa", () => {
    const series = montarSeries(getSaebDistribuicao(MANAUS), null);

    for (const s of series) {
      expect(s.baseConversao).toBeNull();
      for (const g of s.grupos) expect(g.alunosAproximados).toBeNull();
    }
  });

  it("devolve lista vazia quando a rede não foi avaliada", () => {
    expect(montarSeries(null, null)).toEqual([]);
  });
});

describe("régua nacional das redes municipais", () => {
  it("compara com as próprias redes municipais do país, não com a média geral", () => {
    const ref = getReferenciaNacionalSaeb();

    expect(ref.lp5!.redes).toBeGreaterThan(5000);
    // O 9º ano é avaliado em menos redes que o 5º — nem todo município tem
    // anos finais, e a régua precisa refletir isso em vez de fingir o mesmo N.
    expect(ref.lp9!.redes).toBeLessThan(ref.lp5!.redes);
    expect(ref.lp5!.medianaInsuficiente).toBeGreaterThan(0);
  });

  /**
   * Ibateguara/AL declara 96,3% dos alunos no nível avançado em LP do 5º ano,
   * contra mediana nacional de 20%. É a mesma rede que aparece com IDEB 9,6 e
   * 100% de aprovação no Dossiê das Escolas. Entregar isso a um prefeito como
   * conquista, sem dizer onde o número cai no país, é a afirmação que derruba
   * o documento inteiro quando alguém confere.
   */
  it("marca como atípica a distribuição acima do percentil 99 nacional", () => {
    const series = montarSeries(getSaebDistribuicao(IBATEGUARA), getInepCensoMunicipalRecord(IBATEGUARA));
    const lp5 = series.find((s) => s.chave === "lp5")!;

    expect(lp5.atipica).toBe(true);
    expect(lp5.grupos[3].pct).toBeGreaterThan(lp5.referencia!.medianaAvancado * 3);

    const html = gerar(IBATEGUARA, "IBATEGUARA", "AL");
    expect(html).toContain("Distribuição atípica no país");
    expect(html).toContain("Antes de ler os resultados desta rede");
  });

  it("não marca como atípica a rede que está na faixa normal do país", () => {
    for (const codigo of [PAULO_AFONSO, MANAUS, SAO_PAULO]) {
      const series = montarSeries(getSaebDistribuicao(codigo), getInepCensoMunicipalRecord(codigo));
      expect(series.every((s) => !s.atipica)).toBe(true);
    }
  });

  it("posiciona o município na distribuição nacional, por prova", () => {
    const series = montarSeries(getSaebDistribuicao(SAO_PAULO), getInepCensoMunicipalRecord(SAO_PAULO));

    for (const s of series) {
      expect(s.referencia!.percentilInsuficiente).toBeGreaterThanOrEqual(0);
      expect(s.referencia!.percentilInsuficiente).toBeLessThanOrEqual(100);
    }
  });
});

describe("série do IDEB", () => {
  it("junta as duas etapas numa linha por edição, em ordem", () => {
    const serie = montarSerieIdeb(MANAUS);
    const anos = serie.map((a) => a.ano);

    expect(serie.length).toBeGreaterThan(5);
    expect([...anos].sort((a, b) => a - b)).toEqual(anos);
    expect(serie.some((a) => a.anosIniciais !== null && a.anosFinais !== null)).toBe(true);
  });

  /**
   * O INEP não projeta meta municipal desde 2021. A coluna existe como
   * **referência nacional** — chamá-la de meta afirmaria compromisso que
   * ninguém assinou, e é a regra 3 da spec deste dossiê.
   */
  it("traz a referência nacional, e o HTML não a chama de meta do município", () => {
    const serie = montarSerieIdeb(PAULO_AFONSO);
    expect(serie.some((a) => a.referenciaAnosIniciais !== null)).toBe(true);

    const html = gerar(PAULO_AFONSO, "PAULO AFONSO", "BA");
    expect(html).toContain("não é meta");
    expect(html).toContain("referência nacional");
  });

  it("lê a trajetória entre as duas últimas edições", () => {
    const subindo = lerIdeb(serieDe([{ ano: 2021, ai: 5.0 }, { ano: 2023, ai: 5.4 }]));
    const caindo = lerIdeb(serieDe([{ ano: 2021, ai: 5.4 }, { ano: 2023, ai: 5.0 }]));
    const parada = lerIdeb(serieDe([{ ano: 2021, ai: 5.0 }, { ano: 2023, ai: 5.05 }]));

    expect(subindo[0].trajetoria).toBe("subindo");
    expect(caindo[0].trajetoria).toBe("caindo");
    // Movimento menor que 0,1 entre edições é ruído de medida, não tendência.
    expect(parada[0].trajetoria).toBe("estagnada");
  });

  it("não afirma trajetória com uma edição só", () => {
    expect(lerIdeb(serieDe([{ ano: 2023, ai: 5.0 }]))[0].trajetoria).toBe("indefinida");
  });

  /** São Paulo cai nas duas etapas em 2023 — é o caso que o dossiê precisa nomear. */
  it("identifica queda nas duas etapas", () => {
    const leitura = lerIdeb(montarSerieIdeb(SAO_PAULO));
    expect(leitura.every((l) => l.trajetoria === "caindo")).toBe(true);
  });
});

describe("rendimento e recorte de rede", () => {
  it("prefere o recorte municipal e declara qual usou", () => {
    const r = getRendimentoMunicipal(PAULO_AFONSO)!;
    expect(r.recorte).toBe("municipal");
    expect(r.anosIniciais.aprovacao).toBeGreaterThan(0);
    expect(r.anosFinais.distorcao).toBeGreaterThan(0);
  });

  it("devolve null onde o INEP não publicou rendimento", () => {
    expect(getRendimentoMunicipal("0000000")).toBeNull();
  });

  /** Ausência é ausência, nunca zero. */
  it("não confunde dado ausente com zero", () => {
    const r = getRendimentoMunicipal(MANAUS)!;
    for (const chave of ["aprovacao", "reprovacao", "abandono", "distorcao"] as const) {
      const valor = r.anosIniciais[chave];
      expect(valor === null || typeof valor === "number").toBe(true);
    }
  });
});

describe("alfabetização contra a meta assinada", () => {
  /**
   * São Paulo avança 5,0 pontos por ano e precisaria de 5,4 até 2030. É a
   * única afirmação de "meta perdida" que este dossiê pode fazer com número,
   * porque a meta é do próprio município.
   */
  it("diz quando a meta final está fora de alcance em ritmo constante", () => {
    const d = montarDossieAprendizagem(SAO_PAULO, "SAO PAULO", "SP");
    expect(d.resumo.metaFinalForaDeAlcance).toBe(true);

    const html = gerar(SAO_PAULO, "SAO PAULO", "SP");
    expect(html).toContain("não é alcançada");
  });

  it("não declara meta perdida onde o ritmo alcança", () => {
    const d = montarDossieAprendizagem(PAULO_AFONSO, "PAULO AFONSO", "BA");
    expect(d.resumo.metaFinalForaDeAlcance).toBe(false);
  });

  /** Ritmo necessário negativo significa meta já superada, não meta a -4 pt/ano. */
  it("não imprime ritmo necessário negativo", () => {
    const html = gerar(IBATEGUARA, "IBATEGUARA", "AL");
    expect(html).toContain("meta já superada");
    expect(html).not.toMatch(/-\d+,\d+ pt\/ano/);
  });
});

describe("HTML do Dossiê da Aprendizagem", () => {
  it("imprime um bloco por prova e uma linha por edição do IDEB", () => {
    const d = montarDossieAprendizagem(MANAUS, "MANAUS", "AM");
    const html = gerar(MANAUS, "MANAUS", "AM");

    expect(html.match(/<article class="serie /g) ?? []).toHaveLength(d.series.length);
    expect(html.match(/<tr class="ano-ideb">/g) ?? []).toHaveLength(d.serieIdeb.length);
  });

  /** O ENEM é rede estadual. Apresentá-lo como resultado municipal é regra 4. */
  it("diz que o ENEM não é da rede municipal", () => {
    const html = gerar(PAULO_AFONSO, "PAULO AFONSO", "BA");
    expect(html).toContain("não é da rede municipal");
  });

  it("não afirma resultado de cliente nem histórico de contratos", () => {
    const html = gerar(MANAUS, "MANAUS", "AM");
    for (const proibido of [
      /j[áa] recuperamos/i,
      /nossos clientes/i,
      /case de sucesso/i,
      /municípios atendidos/i,
    ]) {
      expect(html).not.toMatch(proibido);
    }
  });
});

function serieDe(pontos: Array<{ ano: number; ai: number }>): AnoIdeb[] {
  return pontos.map((p) => ({
    ano: p.ano,
    anosIniciais: p.ai,
    anosFinais: null,
    referenciaAnosIniciais: null,
    referenciaAnosFinais: null,
  }));
}

function gerar(codigo: string, nome: string, uf: string): string {
  return generateDossieAprendizagemHtml({
    municipio: nome,
    uf,
    codigoIbge: codigo,
    dossie: montarDossieAprendizagem(codigo, nome, uf),
    geradoEm: new Date("2026-07-30T12:00:00.000Z"),
  });
}
