import { describe, expect, it } from "vitest";

import {
  ehLevantamento,
  levantamentosDaFicha,
  relatorioParaInspecionar,
  versaoDaFicha,
} from "./ficha-fundeb";
import type { CityReport, CityReportType } from "./reports-types";

function relatorio(
  id: string,
  type: CityReportType,
  opcoes: { snapshot?: boolean; generatedAt?: string } = {},
): CityReport {
  const { snapshot = true, generatedAt = "2026-08-13T12:00:00.000Z" } = opcoes;
  return {
    id,
    groupId: "g",
    cityId: "c",
    cityName: "Nossa Senhora do Livramento",
    cityUf: "MT",
    codigoIbge: "5106224",
    type,
    title: type,
    exercise: 2026,
    status: "ready",
    snapshot: snapshot ? { schemaVersion: 3 } : undefined,
    generatedBy: "u",
    generatedByName: "Tais",
    generatedAt,
  };
}

describe("levantamentosDaFicha", () => {
  it("recusa Raio-X e dossiês", () => {
    /* O defeito que isto trava: a ficha lia qualquer relatório com snapshot.
       Um dossiê lido com o gabarito do levantamento não dá erro — dá VAAF e
       VAAT em R$ 0,00 e identificação toda "Não informado", que parece dado
       real e não é. */
    const entrada = [
      relatorio("r1", "raio_x"),
      relatorio("d1", "dossie_demanda"),
      relatorio("d2", "dossie_escolas"),
      relatorio("l1", "diagnostico_fundeb"),
    ];
    expect(levantamentosDaFicha(entrada).map((r) => r.id)).toEqual(["l1"]);
  });

  it("recusa levantamento sem JSON arquivado", () => {
    // Relatório antigo, só com PDF: a ficha não teria o que ler.
    const entrada = [relatorio("l1", "diagnostico_fundeb", { snapshot: false })];
    expect(levantamentosDaFicha(entrada)).toEqual([]);
  });

  it("devolve lista vazia quando a cidade só tem dossiês", () => {
    expect(levantamentosDaFicha([relatorio("d1", "dossie_dinheiro")])).toEqual([]);
  });
});

describe("versaoDaFicha", () => {
  const levantamentoNovo = relatorio("l-novo", "diagnostico_fundeb", {
    generatedAt: "2026-08-13T12:00:00.000Z",
  });
  const levantamentoVelho = relatorio("l-velho", "diagnostico_fundeb", {
    generatedAt: "2026-01-10T12:00:00.000Z",
  });
  const dossie = relatorio("d1", "dossie_equidade");

  it("respeita a versão escolhida quando ela é um levantamento", () => {
    const escolhida = versaoDaFicha([levantamentoNovo, levantamentoVelho], levantamentoVelho);
    expect(escolhida?.id).toBe("l-velho");
  });

  it("ignora a escolha quando ela é um dossiê", () => {
    /* A seleção é compartilhada com a aba de Relatórios: dá para escolher um
       dossiê lá e voltar aqui. A ficha cai no levantamento em vez de tentar
       ler o dossiê com o gabarito errado. */
    const escolhida = versaoDaFicha([levantamentoNovo, dossie], dossie);
    expect(escolhida?.id).toBe("l-novo");
  });

  it("não devolve nada quando não há levantamento", () => {
    expect(versaoDaFicha([dossie], dossie)).toBeUndefined();
  });

  it("não estoura sem seleção nenhuma", () => {
    expect(versaoDaFicha([levantamentoNovo])?.id).toBe("l-novo");
    expect(versaoDaFicha([])).toBeUndefined();
  });
});

describe("relatorioParaInspecionar", () => {
  const levantamento = relatorio("l1", "diagnostico_fundeb");
  const raioX = relatorio("r1", "raio_x");
  const dossie = relatorio("d1", "dossie_demanda");

  it("abre qualquer tipo, ao contrário da ficha", () => {
    // O ponto do inspetor: o Raio-X arquiva dezenas de blocos que só existiam
    // dentro do PDF.
    expect(relatorioParaInspecionar([levantamento, raioX], raioX)?.id).toBe("r1");
    expect(relatorioParaInspecionar([levantamento, dossie], dossie)?.id).toBe("d1");
  });

  it("prefere o levantamento quando ninguém escolheu", () => {
    expect(relatorioParaInspecionar([raioX, dossie, levantamento])?.id).toBe("l1");
  });

  it("cai no que existe quando não há levantamento", () => {
    expect(relatorioParaInspecionar([raioX, dossie])?.id).toBe("r1");
  });

  it("ignora relatório sem JSON arquivado", () => {
    const semJson = relatorio("x", "raio_x", { snapshot: false });
    expect(relatorioParaInspecionar([semJson, levantamento], semJson)?.id).toBe("l1");
    expect(relatorioParaInspecionar([semJson])).toBeUndefined();
  });
});

describe("ehLevantamento", () => {
  it("só o diagnóstico FUNDEB libera o painel de VAAF/VAAT/VAAR", () => {
    expect(ehLevantamento(relatorio("l", "diagnostico_fundeb"))).toBe(true);
    expect(ehLevantamento(relatorio("r", "raio_x"))).toBe(false);
    expect(ehLevantamento(undefined)).toBe(false);
  });
});
