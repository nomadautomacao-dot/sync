import { describe, expect, it } from "vitest";

import { lerJsonDeDados } from "@/core/lib/dados-arquivo";
import { getEquidadeMunicipal } from "@/core/lib/inep-equidade";

/**
 * O recorte de cor/raça é montado juntando duas tabelas dos microdados do INEP
 * por `CO_ENTIDADE` — a de matrícula, que não tem município, e a de escolas,
 * que não tem cor/raça. Uma junção errada não quebra nada: produz números
 * plausíveis e silenciosamente errados.
 *
 * A trava é a soma. As seis categorias de cor/raça particionam a matrícula, e
 * portanto têm de fechar exatamente com os totais que o dataset do Censo já
 * publica por outro caminho. Se o INEP mudar o layout ou a junção regredir,
 * este teste falha antes de o número entrar num PDF de cliente.
 */
const registros = lerJsonDeDados<Record<
  string,
  { matriculasMunicipaisTotal?: number; matriculasPublicasTotal?: number; municipio?: string }
>>("data/inep-censo-municipal-2025.json");

const AMOSTRA = [
  "2801207", // Canindé de São Francisco/SE — rede pequena, alta proporção parda
  "3136959", // Juvenília/MG — cadastro de cor/raça majoritariamente não declarado
  "3550308", // São Paulo/SP — maior rede municipal do país
  "1302603", // Manaus/AM — recorte indígena relevante
];

describe("equidade municipal do Censo Escolar", () => {
  it.each(AMOSTRA)("as categorias de cor/raça fecham com os totais do Censo em %s", (codigo) => {
    const equidade = getEquidadeMunicipal(codigo);
    const censo = registros[codigo];

    expect(equidade, `município ${codigo} ausente no dataset de equidade`).not.toBeNull();
    expect(censo, `município ${codigo} ausente no dataset do Censo`).toBeDefined();

    const somaCategorias = (rede: NonNullable<typeof equidade>["municipal"]) =>
      rede.branca + rede.preta + rede.parda + rede.amarela + rede.indigena + rede.naoDeclarada;

    expect(somaCategorias(equidade!.municipal)).toBe(equidade!.municipal.total);
    expect(somaCategorias(equidade!.publica)).toBe(equidade!.publica.total);

    expect(equidade!.municipal.total).toBe(censo.matriculasMunicipaisTotal);
    expect(equidade!.publica.total).toBe(censo.matriculasPublicasTotal);
  });

  it("a rede municipal nunca excede a rede pública", () => {
    for (const codigo of AMOSTRA) {
      const equidade = getEquidadeMunicipal(codigo)!;
      expect(equidade.municipal.total).toBeLessThanOrEqual(equidade.publica.total);
    }
  });

  it("marca cadastro frágil quando a não declaração passa de um terço", () => {
    // Juvenília declara 73% da rede sem cor/raça. Sem esta marcação o relatório
    // apresentaria 23,7% de matrícula negra como se fosse a composição real.
    const juvenilia = getEquidadeMunicipal("3136959")!;
    expect(juvenilia.naoDeclaradaPct).toBeGreaterThan(33);
    expect(juvenilia.cadastroFragil).toBe(true);

    const saoPaulo = getEquidadeMunicipal("3550308")!;
    expect(saoPaulo.cadastroFragil).toBe(false);
  });

  it("devolve null para código inexistente em vez de lançar", () => {
    expect(getEquidadeMunicipal("0000000")).toBeNull();
    expect(getEquidadeMunicipal("")).toBeNull();
  });
});
