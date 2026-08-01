import { describe, expect, it } from "vitest";

import {
  analisarDispersao,
  distanciaKm,
  getPopulacaoRural,
  lerPopulacaoRural,
} from "@/core/lib/densidade-rede";
import type { EscolaTerritorio } from "@/core/lib/escolas-territorio";

function escola(
  parcial: Partial<EscolaTerritorio> & { codigo: string },
): EscolaTerritorio {
  return {
    rural: false,
    dif: 0,
    lat: null,
    lng: null,
    matriculas: null,
    transporte: null,
    racas: null,
    ...parcial,
  };
}

describe("distância de grande círculo", () => {
  it("mede a distância conhecida entre dois pontos", () => {
    // Manaus → Belém: ~1.290 km em linha reta. Tolerância de 15 km cobre a
    // escolha do raio médio da Terra.
    const km = distanciaKm(-3.119, -60.021, -1.455, -48.49);
    expect(km).toBeGreaterThan(1275);
    expect(km).toBeLessThan(1305);
  });

  it("devolve zero para o mesmo ponto", () => {
    expect(distanciaKm(-9.5, -37.2, -9.5, -37.2)).toBe(0);
  });
});

describe("dispersão da rede", () => {
  it("ancora o centro nas escolas urbanas e mede as rurais a partir dele", () => {
    // Duas urbanas coladas (centro ≈ -9.0/-37.0) e duas rurais afastadas.
    const r = analisarDispersao(
      [
        escola({ codigo: "u1", lat: -9.0, lng: -37.01, matriculas: 400 }),
        escola({ codigo: "u2", lat: -9.0, lng: -36.99, matriculas: 600 }),
        escola({ codigo: "r1", lat: -9.2, lng: -37.0, rural: true, matriculas: 100 }),
        escola({ codigo: "r2", lat: -9.4, lng: -37.0, rural: true, matriculas: 150 }),
      ],
      500,
    );

    expect(r).not.toBeNull();
    // ~22 km e ~44 km do centro → média ~33 km.
    expect(r!.mediaRuralKm).toBeGreaterThan(30);
    expect(r!.mediaRuralKm).toBeLessThan(36);
    // A mais distante é a rural do extremo sul, e leva a matrícula junto.
    expect(r!.maisDistante?.codigo).toBe("r2");
    expect(r!.maisDistante?.matriculas).toBe(150);
    // 4 escolas em 500 km² = 0,8 por 100 km².
    expect(r!.porCemKm2).toBe(0.8);
    expect(r!.escolasRuraisPct).toBe(50);
    // 250 de 1.250 matrículas em escola rural = 20%.
    expect(r!.matriculasRuraisPct).toBe(20);
  });

  it("mede a envergadura como o par mais distante, não como raio ao centro", () => {
    const r = analisarDispersao(
      [
        escola({ codigo: "a", lat: -9.0, lng: -37.0 }),
        escola({ codigo: "b", lat: -9.0, lng: -37.0 }),
        escola({ codigo: "c", lat: -10.0, lng: -37.0, rural: true }),
      ],
      null,
    );

    // a↔c é ~111 km; o raio ao centro urbano (que fica em a/b) é o mesmo aqui,
    // mas a envergadura precisa vir do par, não do centro.
    expect(r!.envergaduraKm).toBeGreaterThan(105);
    expect(r!.envergaduraKm).toBeLessThan(116);
  });

  it("cai para a média de todas quando nenhuma urbana tem coordenada", () => {
    const r = analisarDispersao(
      [
        escola({ codigo: "u", rural: false }), // urbana sem coordenada
        escola({ codigo: "r1", lat: -9.0, lng: -37.0, rural: true }),
        escola({ codigo: "r2", lat: -9.2, lng: -37.0, rural: true }),
      ],
      null,
    );

    expect(r!.centro).not.toBeNull();
    expect(r!.centro!.lat).toBeCloseTo(-9.1, 5);
    expect(r!.comCoordenada).toBe(2);
    // O total conta as três, inclusive a sem coordenada.
    expect(r!.total).toBe(3);
  });

  it("degrada sem área e sem coordenada em vez de inventar número", () => {
    const r = analisarDispersao([escola({ codigo: "x", rural: true })], null);

    expect(r!.porCemKm2).toBeNull();
    expect(r!.centro).toBeNull();
    expect(r!.mediaRuralKm).toBeNull();
    expect(r!.maisDistante).toBeNull();
    expect(r!.envergaduraKm).toBeNull();
    expect(r!.matriculasRuraisPct).toBeNull();
    // O que a fonte sustenta continua saindo.
    expect(r!.escolasRuraisPct).toBe(100);
  });

  it("devolve null para rede vazia", () => {
    expect(analisarDispersao([], 100)).toBeNull();
  });

  it("não conta área zero ou negativa como densidade", () => {
    expect(analisarDispersao([escola({ codigo: "x" })], 0)!.porCemKm2).toBeNull();
  });
});

/** Recorte real da resposta do agregado 10211 para Ibateguara/AL (2703007). */
const RESPOSTA_SIDRA = [
  {
    id: "93",
    variavel: "População residente",
    unidade: "Pessoas",
    resultados: [
      {
        classificacoes: [
          { id: "1", nome: "Situação do domicílio", categoria: { "1": "Urbana" } },
          { id: "2661", nome: "Localização do domicílio", categoria: { "32776": "Total" } },
        ],
        series: [
          {
            localidade: { id: "2703007", nivel: { id: "N6" }, nome: "Ibateguara (AL)" },
            serie: { "2022": "11397" },
          },
        ],
      },
      {
        classificacoes: [
          { id: "1", nome: "Situação do domicílio", categoria: { "2": "Rural" } },
          { id: "2661", nome: "Localização do domicílio", categoria: { "32776": "Total" } },
        ],
        series: [
          {
            localidade: { id: "2703007", nivel: { id: "N6" }, nome: "Ibateguara (AL)" },
            serie: { "2022": "2334" },
          },
        ],
      },
    ],
  },
];

describe("população rural (SIDRA 10211)", () => {
  it("separa urbana de rural pela chave da categoria e calcula a fatia", () => {
    const p = lerPopulacaoRural(RESPOSTA_SIDRA);

    expect(p).not.toBeNull();
    expect(p!.urbana).toBe(11397);
    expect(p!.rural).toBe(2334);
    expect(p!.total).toBe(13731);
    expect(p!.pctRural).toBe(17);
    expect(p!.ano).toBe(2022);
  });

  it("devolve null quando falta uma das situações", () => {
    const soUrbana = [
      { resultados: [RESPOSTA_SIDRA[0].resultados[0]] },
    ];
    expect(lerPopulacaoRural(soUrbana)).toBeNull();
  });

  // A versão anterior deste teste exigia que `"-"` virasse ausência, e isso
  // **fixava um defeito**: na notação do IBGE `"-"` é "dado numérico igual a
  // zero não resultante de arredondamento". Quem tem população rural zero — toda
  // capital, Recife entre elas — recebia `null` e a folha de densidade imprimia
  // "N/D" onde o número existe e é zero.
  it("lê o traço do SIDRA como zero, não como ausência", () => {
    const semRural = structuredClone(RESPOSTA_SIDRA);
    semRural[0].resultados[1].series[0].serie["2022"] = "-";

    const lido = lerPopulacaoRural(semRural);
    expect(lido).not.toBeNull();
    expect(lido?.rural).toBe(0);
    expect(lido?.urbana).toBe(11397);
    expect(lido?.total).toBe(11397);
    expect(lido?.pctRural).toBe(0);
  });

  it("trata os marcadores de indisponibilidade do SIDRA como ausência", () => {
    for (const marcador of ["...", "..", "x", "X", ""]) {
      const indisponivel = structuredClone(RESPOSTA_SIDRA);
      indisponivel[0].resultados[1].series[0].serie["2022"] = marcador;
      expect(lerPopulacaoRural(indisponivel), `marcador ${JSON.stringify(marcador)}`).toBeNull();
    }
  });

  it("ignora payload que não é a lista esperada", () => {
    expect(lerPopulacaoRural(null)).toBeNull();
    expect(lerPopulacaoRural({ erro: "boom" })).toBeNull();
  });

  it("recusa código IBGE inválido sem tocar a rede", async () => {
    let chamou = false;
    const fetcher = (async () => {
      chamou = true;
      return new Response("[]");
    }) as unknown as typeof fetch;

    expect(await getPopulacaoRural("123", fetcher)).toBeNull();
    expect(chamou).toBe(false);
  });

  it("degrada para null quando o IBGE responde erro", async () => {
    const fetcher = (async () =>
      new Response("erro", { status: 500 })) as unknown as typeof fetch;

    expect(await getPopulacaoRural("2703007", fetcher)).toBeNull();
  });

  it("percent-encoda colchetes e barra — cru o SIDRA devolve corpo vazio", async () => {
    let visto = "";
    const fetcher = (async (url: string) => {
      visto = String(url);
      return new Response(JSON.stringify(RESPOSTA_SIDRA));
    }) as unknown as typeof fetch;

    const p = await getPopulacaoRural("2703007", fetcher);

    expect(p!.pctRural).toBe(17);
    expect(visto).toContain("localidades=N6%5B2703007%5D");
    expect(visto).toContain("classificacao=1%5B1,2%5D%7C2661%5B32776%5D");
    expect(visto).not.toContain("N6[");
  });
});
