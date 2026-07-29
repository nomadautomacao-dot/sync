import { describe, expect, it } from "vitest";
import {
  generateCensoHistoricoHtml,
  mapCensoHistoricoModel,
} from "./censo-historico-template";
import type { InepCensoMunicipalRecord } from "./inep-censo";
import type { CorRacaHistorico } from "./cor-raca-historico";

/**
 * Fixture com três Censos de um município fictício em queda de matrícula:
 * rede municipal 10.000 → 9.500 → 9.200 (-8%), creche subindo, tempo
 * integral caindo e um item de infraestrutura recuando — o suficiente para
 * exercitar todos os sinais automáticos.
 */
function censo(ano: number, sobrescreve: Partial<InepCensoMunicipalRecord> = {}): InepCensoMunicipalRecord {
  return {
    anoReferencia: ano,
    codigoIBGE: "9900001",
    municipio: "Rio Modelo",
    uf: "Amazonas",
    matriculasBasicaTotal: 20000,
    matriculasPublicasTotal: 17000,
    matriculasMunicipaisTotal: 10000,
    educacaoInfantilTotal: 4000,
    educacaoInfantilMunicipal: 3500,
    crecheTotal: 1200,
    crecheMunicipal: 1000,
    preEscolaTotal: 2800,
    preEscolaMunicipal: 2500,
    anosIniciaisFundamentalTotal: 8000,
    anosIniciaisFundamentalMunicipal: 5000,
    anosFinaisFundamentalTotal: 6000,
    anosFinaisFundamentalMunicipal: 1200,
    ensinoFundamentalTotal: 14000,
    ensinoFundamentalMunicipal: 6200,
    ejaTotal: 900,
    ejaMunicipal: 400,
    educacaoEspecialTotal: 700,
    educacaoEspecialMunicipal: 450,
    docentesTotal: 1200,
    docentesMunicipaisTotal: 600,
    escolasTotal: 90,
    escolasMunicipaisTotal: 50,
    tempoIntegralBasicaTotal: 3000,
    tempoIntegralBasicaMunicipal: 2000,
    tempoIntegralCrecheMunicipal: 500,
    tempoIntegralPreEscolaMunicipal: 300,
    tempoIntegralAnosIniciaisMunicipal: 900,
    tempoIntegralAnosFinaisMunicipal: 200,
    tempoIntegralEjaMunicipal: 20,
    tempoIntegralEducacaoEspecialMunicipal: 80,
    escolasInfraPublicasTotal: 70,
    escolasComAguaPotavelPct: 95,
    escolasComEsgotoPct: 40,
    escolasComCozinhaPct: 90,
    escolasComAlimentacaoPct: 98,
    escolasComInternetPct: 80,
    escolasComBandaLargaPct: 60,
    escolasComLaboratorioInformaticaPct: 30,
    escolasComLaboratorioCienciasPct: 10,
    escolasComQuadraPct: 45,
    escolasComAcessibilidadePct: 55,
    ...sobrescreve,
  };
}

const registros = [
  censo(2023),
  censo(2024, {
    matriculasMunicipaisTotal: 9500,
    crecheMunicipal: 1100,
    tempoIntegralBasicaMunicipal: 1800,
    ejaMunicipal: 350,
    escolasComInternetPct: 78,
  }),
  censo(2025, {
    matriculasMunicipaisTotal: 9200,
    crecheMunicipal: 1200,
    tempoIntegralBasicaMunicipal: 1600,
    ejaMunicipal: 300,
    escolasComInternetPct: 72,
  }),
];

const model = mapCensoHistoricoModel({
  records: registros,
  generatedAt: new Date("2026-07-29T12:00:00Z"),
});
const html = generateCensoHistoricoHtml(model);

describe("mapCensoHistoricoModel", () => {
  it("usa os três últimos anos em ordem crescente e herda a identidade do mais recente", () => {
    const comQuatro = mapCensoHistoricoModel({
      records: [censo(2022, { matriculasMunicipaisTotal: 11000 }), ...registros],
    });
    expect(comQuatro.years.map((r) => r.anoReferencia)).toEqual([2023, 2024, 2025]);
    expect(comQuatro.municipality).toBe("Rio Modelo");
    expect(comQuatro.uf).toBe("Amazonas");
    expect(comQuatro.ibgeCode).toBe("9900001");
  });

  it("recusa série com menos de dois anos", () => {
    expect(() => mapCensoHistoricoModel({ records: [censo(2025)] })).toThrow(/dois anos/);
  });

  it("aceita dois anos quando o terceiro não existe", () => {
    const doisAnos = mapCensoHistoricoModel({ records: registros.slice(0, 2) });
    expect(doisAnos.years).toHaveLength(2);
    const htmlDois = generateCensoHistoricoHtml(doisAnos);
    expect(htmlDois.match(/section class="page/g)).toHaveLength(11);
  });

  it("alinha a série de cor/raça aos anos exibidos, descartando o excedente", () => {
    const corRaca: CorRacaHistorico = {
      geradoEm: "2026-07-29",
      municipal: [2022, 2023, 2024, 2025].map((ano) => ({
        ano, total: 100, naoDeclarada: 10, branca: 20, preta: 5, parda: 60, amarela: 1, indigena: 4,
      })),
      publica: [],
    };
    const model2 = mapCensoHistoricoModel({ records: registros, corRaca });
    expect(model2.race?.municipal.map((a) => a.ano)).toEqual([2023, 2024, 2025]);
  });
});

describe("generateCensoHistoricoHtml", () => {
  it("gera exatamente 11 páginas, numeradas em sequência", () => {
    expect(html.match(/section class="page/g)).toHaveLength(11);
    const rodapes = [...html.matchAll(/<span>(\d+)<\/span><\/footer>/g)].map((m) => Number(m[1]));
    expect(rodapes).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("imprime a fonte e os anos em todos os rodapés — sinopses no geral, microdados na página de cor/raça", () => {
    const rodapesFonte = html.match(/Censo Escolar da Educação Básica\/INEP — sinopses estatísticas 2023, 2024, 2025/g);
    expect(rodapesFonte).toHaveLength(9);
    expect(html).toContain("INEP — microdados do Censo Escolar");
  });

  it("mostra as três colunas de ano e a variação no cabeçalho das tabelas", () => {
    expect(html).toContain("<th class=\"num\">2023</th>");
    expect(html).toContain("<th class=\"num\">2025</th>");
    expect(html).toContain("Δ 2023→2025");
  });

  it("calcula a variação da rede municipal com sinal e formato pt-BR", () => {
    // 10.000 → 9.200 = -800 (-8,0%)
    expect(html).toContain("-800 (-8,0%)");
    expect(html).toContain("9.200");
  });

  it("aciona o sinal de encolhimento da rede com a leitura FUNDEB", () => {
    expect(html).toContain("A rede municipal encolheu 8,0% entre 2023 e 2025.");
    expect(html).toContain("denominador da receita do FUNDEB");
  });

  it("reconhece a creche em alta como a matrícula de maior fator", () => {
    // 1.000 → 1.200 = +20%
    expect(html).toContain("A creche municipal cresceu 20,0% no período.");
    expect(html).toContain("1,55");
  });

  it("aciona o alerta de tempo integral em queda", () => {
    // 2.000 → 1.600 = -20%
    expect(html).toContain("O tempo integral municipal recuou 20,0%.");
  });

  it("transforma as quedas em perguntas de campo com o dado embutido", () => {
    expect(html).toContain("perdeu 800 matrículas entre 2023 e 2025");
    expect(html).toContain("A EJA municipal caiu 100 matrículas no período.");
    expect(html).toContain("Educacenso");
  });

  it("mostra a série de infraestrutura em pontos percentuais", () => {
    // internet 80% → 72% = -8,0 p.p.
    expect(html).toContain("-8,0 p.p.");
    expect(html).toContain("Internet");
  });

  it("marca N/D quando um ano não publicou o dado, sem inventar variação", () => {
    const comLacuna = mapCensoHistoricoModel({
      records: [
        censo(2023, { ejaMunicipal: undefined }),
        censo(2024),
        censo(2025, { ejaMunicipal: undefined }),
      ],
    });
    const htmlLacuna = generateCensoHistoricoHtml(comLacuna);
    expect(htmlLacuna).toContain("N/D");
    // Sem primeiro e último ano, a variação da linha vira travessão.
    expect(htmlLacuna).toContain(`<span class="neutral">—</span>`);
  });

  it("estabilidade também é leitura: sem movimento brusco, diz isso", () => {
    const estavel = mapCensoHistoricoModel({ records: [censo(2023), censo(2024), censo(2025)] });
    const htmlEstavel = generateCensoHistoricoHtml(estavel);
    expect(htmlEstavel).toContain("sem movimento brusco");
  });
});

describe("cor/raça em série", () => {
  function corRacaAno(ano: number, naoDeclarada: number): CorRacaHistorico["municipal"][number] {
    // total fixo em 1.000 para os percentuais saírem redondos no teste.
    const parda = 600;
    const preta = 50;
    const branca = 1000 - naoDeclarada - parda - preta - 10 - 40;
    return { ano, total: 1000, naoDeclarada, branca, preta, parda, amarela: 10, indigena: 40 };
  }

  it("imprime a série em % com Δ em pontos e o recorte negra destacado", () => {
    const comRaca = mapCensoHistoricoModel({
      records: registros,
      corRaca: {
        geradoEm: "2026-07-29",
        municipal: [corRacaAno(2023, 200), corRacaAno(2024, 150), corRacaAno(2025, 100)],
        publica: [],
      },
    });
    const saida = generateCensoHistoricoHtml(comRaca);
    expect(saida).toContain("Para quem a rede ensina");
    // negra = (50+600)/1000 = 65%
    expect(saida).toContain("65,0%");
    // não declarada caiu 20% → 10%: queda de 10 p.p. e leitura de coleta melhorando
    expect(saida).toContain("-10,0 p.p.");
    expect(saida).toContain("coleta melhorando");
    expect(saida).toContain("Condicionalidade III");
  });

  it("não declarada alta vira alerta que liga cadastro à Cond. III", () => {
    const comNdAlta = mapCensoHistoricoModel({
      records: registros,
      corRaca: {
        geradoEm: "2026-07-29",
        municipal: [corRacaAno(2023, 180), corRacaAno(2024, 190), corRacaAno(2025, 200)],
        publica: [],
      },
    });
    const saida = generateCensoHistoricoHtml(comNdAlta);
    expect(saida).toContain("sem declaração de cor/raça em 2025");
    expect(saida).toContain("Educacenso");
  });

  it("sem o dataset, a página degrada sem estimar", () => {
    const saida = generateCensoHistoricoHtml(mapCensoHistoricoModel({ records: registros }));
    expect(saida).toContain("Série de cor/raça indisponível");
    expect(saida).toContain("Nenhum valor é estimado");
  });
});
