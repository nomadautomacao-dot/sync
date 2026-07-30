import { describe, expect, it } from "vitest";

import { compararIndicadores, montarDossieComparativo } from "@/core/lib/dossie-comparativo";
import { generateDossieComparativoHtml } from "@/core/lib/dossie-comparativo-template";
import { getMunicipiosGemeos, type IndicadorGemeos } from "@/core/lib/municipios-gemeos";

const PAULO_AFONSO = "2924009";
const SERRA_DO_RAMALHO = "2930758";
const MANAUS = "1302603";

function indicador(over: Partial<IndicadorGemeos> = {}): IndicadorGemeos {
  return {
    chave: "teste",
    rotulo: "Indicador de teste",
    unidade: "percentual",
    valor: 30,
    medianaPorte: 20,
    medianaUf: 22,
    percentil: 80,
    sentido: "maior-melhor",
    comparaveis: 80,
    grupo: "resultado",
    ...over,
  };
}

function comparar(over: Partial<IndicadorGemeos> = {}) {
  return compararIndicadores(
    { matriculas: 0, uf: "BA", faixaPorte: { minimo: 0, maximo: 0, tamanho: 80 }, coorteUf: 20, vaar: null, indicadores: [indicador(over)] },
    null,
    0,
    0,
  )[0];
}

describe("o sentido governa a leitura do percentil", () => {
  /**
   * A regra que impede o painel de inverter. Percentil 90 em abandono é
   * péssimo; percentil 90 em IDEB é ótimo. Colorir pelo número bruto produziria
   * uma folha bonita e errada.
   */
  it("percentil alto é bom onde maior é melhor e ruim onde menor é melhor", () => {
    expect(comparar({ percentil: 85, sentido: "maior-melhor" }).avaliacao).toBe("melhor");
    expect(comparar({ percentil: 85, sentido: "menor-melhor" }).avaliacao).toBe("pior");
    expect(comparar({ percentil: 15, sentido: "maior-melhor" }).avaliacao).toBe("pior");
    expect(comparar({ percentil: 15, sentido: "menor-melhor" }).avaliacao).toBe("melhor");
  });

  /** A régua é sempre orientada: 100 é o melhor lado, qualquer que seja o sentido. */
  it("orienta a posição para que 100 seja sempre o melhor lado", () => {
    expect(comparar({ percentil: 85, sentido: "maior-melhor" }).posicaoOrientada).toBe(85);
    expect(comparar({ percentil: 85, sentido: "menor-melhor" }).posicaoOrientada).toBe(15);
  });

  /** Indicador neutro nunca recebe cor de bom nem de ruim. */
  it("não julga indicador sem lado melhor", () => {
    for (const percentil of [5, 50, 95]) {
      const i = comparar({ percentil, sentido: "neutro" });
      expect(i.avaliacao).toBe("neutro");
      expect(i.posicaoOrientada).toBe(percentil);
      expect(i.leitura).toMatch(/sem lado melhor|não há lado/i);
    }
  });

  it("chama de típico quem está perto da mediana", () => {
    expect(comparar({ percentil: 50 }).avaliacao).toBe("tipico");
    expect(comparar({ percentil: 58 }).avaliacao).toBe("tipico");
    expect(comparar({ percentil: 42 }).avaliacao).toBe("tipico");
    expect(comparar({ percentil: 62 }).avaliacao).toBe("melhor");
  });

  /** Percentil sobre coorte rala é ruído com cara de estatística. */
  it("suprime a leitura quando há poucos pares", () => {
    const i = comparar({ comparaveis: 9 });
    expect(i.avaliacao).toBe("sem-leitura");
    expect(i.leitura).toMatch(/coorte rala/);
  });
});

describe("distâncias e conversões", () => {
  it("calcula a distância na unidade do indicador e em relativo", () => {
    const i = comparar({ valor: 30, medianaPorte: 20 });
    expect(i.distancia).toBe(10);
    expect(i.distanciaRelativa).toBe(50);
  });

  it("não divide por mediana zero", () => {
    expect(comparar({ valor: 5, medianaPorte: 0 }).distanciaRelativa).toBeNull();
  });

  /** Conversão que arredonda para zero não vira linha. */
  it("não converte distância que arredonda para nenhuma matrícula", () => {
    const i = compararIndicadores(
      {
        matriculas: 0,
        uf: "BA",
        faixaPorte: { minimo: 0, maximo: 0, tamanho: 80 },
        coorteUf: 20,
        vaar: null,
        indicadores: [indicador({ chave: "coberturaAee", valor: 20.01, medianaPorte: 20 })],
      },
      null,
      10,
      0,
    )[0];
    expect(i.distanciaEmMatriculas).toBeNull();
  });

  it("converte pontos percentuais em matrículas onde o denominador é conhecido", () => {
    const i = compararIndicadores(
      {
        matriculas: 0,
        uf: "BA",
        faixaPorte: { minimo: 0, maximo: 0, tamanho: 80 },
        coorteUf: 20,
        vaar: null,
        indicadores: [indicador({ chave: "coberturaAee", valor: 40, medianaPorte: 20 })],
      },
      null,
      500,
      0,
    )[0];
    expect(i.distanciaEmMatriculas).toEqual({
      quantidade: 100,
      base: "matrículas de educação especial",
    });
  });

  it("não converte indicador em reais nem em fator", () => {
    expect(comparar({ chave: "coberturaAee", unidade: "reais" }).distanciaEmMatriculas).toBeNull();
    expect(comparar({ chave: "coberturaAee", unidade: "fator" }).distanciaEmMatriculas).toBeNull();
  });
});

describe("parâmetro legal prevalece sobre a comparação", () => {
  /**
   * Regra 4 da spec: estar acima da mediana não significa estar em
   * conformidade — a mediana pode ser ilegal. Onde a lei fixa piso, ele
   * aparece junto.
   */
  it("anexa o parâmetro legal aos indicadores que têm um", () => {
    expect(comparar({ chave: "mde" }).parametroLegal).toMatch(/25%/);
    expect(comparar({ chave: "remuneracao70" }).parametroLegal).toMatch(/70%/);
    expect(comparar({ chave: "idebAnosIniciais" }).parametroLegal).toBeNull();
  });

  it("imprime o parâmetro no documento", () => {
    const html = gerar(MANAUS, "MANAUS", "AM");
    expect(html).toContain("Parâmetro legal, que prevalece sobre a comparação");
    expect(html).toContain("art. 212 da CF");
  });
});

describe("municípios reais", () => {
  it("compara pelo menos uma dúzia de indicadores nas redes com dado completo", () => {
    for (const codigo of [PAULO_AFONSO, SERRA_DO_RAMALHO, MANAUS]) {
      const d = montarDossieComparativo(codigo, "", "BA");
      expect(d.indicadores.length).toBeGreaterThanOrEqual(12);
      expect(d.gemeos!.faixaPorte.tamanho).toBeGreaterThan(50);
    }
  });

  /**
   * Serra do Ramalho gasta bem e entrega mal — MDE no percentil 82, remuneração
   * no 72, e resultado no fundo da coorte. É a leitura que só a comparação
   * produz, e é a conversa comercial inteira.
   */
  it("separa financiamento de resultado onde a rede diverge entre os dois", () => {
    const d = montarDossieComparativo(SERRA_DO_RAMALHO, "SERRA DO RAMALHO", "BA");
    const por = new Map(d.indicadores.map((i) => [i.chave, i]));

    expect(por.get("mde")!.avaliacao).toBe("melhor");
    expect(por.get("idebAnosFinais")!.avaliacao).toBe("pior");
    expect(d.resumo.piores).toBeGreaterThan(d.resumo.melhores);
  });

  it("agrupa os indicadores sem perder nenhum", () => {
    const d = montarDossieComparativo(MANAUS, "MANAUS", "AM");
    const somados = d.grupos.reduce((t, g) => t + g.indicadores.length, 0);
    expect(somados).toBe(d.indicadores.length);
  });

  it("elege no máximo três maiores distâncias, todas desfavoráveis", () => {
    const d = montarDossieComparativo(SERRA_DO_RAMALHO, "SERRA DO RAMALHO", "BA");
    expect(d.maioresDistancias.length).toBeLessThanOrEqual(3);
    for (const i of d.maioresDistancias) expect(i.avaliacao).toBe("pior");
  });

  it("devolve dossiê vazio onde o município não está na planilha do FNDE", () => {
    const d = montarDossieComparativo("0000000", "", "BA");
    expect(d.indicadores).toEqual([]);
    expect(d.ausencias.length).toBeGreaterThan(0);
  });
});

describe("HTML do Dossiê Comparativo", () => {
  it("imprime uma régua e um bloco por indicador", () => {
    const d = montarDossieComparativo(MANAUS, "MANAUS", "AM");
    const html = gerar(MANAUS, "MANAUS", "AM");

    expect(html.match(/<tr class="regua-linha">/g) ?? []).toHaveLength(d.indicadores.length);
    expect(html.match(/<article class="indicador /g) ?? []).toHaveLength(d.indicadores.length);
  });

  /** A lista de pares não é publicada — nomear cria atrito sem informar. */
  it("não nomeia os municípios da coorte", () => {
    const html = gerar(MANAUS, "MANAUS", "AM");
    expect(html).toContain("A lista dos pares não é publicada");
  });

  it("diz que mediana não é meta", () => {
    const html = gerar(SERRA_DO_RAMALHO, "SERRA DO RAMALHO", "BA");
    expect(html).toContain("Estar na mediana");
    expect(html).toContain("não é meta");
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

describe("a coorte", () => {
  it("é montada por porte de rede, e a faixa contém o município", () => {
    const g = getMunicipiosGemeos(PAULO_AFONSO)!;
    expect(g.matriculas).toBeGreaterThanOrEqual(g.faixaPorte.minimo);
    expect(g.matriculas).toBeLessThanOrEqual(g.faixaPorte.maximo);
  });
});

function gerar(codigo: string, nome: string, uf: string): string {
  return generateDossieComparativoHtml({
    municipio: nome,
    uf,
    codigoIbge: codigo,
    dossie: montarDossieComparativo(codigo, nome, uf),
    geradoEm: new Date("2026-07-30T12:00:00.000Z"),
  });
}
