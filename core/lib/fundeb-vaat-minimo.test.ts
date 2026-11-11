import { describe, expect, it } from "vitest";

import { getFundebVaatContext, vaatMinimoNacional } from "./fundeb-fnde";
import { pibPorHabitante } from "./ibge-cidade-indicators";
import { lerJsonDeDados } from "./dados-arquivo";
import { ufDe, type Municipality } from "./report-visual-theme";

/**
 * Três erros de dado achados conferindo o Levantamento de Senador Canedo/GO
 * contra as fontes, em 2026-11-11. Nenhum quebrava a emissão: os três saíam
 * impressos com cara de dado oficial.
 */
describe("VAAT-MIN é um só para o país", () => {
  const linha = (vaatAnterior: number, vaatComComplementacao: number, complementacaoVAAT: number) => ({
    codigoIBGE: "", uf: "", ente: "", vaatAnterior, vaatComComplementacao, complementacaoVAAT, ieiPercentual: null,
  });

  it("sai de quem recebe complementação, não da coluna de quem não recebe", () => {
    const tabela = new Map([
      ["1", linha(7_764.61, 10_192.38, 26_041_658.3)],
      ["2", linha(9_000, 10_192.38, 1_000_000)],
      // Fora da faixa: a coluna "com complementação" repete o VAAT próprio.
      ["3", linha(10_511.38, 10_511.38, 0)],
      ["4", linha(25_000, 25_000, 0)],
    ]);

    expect(vaatMinimoNacional(tabela)).toBe(10_192.38);
  });

  it("devolve nulo, e não um palpite, quando ninguém recebe", () => {
    expect(vaatMinimoNacional(new Map([["3", linha(10_511.38, 10_511.38, 0)]]))).toBeNull();
  });

  it("dá o mesmo mínimo a quem recebe e a quem está fora da faixa", async () => {
    const [canedo, ramalho] = await Promise.all([
      getFundebVaatContext("5220454", 2026),
      getFundebVaatContext("2930154", 2026),
    ]);

    // Senador Canedo não recebe e saía com "VAAT-MIN R$ 10.511,38" — o próprio VAAT.
    expect(canedo?.complementacaoVAAT).toBe(0);
    expect(canedo?.vaatAnterior).toBe(10_511.38);
    expect(canedo?.vaatMinimo).toBe(10_192.38);
    expect(ramalho?.vaatMinimo).toBe(canedo?.vaatMinimo);
  });
});

describe("PIB per capita usa a população do ano do PIB", () => {
  it("reproduz o número oficial de Senador Canedo em 2023", () => {
    // PIB 2023 (SIDRA 5938) sobre a população do Censo 2022, como faz o IBGE.
    expect(pibPorHabitante(5_495_055, 155_635)).toBe(35_307.32);
    // O que saía: o mesmo PIB sobre a estimativa de 2026.
    expect(pibPorHabitante(5_495_055, 180_111)).not.toBe(35_307.32);
  });

  it("prefere ausência a um número com denominador errado", () => {
    expect(pibPorHabitante(5_495_055, null)).toBeNull();
    expect(pibPorHabitante(5_495_055, 0)).toBeNull();
  });
});

describe("UF do município no catálogo do IBGE", () => {
  it("resolve a UF de município sem microrregião", () => {
    const semMicro: Municipality = {
      id: 5101837, nome: "Boa Esperança do Norte", microrregiao: null,
      "regiao-imediata": { "regiao-intermediaria": { UF: { sigla: "MT" } } },
    };

    expect(ufDe(semMicro)).toBe("MT");
  });

  it("não lança em nenhuma linha do catálogo", () => {
    // Uma linha sem microrregião lançava dentro da busca e derrubava a capa de
    // todo município de código maior: resto de MT, Goiás inteiro e o DF.
    const { municipios } = lerJsonDeDados<{ municipios: Municipality[] }>("data/ibge/municipios.json");
    const ufs = municipios.map(ufDe);

    expect(ufs.every((uf) => /^[A-Z]{2}$/.test(uf))).toBe(true);
    expect(ufDe(municipios.find((m) => m.id === 5220454)!)).toBe("GO");
  });
});
