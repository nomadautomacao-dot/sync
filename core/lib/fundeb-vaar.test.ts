import { describe, expect, it } from "vitest";

import { getSituacaoVaar } from "@/core/lib/fundeb-vaar";

/**
 * O dataset do VAAR é a junção de duas publicações do FNDE que não
 * compartilham layout: a lista de beneficiários tem o código IBGE na segunda
 * coluna, o Anexo VI na terceira. Trocar as colunas não quebra o parser —
 * produz um arquivo com os campos certos e os municípios errados.
 *
 * As travas abaixo são fatos externos verificáveis, não valores copiados da
 * nossa própria saída: o teto nacional é Goiânia, e o Rio de Janeiro inteiro
 * está fora por reprovação do estado. Se a junção regredir ou o FNDE mudar o
 * leiaute, esses dois deixam de fechar antes de o número entrar num PDF.
 */
describe("situação do município no VAAR", () => {
  it("Goiânia é o teto nacional da complementação", () => {
    const goiania = getSituacaoVaar("5208707");

    expect(goiania).not.toBeNull();
    expect(goiania!.beneficiario).toBe(true);
    expect(goiania!.complementacao).toBeCloseTo(40_572_698.97, 2);
    expect(goiania!.reprovadas).toEqual([]);
  });

  it("reconhece a reprovação estadual que cascateia aos municípios do RJ", () => {
    // Resolução CIF nº 15/2025, art. 3º, §2º: a habilitação do estado se
    // aplica aos seus municípios. Em 2026 o RJ reprovou na Cond. IV e os 92
    // municípios ficaram sem VAAR — nenhum deles podia ter evitado isso.
    const rio = getSituacaoVaar("3304557");
    const angra = getSituacaoVaar("3300100");

    for (const municipio of [rio, angra]) {
      expect(municipio).not.toBeNull();
      expect(municipio!.condicionalidades.IV).toBe(false);
      expect(municipio!.condIVEstadual).toBe(true);
      expect(municipio!.beneficiario).toBe(false);
      expect(municipio!.complementacao).toBe(0);
    }

    expect(rio!.referencia.ufAvaliadas).toBe(92);
    expect(rio!.referencia.ufBeneficiadas).toBe(0);
    expect(rio!.referencia.medianaUf).toBeNull();
  });

  it("não marca cascata estadual quando a reprovação é do próprio município", () => {
    // MG tem municípios reprovados na Cond. IV e outros habilitados, então
    // nenhum deles pode alegar reprovação do estado.
    const juvenilia = getSituacaoVaar("3136959")!;
    expect(juvenilia.condIVEstadual).toBe(false);
    expect(juvenilia.referencia.ufBeneficiadas).toBeGreaterThan(0);
  });

  it("beneficiário tem complementação positiva e nenhuma condicionalidade reprovada", () => {
    const caninde = getSituacaoVaar("2801207")!;

    expect(caninde.habilitado).toBe(true);
    expect(caninde.beneficiario).toBe(true);
    expect(caninde.complementacao).toBeGreaterThan(0);
    expect(caninde.reprovadas).toEqual([]);
    expect(caninde.pendencia).toBeNull();
  });

  it("habilitação e benefício são coerentes em toda a base", () => {
    // Quem não está habilitado não pode receber, e quem recebe tem de estar
    // habilitado. Uma junção deslocada quebra exatamente esta relação.
    const amostra = ["5208707", "3304557", "3136959", "2801207", "3550308", "1302603"];

    for (const codigo of amostra) {
      const situacao = getSituacaoVaar(codigo)!;
      expect(situacao, `município ${codigo} ausente`).not.toBeNull();

      if (!situacao.habilitado) {
        expect(situacao.beneficiario).toBe(false);
        expect(situacao.complementacao).toBe(0);
        expect(situacao.reprovadas.length).toBeGreaterThan(0);
      }
      if (situacao.complementacao > 0) {
        expect(situacao.habilitado).toBe(true);
        expect(situacao.beneficiario).toBe(true);
      }
    }
  });

  it("devolve null para código inexistente em vez de lançar", () => {
    expect(getSituacaoVaar("0000000")).toBeNull();
    expect(getSituacaoVaar("")).toBeNull();
  });
});
