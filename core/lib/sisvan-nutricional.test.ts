import { describe, expect, it } from "vitest";

import {
  getEstadoNutricional,
  lerEstadoNutricional,
  montarConsulta,
} from "@/core/lib/sisvan-nutricional";

/**
 * Recorte real da resposta do SISVAN para Ibateguara/AL em 2024 (5 a 10 anos,
 * IMC × idade). Mantido fiel ao formato da fonte: milhar com ponto, decimal
 * com ponto no percentual, e as linhas de total que ela devolve de brinde.
 */
const HTML = `<table><tbody>
<tr><td>NORDESTE</td><td>27</td><td>AL</td><td>270300</td><td>IBATEGUARA</td>
<td>22</td><td>3.2%</td><td>26</td><td>3.78%</td><td>466</td><td>67.73%</td>
<td>91</td><td>13.23%</td><td>53</td><td>7.7%</td><td>30</td><td>4.36%</td><td>688</td></tr>
<tr><td>TOTAL ESTADO ALAGOAS</td><td>2.487</td><td>1.8%</td><td>5.054</td><td>3.65%</td>
<td>90.309</td><td>65.29%</td><td>19.994</td><td>14.45%</td><td>12.428</td><td>8.98%</td>
<td>8.048</td><td>5.82%</td><td>138.320</td></tr>
<tr><td>2</td><td>TOTAL REGIÃO NORDESTE</td><td>48.151</td><td>2.27%</td><td>83.331</td><td>3.92%</td>
<td>1.351.725</td><td>63.61%</td><td>316.192</td><td>14.88%</td><td>194.079</td><td>9.13%</td>
<td>131.598</td><td>6.19%</td><td>2.125.076</td></tr>
<tr><td>TOTAL BRASIL</td><td>109.592</td><td>1.67%</td><td>214.359</td><td>3.26%</td>
<td>4.289.647</td><td>65.28%</td><td>995.989</td><td>15.16%</td><td>588.742</td><td>8.96%</td>
<td>373.144</td><td>5.68%</td><td>6.571.473</td></tr>
</tbody></table>`;

describe("leitura do estado nutricional (SISVAN)", () => {
  it("extrai as seis categorias e o total do município", () => {
    const r = lerEstadoNutricional(HTML, "270300", 2024);

    expect(r).not.toBeNull();
    expect(r!.municipio.magrezaAcentuada).toBe(22);
    expect(r!.municipio.magreza).toBe(26);
    expect(r!.municipio.eutrofia).toBe(466);
    expect(r!.municipio.sobrepeso).toBe(91);
    expect(r!.municipio.obesidade).toBe(53);
    expect(r!.municipio.obesidadeGrave).toBe(30);
    expect(r!.municipio.total).toBe(688);
  });

  /**
   * O achado que a página vende: excesso de peso é a soma de três colunas, e
   * ninguém soma na hora da reunião. Em Ibateguara dá um quarto das crianças.
   */
  it("soma sobrepeso, obesidade e obesidade grave em excesso de peso", () => {
    const r = lerEstadoNutricional(HTML, "270300", 2024)!;

    // (91 + 53 + 30) / 688 = 25,3%
    expect(r.municipio.excessoPesoPct).toBe(25.3);
    // (22 + 26) / 688 = 7,0%
    expect(r.municipio.magrezaPct).toBe(7);
    expect(r.municipio.eutrofiaPct).toBe(67.7);
  });

  it("lê as três réguas que a fonte devolve junto", () => {
    const r = lerEstadoNutricional(HTML, "270300", 2024)!;

    expect(r.estado?.total).toBe(138_320);
    expect(r.regiao?.total).toBe(2_125_076);
    expect(r.brasil?.total).toBe(6_571_473);
    // Brasil: (995.989 + 588.742 + 373.144) / 6.571.473 = 29,8%
    expect(r.brasil?.excessoPesoPct).toBe(29.8);
  });

  it("interpreta milhar com ponto sem virar número errado", () => {
    const r = lerEstadoNutricional(HTML, "270300", 2024)!;
    // "1.351.725" tem de virar 1351725, não 1.351725.
    expect(r.regiao?.eutrofia).toBe(1_351_725);
  });

  it("localiza o município pelo código, não pela posição da linha", () => {
    const invertido = HTML.replace(
      /(<tr><td>NORDESTE[\s\S]*?<\/tr>)([\s\S]*?)(<\/tbody>)/,
      "$2$1$3",
    );
    const r = lerEstadoNutricional(invertido, "270300", 2024);

    expect(r?.municipio.total).toBe(688);
  });

  it("devolve null quando o município não aparece — régua sozinha não é página", () => {
    expect(lerEstadoNutricional(HTML, "999999", 2024)).toBeNull();
  });

  it("devolve null para a tabela vazia que a fonte manda com HTTP 200", () => {
    expect(lerEstadoNutricional("<table><tbody></tbody></table>", "270300", 2024)).toBeNull();
  });
});

describe("consulta ao SISVAN", () => {
  /**
   * Estes quatro campos parecem supérfluos numa consulta de criança e foram a
   * causa de seis tentativas devolverem tabela vazia com HTTP 200. Se alguém
   * "limpar" o payload, o teste avisa antes do relatório sair mudo.
   */
  it("mantém os campos sem os quais a fonte devolve tabela vazia", () => {
    const corpo = montarConsulta("270300", 2024);

    expect(corpo).toContain("CO_ESCOLARIDADE=TODOS");
    expect(corpo).toContain("CO_POVO_COMUNIDADE=TODOS");
    expect(corpo).toContain("nu_indice_ado=1");
    expect(corpo).toContain("nu_idade_ges=99");
  });

  it("pede a faixa escolar pelo índice de IMC por idade", () => {
    const corpo = montarConsulta("270300", 2024);

    expect(corpo).toContain("nu_ciclo_vida=1");
    expect(corpo).toContain("nu_idade_inicio=5");
    expect(corpo).toContain("nu_idade_fim=10");
    expect(corpo).toContain("nu_indice_cri=4");
  });

  it("deriva a UF do próprio código do município", () => {
    expect(montarConsulta("130260", 2024)).toContain("coUfIbge=13");
  });

  it("corta o dígito verificador — o SISVAN usa 6 dígitos, não 7", async () => {
    let visto = "";
    const fetcher = (async (_u: string, init: RequestInit) => {
      visto = String(init.body);
      return new Response(HTML);
    }) as unknown as typeof fetch;

    await getEstadoNutricional("2703007", 2024, fetcher);

    expect(visto).toContain("coMunicipioIbge=270300");
    expect(visto).not.toContain("2703007");
  });

  it("recusa código inválido sem tocar a rede", async () => {
    let chamou = false;
    const fetcher = (async () => {
      chamou = true;
      return new Response(HTML);
    }) as unknown as typeof fetch;

    expect(await getEstadoNutricional("123", 2024, fetcher)).toBeNull();
    expect(chamou).toBe(false);
  });

  it("degrada para null quando a fonte responde erro", async () => {
    const fetcher = (async () =>
      new Response("erro", { status: 500 })) as unknown as typeof fetch;

    expect(await getEstadoNutricional("2703007", 2024, fetcher)).toBeNull();
  });
});
