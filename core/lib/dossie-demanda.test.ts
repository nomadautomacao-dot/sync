import { describe, expect, it } from "vitest";

import {
  montarContaDaCreche,
  montarFaixas,
  montarProjecao,
  type DossieDemanda,
} from "@/core/lib/dossie-demanda";
import { generateDossieDemandaHtml } from "@/core/lib/dossie-demanda-template";
import type { CoorteNascimento, DemografiaEducacional } from "@/core/lib/demografia-educacional";
import { getInepCensoMunicipalRecord, type InepCensoMunicipalRecord } from "@/core/lib/inep-censo";

const PAULO_AFONSO = "2924009";

function demografia(faixas: Partial<DemografiaEducacional["faixas"]> = {}): DemografiaEducacional {
  return {
    fonte: "IBGE",
    anoCenso: 2022,
    faixas: { creche: 1000, preEscola: 500, anosIniciais: 1200, anosFinais: 900, ...faixas },
    nascimentos: [],
    tendenciaNascimentosPct: null,
    maesAdolescentes: null,
  };
}

function censo(over: Partial<InepCensoMunicipalRecord> = {}): InepCensoMunicipalRecord {
  return {
    anoReferencia: 2025,
    codigoIBGE: "0000000",
    municipio: "Teste",
    uf: "BA",
    matriculasBasicaTotal: 0,
    matriculasMunicipaisTotal: 0,
    educacaoInfantilTotal: 0,
    educacaoInfantilMunicipal: 0,
    crecheTotal: 300,
    crecheMunicipal: 200,
    preEscolaTotal: 480,
    preEscolaMunicipal: 400,
    anosIniciaisFundamentalTotal: 1150,
    anosIniciaisFundamentalMunicipal: 900,
    anosFinaisFundamentalTotal: 880,
    anosFinaisFundamentalMunicipal: 700,
    docentesTotal: 0,
    docentesMunicipaisTotal: 0,
    escolasTotal: 0,
    escolasMunicipaisTotal: 0,
    ...over,
  };
}

describe("cobertura com os dois denominadores", () => {
  it("calcula rede municipal e todas as redes sobre a mesma população", () => {
    const [creche] = montarFaixas(demografia(), censo());

    expect(creche.populacao).toBe(1000);
    expect(creche.coberturaMunicipal).toBe(20);
    expect(creche.coberturaTotal).toBe(30);
  });

  /**
   * A distinção que sustenta a folha do sumário. Criança de 2 anos sem creche
   * é demanda não atendida; criança de 7 fora da escola é ilegalidade. Somar as
   * duas quintuplica o problema em Paulo Afonso — 5.428 contra 563 — e é o tipo
   * de exagero que o secretário desmonta em uma frase.
   */
  it("não trata creche como matrícula obrigatória", () => {
    const faixas = montarFaixas(demografia(), censo());
    const creche = faixas.find((f) => f.chave === "creche")!;
    const fundamental = faixas.find((f) => f.chave === "anosIniciais")!;

    expect(creche.obrigatoria).toBe(false);
    expect(fundamental.obrigatoria).toBe(true);
  });

  it("aplica a meta do PNE por faixa — 50% na creche, 100% no resto", () => {
    const faixas = montarFaixas(demografia(), censo());

    expect(faixas.find((f) => f.chave === "creche")!.metaPne).toBe(50);
    // 50% de 1.000 = 500; há 300 matriculados, faltam 200.
    expect(faixas.find((f) => f.chave === "creche")!.faltamParaMeta).toBe(200);
    expect(faixas.find((f) => f.chave === "preEscola")!.metaPne).toBe(100);
    expect(faixas.find((f) => f.chave === "preEscola")!.faltamParaMeta).toBe(20);
  });

  /**
   * Cobertura acima de 100% é rede que atrai aluno de município vizinho, não
   * erro de conta — e ali "fora da escola" não significa nada, porque o
   * numerador inclui quem mora fora do denominador.
   */
  it("não inventa criança fora da escola onde a rede atrai alunos de fora", () => {
    const [creche] = montarFaixas(demografia({ creche: 100 }), censo({ crecheTotal: 130 }));

    expect(creche.atraiDeFora).toBe(true);
    expect(creche.coberturaTotal).toBe(130);
    expect(creche.foraDaEscola).toBeNull();
    expect(creche.faltamParaMeta).toBe(0);
  });

  it("devolve lista vazia sem demografia ou sem Censo", () => {
    expect(montarFaixas(null, censo())).toEqual([]);
    expect(montarFaixas(demografia(), null)).toEqual([]);
  });

  it("não inclui faixa sem população no Censo", () => {
    const faixas = montarFaixas(demografia({ anosFinais: 0 }), censo());
    expect(faixas.map((f) => f.chave)).not.toContain("anosFinais");
  });
});

describe("calendário das coortes", () => {
  function coorte(ano: number, nascidos: number): CoorteNascimento {
    return {
      anoNascimento: ano,
      nascidos,
      chegaPreEscolaEm: ano + 4,
      chegaPrimeiroAnoEm: ano + 6,
    };
  }

  it("projeta o ano de chegada de cada coorte ao 1º ano", () => {
    const p = montarProjecao([coorte(2020, 100), coorte(2021, 90)]);

    expect(p.map((x) => x.ano)).toEqual([2026, 2027]);
    expect(p[0].chegamAoPrimeiroAno).toBe(100);
    expect(p[0].coorteDoPrimeiroAno).toBe(2020);
  });

  /**
   * A pré-escola de um ano são duas coortes. Somar só a que existe daria um
   * número pela metade com cara de completo — e completar a outra exigiria
   * projetar nascimento que ainda não aconteceu, que é outra disciplina.
   */
  it("só soma a pré-escola quando as duas coortes são conhecidas", () => {
    const p = montarProjecao([
      coorte(2020, 100),
      coorte(2021, 90),
      coorte(2022, 80),
      coorte(2023, 70),
    ]);
    const porAno = new Map(p.map((x) => [x.ano, x]));

    // Pré-escola de 2027 são as coortes de 2022 e 2023: as duas existem.
    expect(porAno.get(2027)!.naPreEscola).toBe(150);
    // A de 2029 precisaria de 2024 e 2025, que não estão na série.
    expect(porAno.get(2029)!.naPreEscola).toBeNull();
  });

  it("devolve lista vazia sem coorte", () => {
    expect(montarProjecao([])).toEqual([]);
  });
});

describe("a conta da creche", () => {
  it("monetiza a distância até a meta pelo fator da creche integral", () => {
    const faixa = montarFaixas(demografia(), censo()).find((f) => f.chave === "creche")!;
    const conta = montarContaDaCreche(faixa, "BA")!;

    expect(conta.matriculasAteMeta).toBe(200);
    expect(conta.fatorIntegral).toBe(1.55);
    expect(conta.equivalentes).toBeCloseTo(310, 5);
    expect(conta.valorDerivado).toBeCloseTo(310 * conta.valorPorEquivalente!, 2);
  });

  /** Rede que já alcançou a meta não gera cifra — gera resultado. */
  it("não produz valor onde a meta já foi alcançada", () => {
    const faixa = montarFaixas(demografia({ creche: 100 }), censo({ crecheTotal: 60 })).find(
      (f) => f.chave === "creche",
    )!;
    const conta = montarContaDaCreche(faixa, "BA")!;

    expect(conta.matriculasAteMeta).toBe(0);
    expect(conta.valorDerivado).toBe(0);

    const html = gerar({ creche: conta, faixas: [faixa] });
    expect(html).toContain("já está alcançada nesta rede");
    expect(html).not.toContain("R$ 0,00");
  });

  it("não monetiza sem a Portaria da UF", () => {
    const faixa = montarFaixas(demografia(), censo()).find((f) => f.chave === "creche")!;
    const conta = montarContaDaCreche(faixa, "ZZ")!;

    expect(conta.valorPorEquivalente).toBeNull();
    expect(conta.valorDerivado).toBeNull();
  });

  it("não monta conta de creche a partir de outra faixa", () => {
    const pre = montarFaixas(demografia(), censo()).find((f) => f.chave === "preEscola")!;
    expect(montarContaDaCreche(pre, "BA")).toBeNull();
  });
});

describe("HTML do Dossiê da Demanda", () => {
  it("imprime uma linha por coorte e uma por faixa", () => {
    const faixas = montarFaixas(demografia(), censo());
    const nascimentos = [
      { anoNascimento: 2020, nascidos: 100, chegaPreEscolaEm: 2024, chegaPrimeiroAnoEm: 2026 },
      { anoNascimento: 2021, nascidos: 90, chegaPreEscolaEm: 2025, chegaPrimeiroAnoEm: 2027 },
    ];
    const html = gerar({
      faixas,
      demografia: { ...demografia(), nascimentos, tendenciaNascimentosPct: -10 },
      projecao: montarProjecao(nascimentos),
    });

    expect(html.match(/<tr class="coorte">/g) ?? []).toHaveLength(2);
    expect(html.match(/<tr class="faixa">/g) ?? []).toHaveLength(faixas.length);
  });

  /**
   * O documento inteiro depende de o leitor entender que os dois números são de
   * naturezas diferentes. Se a folha parar de dizer isso, ela vira a
   * apresentação que ela existe para substituir.
   */
  it("declara que os dois números não podem ser somados", () => {
    const html = gerar({ faixas: montarFaixas(demografia(), censo()) });
    expect(html).toContain("não podem ser somados");
    expect(html).toContain("dever de oferta");
    expect(html).toContain("obrigatória");
  });

  it("não afirma resultado de cliente nem histórico de contratos", () => {
    const html = gerar({ faixas: montarFaixas(demografia(), censo()) });
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

describe("o Censo Escolar sustenta os denominadores reais", () => {
  it("traz matrícula por etapa nos dois recortes para um município real", () => {
    const c = getInepCensoMunicipalRecord(PAULO_AFONSO)!;

    expect(c.crecheMunicipal).toBeGreaterThan(0);
    expect(c.crecheTotal).toBeGreaterThanOrEqual(c.crecheMunicipal);
    expect(c.anosIniciaisFundamentalTotal!).toBeGreaterThanOrEqual(
      c.anosIniciaisFundamentalMunicipal!,
    );
  });
});

function gerar(over: Partial<DossieDemanda> = {}): string {
  const dossie: DossieDemanda = {
    municipio: "TESTE",
    uf: "BA",
    demografia: demografia(),
    censo: censo(),
    faixas: [],
    projecao: [],
    creche: null,
    buscaAtiva: null,
    rural: null,
    ausencias: [],
    resumo: {
      tendenciaNascimentos: null,
      populacaoEmIdadeEscolar: 3600,
      coberturaCrecheMunicipal: 20,
      coberturaCrecheTotal: 30,
      foraDaEscolaObrigatoria: 90,
      demandaCrecheNaoAtendida: 700,
      naoLocalizadosBolsaFamilia: null,
      proximaCoorte: null,
    },
    ...over,
  };

  return generateDossieDemandaHtml({
    municipio: dossie.municipio,
    uf: dossie.uf,
    codigoIbge: PAULO_AFONSO,
    dossie,
    geradoEm: new Date("2026-07-30T12:00:00.000Z"),
  });
}
