import { describe, expect, it } from "vitest";

import { getCoberturaVacinal, getViolenciaInfantil } from "@/core/lib/saude-escolar";

const PAULO_AFONSO = "2924009";
const IBATEGUARA = "2703007";
const SERRA_DO_RAMALHO = "2930758";
const SAO_PAULO = "3550308";

describe("cobertura vacinal", () => {
  it("lê pelo código de 6 dígitos, que é como a fonte publica", () => {
    expect(getCoberturaVacinal(PAULO_AFONSO)).not.toBeNull();
    expect(getCoberturaVacinal("292400")).not.toBeNull();
    expect(getCoberturaVacinal("2.924.009")).not.toBeNull();
    expect(getCoberturaVacinal("0000000")).toBeNull();
  });

  /**
   * A trava central. Cobertura é dose aplicada ÷ população estimada, então
   * passar de 100% é comum e **não** é excelência — Serra do Ramalho tem as
   * seis acima de 100. Tratar isso como bom desempenho seria elogiar um
   * artefato de denominador.
   */
  it("não lê cobertura acima de 100% como bom desempenho", () => {
    const c = getCoberturaVacinal(SERRA_DO_RAMALHO)!;

    expect(c.semLeitura).toBe(c.vacinas.length);
    expect(c.abaixoDaMediana).toBe(0);
    for (const v of c.vacinas.filter((x) => x.semLeitura)) {
      expect(v.valor).toBeGreaterThan(100);
      expect(v.abaixoDaMediana).toBe(false);
    }
  });

  it("compara com a mediana nacional do mesmo ano, não com meta", () => {
    const c = getCoberturaVacinal(PAULO_AFONSO)!;

    for (const v of c.vacinas) {
      expect(v.medianaNacional).not.toBeNull();
      expect(v.medianaNacional!).toBeGreaterThan(0);
      if (v.abaixoDaMediana) expect(v.valor).toBeLessThan(v.medianaNacional!);
    }
  });

  /** Ibateguara está abaixo da mediana nas seis — é o caso que a página lê. */
  it("conta quantas coberturas ficam abaixo da mediana", () => {
    const c = getCoberturaVacinal(IBATEGUARA)!;

    expect(c.vacinas).toHaveLength(6);
    expect(c.abaixoDaMediana).toBe(6);
    expect(c.semLeitura).toBe(0);
  });

  it("informa o ano de cada leitura — a série pública para em 2022", () => {
    const c = getCoberturaVacinal(SAO_PAULO)!;

    expect(c.ano).toBe(2022);
    for (const v of c.vacinas) expect(v.ano).toBeLessThanOrEqual(2022);
    expect(c.ressalva).toMatch(/acima de 100%/i);
  });
});

describe("violência notificada contra criança", () => {
  /**
   * O silêncio é o achado. Devolver `null` para município sem notificação o
   * esconderia — e é justamente o município que não notifica que precisa da
   * pergunta de campo.
   */
  it("devolve registro mesmo sem nenhuma notificação", () => {
    const v = getViolenciaInfantil(IBATEGUARA)!;

    expect(v).not.toBeNull();
    expect(v.total).toBe(0);
    expect(v.silencioTotal).toBe(true);
    expect(v.serie.length).toBeGreaterThan(0);
    for (const ano of v.serie) expect(ano.notificacoes).toBe(0);
  });

  it("monta a série completa, preenchendo com zero o exercício sem registro", () => {
    const v = getViolenciaInfantil(PAULO_AFONSO)!;

    expect(v.serie.map((x) => x.ano)).toEqual([...v.serie.map((x) => x.ano)].sort((a, b) => a - b));
    expect(v.total).toBe(v.serie.reduce((t, x) => t + x.notificacoes, 0));
    expect(v.ultimo!.ano).toBe(v.serie[v.serie.length - 1].ano);
  });

  it("sabe quantos municípios do país notificaram, para dar escala ao silêncio", () => {
    const v = getViolenciaInfantil(IBATEGUARA)!;

    expect(v.municipiosNotificantes).toBeGreaterThan(2_000);
    expect(v.municipiosNotificantes).toBeLessThan(v.municipiosNoPais);
  });

  /** A ressalva é o produto: sem ela o número vira rótulo. */
  it("carrega a ressalva de notificação × ocorrência", () => {
    const v = getViolenciaInfantil(SAO_PAULO)!;

    expect(v.ressalva).toMatch(/notifica/i);
    expect(v.ressalva).toMatch(/não classifica o município/i);
    expect(v.faixaEtaria).toBe("5 a 14 anos");
    expect(v.total).toBeGreaterThan(0);
  });

  it("rejeita código que não é de município", () => {
    expect(getViolenciaInfantil("123")).toBeNull();
    expect(getViolenciaInfantil("")).toBeNull();
  });
});
