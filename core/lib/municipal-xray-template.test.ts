import { describe, expect, it } from "vitest";

import {
  generateMunicipalXrayHtml,
  mapMunicipalXrayModel,
} from "@/core/lib/municipal-xray-template";
import { getSituacaoVaar } from "@/core/lib/fundeb-vaar";

/**
 * A página do FUNDEB do Raio-X terminava com um par "alavanca / risco" escrito
 * em termos que serviam para qualquer município do país — e que, por isso, não
 * informavam nenhum. Estes testes garantem que o texto passou a depender do
 * dado: um município habilitado e um inabilitado não podem ler igual.
 */
function html(codigoIBGE: string | null) {
  const model = mapMunicipalXrayModel({
    basePayload: {},
    currentPayload: codigoIBGE
      ? { relatorio_dirigido_base: { vaar: getSituacaoVaar(codigoIBGE) } }
      : {},
    baseYear: 2024,
    currentYear: 2026,
    generatedAt: new Date("2026-07-28T12:00:00.000Z"),
  });

  return generateMunicipalXrayHtml(model);
}

describe("bloco do VAAR no Raio-X municipal", () => {
  it("nomeia a condicionalidade reprovada de quem está fora por conta própria", () => {
    // Costa Marques/RO reprovou em II e III. RO tem municípios habilitados,
    // então nada aqui vem de cascata estadual — a causa é local.
    const saida = html("1100080");

    expect(saida).toContain("VAAR 2026: R$ 0");
    expect(saida).toContain("nas condicionalidades");
    expect(saida).toContain("II, III");
    expect(saida).not.toContain("por reprovação do estado");
  });

  it("trata reprovação isolada como agenda de item único", () => {
    // Cacoal/RO reprovou apenas na Condicionalidade III.
    const saida = html("1100049");

    expect(saida).toContain("na condicionalidade");
    expect(saida).toContain("a reprovação é isolada");
  });

  it("atribui ao estado a reprovação que cascateia", () => {
    const saida = html("3300100"); // Angra dos Reis — reprovação estadual

    expect(saida).toContain("por reprovação do estado");
    expect(saida).toContain("Nenhuma ação municipal reverte isso");
  });

  it("mostra o valor recebido de quem é beneficiário", () => {
    const saida = html("5208707"); // Goiânia — maior VAAR do país

    expect(saida).toMatch(/VAAR 2026: R\$[^<]*recebidos/);
    expect(saida).toContain("habilitado nas cinco condicionalidades");
    expect(saida).not.toContain("por reprovação do estado");
  });

  it("dois municípios em situações opostas não leem igual", () => {
    expect(html("5208707")).not.toBe(html("3304557"));
  });

  it("volta ao texto genérico quando não há dado, sem quebrar a página", () => {
    const saida = html(null);

    expect(saida).toContain("<b>Alavanca:</b>");
    expect(saida).toContain("<b>Risco:</b>");
    expect(saida).not.toContain("VAAR 2026");
  });
});
