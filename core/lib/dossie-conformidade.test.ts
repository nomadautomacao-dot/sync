import { describe, expect, it } from "vitest";

import { montarAgenda } from "@/core/lib/dossie-conformidade";
import type { CaucMunicipio, RequisitoCauc } from "@/core/lib/cauc-requisitos";

const HOJE = new Date("2026-07-30T12:00:00.000Z");

function req(
  codigo: string,
  situacao: RequisitoCauc["situacao"],
  validadeAte: string | null,
  rotulo = "Requisito qualquer",
): RequisitoCauc {
  return { codigo, rotulo, situacao, validadeAte };
}

function cauc(requisitos: RequisitoCauc[], pendenciasEducacao: RequisitoCauc[] = []): CaucMunicipio {
  return {
    dataPesquisa: "2026-07-30",
    requisitos,
    pendencias: requisitos.filter((r) => r.situacao === "pendente"),
    pendenciasEducacao,
    comprovados: requisitos.filter((r) => r.situacao === "comprovado").length,
    desabilitados: requisitos.filter((r) => r.situacao === "desabilitado").length,
    proximoVencimento: null,
    panorama: null,
  };
}

describe("agenda de vencimentos do CAUC", () => {
  /**
   * A armadilha central. Parte dos requisitos traz, no campo de validade, a
   * **própria data da consulta** em vez de um prazo. Lidos como vencimento,
   * eles fazem o documento anunciar doze vencimentos para hoje em qualquer
   * município do país, todo dia — e o secretário de finanças descarta o
   * relatório inteiro na primeira linha.
   *
   * Em Paulo Afonso/BA são 11 dos 22 comprovados com data.
   */
  it("não trata a data da consulta como vencimento de hoje", () => {
    const a = montarAgenda(cauc([req("1.2", "comprovado", "2026-07-30")]), HOJE);

    expect(a[0].semPrazoFuturo).toBe(true);
    expect(a[0].urgente).toBe(false);
  });

  it("marca como urgente só o que tem prazo real dentro de 60 dias", () => {
    const a = montarAgenda(
      cauc([
        req("3.4.1", "comprovado", "2026-07-31"),
        req("3.3", "comprovado", "2027-04-30"),
        req("1.2", "comprovado", "2026-07-30"),
      ]),
      HOJE,
    );

    const porCodigo = new Map(a.map((i) => [i.codigo, i]));
    expect(porCodigo.get("3.4.1")!.urgente).toBe(true);
    expect(porCodigo.get("3.4.1")!.diasRestantes).toBe(1);
    expect(porCodigo.get("3.3")!.urgente).toBe(false);
    expect(porCodigo.get("1.2")!.urgente).toBe(false);
  });

  it("ordena por data e joga o que não tem prazo para o fim", () => {
    const a = montarAgenda(
      cauc([
        req("1.2", "comprovado", "2026-07-30"),
        req("3.3", "comprovado", "2027-04-30"),
        req("3.4.1", "comprovado", "2026-07-31"),
      ]),
      HOJE,
    );

    expect(a.map((i) => i.codigo)).toEqual(["3.4.1", "3.3", "1.2"]);
  });

  it("conta como vencido o prazo que já passou", () => {
    const a = montarAgenda(cauc([req("9.9", "comprovado", "2026-07-01")]), HOJE);

    expect(a[0].diasRestantes).toBeLessThan(0);
    expect(a[0].semPrazoFuturo).toBe(false);
  });

  /** Requisito sem data não entra na agenda — é pendência, não vencimento. */
  it("deixa fora da agenda o requisito sem data", () => {
    const a = montarAgenda(
      cauc([req("1.5", "pendente", null), req("1.1", "desabilitado", null)]),
      HOJE,
    );

    expect(a).toHaveLength(0);
  });

  /**
   * Os cinco itens de educação travam duas coisas ao mesmo tempo — a
   * transferência voluntária e a habilitação ao VAAT —, então precisam estar
   * marcados também quando estão comprovados, porque são eles que vencem.
   */
  it("marca os itens de educação inclusive quando comprovados", () => {
    const educacao = req("5.1", "comprovado", "2027-01-30", "Aplicação mínima de recursos em educação");
    const a = montarAgenda(cauc([educacao, req("4.1", "comprovado", "2027-04-30")]), HOJE);

    const porCodigo = new Map(a.map((i) => [i.codigo, i]));
    expect(porCodigo.get("5.1")!.educacao).toBe(true);
    expect(porCodigo.get("4.1")!.educacao).toBe(false);
  });

  it("devolve agenda vazia quando o extrato não respondeu", () => {
    expect(montarAgenda(null, HOJE)).toEqual([]);
  });
});
