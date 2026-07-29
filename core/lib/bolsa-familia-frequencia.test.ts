import { describe, expect, it } from "vitest";

import { interpretarFrequencia } from "@/core/lib/bolsa-familia-frequencia";

/**
 * A interpretação é pura de propósito — a rede fica em
 * `getFrequenciaBolsaFamilia` — e a fixture usa os nomes de campo reais da
 * Matriz do MDS, sondados em 2026-07-29 (Serra do Ramalho, competência
 * 202605). Se o MDS renomear os campos, é aqui que quebra primeiro.
 */
const FIXTURE = {
  anomes_s: "202605",
  sicon_qtde_benef_perfil_educacao_4_17_anos_apartir_2023_l: 6080,
  sicon_qtde_benef_acomp_educacao_4_17_anos_apartir_2023_l: 5840,
  sicon_perc_benef_acomp_educacao_4_17_anos_apartir_2023_d: 96.05,
  sicon_qtde_benef_nao_localizados_4_17_anos_apartir_2023_l: 141,
  sicon_perc_benef_nao_localizados_4_17_anos_apartir_2023_d: 2.32,
  sicon_qtde_benef_sem_info_freq_4_17_anos_apartir_2023_l: 240,
  sicon_perc_acomp_freq_acima_4_17_anos_apartir_2023_d: 99.98,
  sicon_qtde_advertencia_bf_apartir_2023_l: 5,
  sicon_qtde_advertencia_bva_apartir_2023_l: 3,
  sicon_qtde_bloqueio_bf_apartir_2023_l: 1,
  sicon_qtde_bloqueio_bva_apartir_2023_l: 1,
  sicon_qtde_suspensao_bf_apartir_2023_l: 2,
  sicon_qtde_suspensao_bva_apartir_2023_l: 0,
  sicon_qtde_cancelamento_bf_apartir_2023_l: 0,
  sicon_qtde_cancelamento_bva_apartir_2023_l: 0,
  sicon_qtd_famlilias_fase_suspensao_apartir_2023_l: 6,
};

describe("frequência do Bolsa Família", () => {
  it("lê o acompanhamento com os campos reais da Matriz", () => {
    const f = interpretarFrequencia(FIXTURE)!;

    expect(f.competencia).toBe("202605");
    expect(f.publicoEducacao).toBe(6080);
    expect(f.percAcompanhados).toBeCloseTo(96.05, 2);
    expect(f.naoLocalizados).toBe(141);
    expect(f.percFrequenciaAcima).toBeCloseTo(99.98, 2);
  });

  it("soma as sanções do PBF e do Bolsa Verde e Amarelo", () => {
    // O SICON separa BF de BVA; a página fala de famílias sancionadas, e uma
    // família advertida no BVA está tão sancionada quanto no BF.
    const f = interpretarFrequencia(FIXTURE)!;

    expect(f.sancoes.advertencias).toBe(8);
    expect(f.sancoes.bloqueios).toBe(2);
    expect(f.sancoes.suspensoes).toBe(2);
    expect(f.sancoes.familiasEmFaseDeSuspensao).toBe(6);
  });

  it("devolve null sem público de educação em vez de página zerada", () => {
    expect(interpretarFrequencia({ anomes_s: "202605" })).toBeNull();
    expect(
      interpretarFrequencia({ sicon_qtde_benef_perfil_educacao_4_17_anos_apartir_2023_l: 0 }),
    ).toBeNull();
  });

  it("trata campo ausente como zero e percentual ausente como null", () => {
    const f = interpretarFrequencia({
      anomes_s: "202603",
      sicon_qtde_benef_perfil_educacao_4_17_anos_apartir_2023_l: 100,
    })!;

    expect(f.naoLocalizados).toBe(0);
    expect(f.percAcompanhados).toBeNull();
    expect(f.sancoes.advertencias).toBe(0);
  });
});
