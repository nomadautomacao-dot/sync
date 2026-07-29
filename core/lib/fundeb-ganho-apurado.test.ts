import { describe, expect, it } from "vitest";

import valorAluno from "@/data/fnde/valor-aluno-ano-2026.json";
import { getGanhoApurado } from "@/core/lib/fundeb-ganho-apurado";
import { getPonderacaoMunicipal } from "@/core/lib/fundeb-ponderacao";
import { getSituacaoVaar } from "@/core/lib/fundeb-vaar";

/**
 * Este módulo substituiu o KPI "Já evidenciado", que exibia
 * `VAAF × 1,40 + VAAT × 1,30 + VAAR × 1,25` — multiplicadores fixos iguais para
 * todo município do país, apresentados ao gestor como valor comprovado.
 *
 * As travas aqui existem para que a substituição não repita o defeito por outro
 * caminho. Um número inflado com fonte plausível é pior que um número inflado
 * sem fonte, porque sobrevive mais tempo antes de ser contestado.
 */
const tabela = valorAluno as Record<string, Record<string, number>>;

describe("preço da matrícula-equivalente", () => {
  it("é o valor aluno/ano do segmento de fator 1,00", () => {
    // O art. 7º, §1º da Lei 14.113/2020 fixa anos iniciais urbano parcial como
    // a unidade. Se a monetização usasse outro segmento, todo valor sairia
    // multiplicado por um fator a mais.
    for (const uf of ["BA", "SE", "SP"]) {
      const g = getGanhoApurado("2930154", uf);
      expect(g, `UF ${uf}`).not.toBeNull();
      expect(g!.valorPorEquivalente).toBe(tabela[uf].fundamentalParcialAnosIniciais);
    }
  });

  it("a tabela oficial reproduz os fatores de ponderação", () => {
    // A identidade que autoriza monetizar equivalentes ao valor do segmento
    // base: cada segmento vale exatamente base × fator. Se a Portaria mudar de
    // estrutura, isto quebra antes de o número virar argumento comercial.
    for (const uf of ["BA", "SE", "SP", "GO", "RJ"]) {
      const base = tabela[uf].fundamentalParcialAnosIniciais;
      expect(tabela[uf].crecheParcialPublica / base, `creche parcial ${uf}`).toBeCloseTo(1.25, 4);
      expect(tabela[uf].crecheIntegralPublica / base, `creche integral ${uf}`).toBeCloseTo(1.55, 4);
      expect(tabela[uf].atendimentoEspecializado / base, `AEE ${uf}`).toBeCloseTo(1.4, 4);
      expect(tabela[uf].eja / base, `EJA ${uf}`).toBeCloseTo(1.0, 4);
    }
  });

  it("devolve null quando não há preço para a UF", () => {
    expect(getGanhoApurado("2930154", "XX")).toBeNull();
    expect(getGanhoApurado("2930154", "")).toBeNull();
  });
});

describe("composição do total", () => {
  const AMOSTRA = [
    ["2930154", "BA"],
    ["2801207", "SE"],
    ["3550308", "SP"],
    ["3304557", "RJ"],
    ["5208707", "GO"],
  ] as const;

  it("soma apenas o que é apurado sobre o dado do próprio município", () => {
    for (const [codigo, uf] of AMOSTRA) {
      const g = getGanhoApurado(codigo, uf)!;
      const soma = g.componentes.reduce((total, c) => total + c.valor, 0);

      expect(g.total, `município ${codigo}`).toBeCloseTo(soma, 2);
      expect(g.componentes.every((c) => c.certeza === "apurado")).toBe(true);
    }
  });

  it("nunca soma referência de terceiros ao total", () => {
    // A mediana do VAAR é o valor que **outros** municípios receberam. Somá-la
    // ao apurado seria reintroduzir exatamente a mistura de naturezas que
    // produziu o "Já evidenciado".
    const g = getGanhoApurado("2930154", "BA")!;
    expect(g.referencias.length).toBeGreaterThan(0);
    expect(g.referencias.every((r) => r.certeza === "referencia")).toBe(true);

    const somaReferencias = g.referencias.reduce((t, r) => t + r.valor, 0);
    expect(somaReferencias).toBeGreaterThan(0);
    expect(g.total).toBeLessThan(g.total + somaReferencias);
  });

  it("toda parcela declara origem e o que conferir", () => {
    for (const [codigo, uf] of AMOSTRA) {
      const g = getGanhoApurado(codigo, uf)!;
      for (const c of [...g.componentes, ...g.referencias]) {
        expect(c.origem.length, `${codigo} · ${c.chave}`).toBeGreaterThan(40);
        expect(c.conferir.length, `${codigo} · ${c.chave}`).toBeGreaterThan(40);
      }
    }
  });

  it("não oferece o VAAR quando a reprovação é do estado", () => {
    // Res. CIF 15/2025, art. 3º, §2º: Cond. IV reprovada em toda a UF é
    // reprovação do estado. Vender a recuperação seria vender solução para
    // problema que nenhuma ação municipal resolve.
    const rio = getSituacaoVaar("3300100")!;
    expect(rio.condIVEstadual).toBe(true);

    const g = getGanhoApurado("3300100", "RJ")!;
    expect(g.referencias.some((r) => r.chave === "vaar")).toBe(false);
  });
});

describe("ancoragem na mediana, não no teto", () => {
  it("o valor monetizado nunca alcança o teto teórico", () => {
    // Pelo teto, o AEE de São Paulo sozinho dava R$ 173,9 milhões — a conta
    // supunha AEE devido para todo aluno de educação especial, quando só 17%
    // das redes do país declaram cobertura integral.
    const p = getPonderacaoMunicipal("3550308")!;
    const g = getGanhoApurado("3550308", "SP")!;

    for (const o of p.oportunidades) {
      expect(o.ganhoEquivalentesMediana, `oportunidade ${o.chave}`).toBeLessThanOrEqual(o.ganhoEquivalentes);
    }

    const teto = p.oportunidades.reduce((t, o) => t + o.ganhoEquivalentes * g.valorPorEquivalente, 0);
    expect(g.total).toBeLessThan(teto);
  });

  it("município na mediana ou acima não recebe valor inventado", () => {
    // Goiânia declara creche e AEE no nível da mediana nacional ou acima. O
    // resultado honesto é zero, e zero precisa ser um resultado possível — se
    // todo município tivesse ganho, o número não estaria medindo nada.
    const g = getGanhoApurado("5208707", "GO")!;
    expect(g.total).toBe(0);
    expect(g.componentes).toHaveLength(0);
  });

  it("a distância até a mediana nunca excede a matrícula que existe", () => {
    for (const codigo of ["2930154", "2801207", "3550308", "3304557", "1302603"]) {
      const p = getPonderacaoMunicipal(codigo);
      if (!p) continue;

      for (const o of p.oportunidades) {
        expect(o.matriculasAteMediana, `${codigo} · ${o.chave}`).toBeGreaterThanOrEqual(0);
        expect(o.matriculasAteMediana, `${codigo} · ${o.chave}`).toBeLessThanOrEqual(o.matriculas);
      }
    }
  });

  it("as medianas ficam na faixa que a distribuição nacional sustenta", () => {
    // Medidas sobre o dataset: creche integral 68,5% e cobertura de AEE 54,3%.
    // Uma regressão na derivação (padrão de segmento que deixa de casar, por
    // exemplo) empurraria as duas para zero e inflaria a lacuna de todo mundo.
    const p = getPonderacaoMunicipal("2801207")!;
    for (const o of p.oportunidades) {
      expect(o.mediana, `oportunidade ${o.chave}`).toBeGreaterThan(0.3);
      expect(o.mediana, `oportunidade ${o.chave}`).toBeLessThan(0.95);
      expect(o.indicador).toBeGreaterThanOrEqual(0);
      expect(o.indicador).toBeLessThanOrEqual(1);
    }
  });
});

describe("percentual sobre a receita", () => {
  it("só é calculado quando a receita é informada", () => {
    expect(getGanhoApurado("2930154", "BA")!.percentualSobreReceita).toBeNull();
    expect(getGanhoApurado("2930154", "BA", 0)!.percentualSobreReceita).toBeNull();

    const g = getGanhoApurado("2930154", "BA", 37_000_000)!;
    expect(g.percentualSobreReceita).toBeCloseTo((g.total / 37_000_000) * 100, 6);
  });
});
