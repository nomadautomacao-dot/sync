import { describe, expect, it } from "vitest";

import {
  cityReportSnapshotFromUnknown,
  generatedReportBundleFromUnknown,
} from "./city-reports-firestore";

describe("cityReportSnapshotFromUnknown", () => {
  it("preserva os blocos navegaveis do relatorio FUNDEB", () => {
    const snapshot = cityReportSnapshotFromUnknown({
      identificacao: { municipioNome: "Cristalina", uf: "GO" },
      projecao: { totalAtual: 10, totalProjetado: 12 },
      projecaoRecuperavel: { totalGanho: 2 },
      censoEscolar: { totalMatriculas: 1000 },
      perfilComercial: { score: 80 },
      payloadInterno: { deveSerIgnorado: true },
    });

    expect(snapshot?.identificacao?.municipioNome).toBe("Cristalina");
    expect(snapshot?.projecao?.totalProjetado).toBe(12);
    expect(snapshot?.projecaoRecuperavel?.totalGanho).toBe(2);
    expect(snapshot).not.toHaveProperty("payloadInterno");
    expect(snapshot?.reportData?.payloadInterno).toEqual({
      deveSerIgnorado: true,
    });
    expect(snapshot?.schemaVersion).toBe(2);
  });

  it("preserva o payload completo devolvido pelo levantamento", () => {
    const snapshot = cityReportSnapshotFromUnknown({
      relatorio: {
        identificacao: { municipioNome: "Cristalina", uf: "GO" },
        receitas: { totalReceitas: 15_000_000 },
        cronogramaVAAF: [{ mes: "Janeiro", valorProjetado: 1_000_000 }],
      },
      payload: {
        dados_basicos: { codigo_ibge: "5206206" },
        educacao: { total_matriculas: 10_500 },
        fiscal: { siconfi: { situacao_lrf: "Regular" } },
        relatorio_dirigido_base: {
          vaar: { habilitado: true },
          conformidade: { alertas: ["RREO pendente"] },
        },
      },
      municipio: {
        id: "5206206",
        nome: "Cristalina",
        uf: "GO",
      },
      integracao_futura: {
        origem: "nova-fonte",
      },
      oportunidades: [{ titulo: "Revisar matrículas" }],
    });

    expect(snapshot?.reportData?.receitas).toEqual({
      totalReceitas: 15_000_000,
    });
    expect(snapshot?.sourcePayload?.educacao).toEqual({
      total_matriculas: 10_500,
    });
    expect(snapshot?.sourcePayload?.relatorio_dirigido_base).toEqual({
      vaar: { habilitado: true },
      conformidade: { alertas: ["RREO pendente"] },
    });
    expect(snapshot?.municipalityData).toEqual({
      id: "5206206",
      nome: "Cristalina",
      uf: "GO",
    });
    expect(snapshot?.additionalData).toEqual({
      integracao_futura: {
        origem: "nova-fonte",
      },
    });
    expect(snapshot?.opportunities).toEqual([
      { titulo: "Revisar matrículas" },
    ]);
  });

  it("retorna undefined para entrada sem relatorio", () => {
    expect(cityReportSnapshotFromUnknown(null)).toBeUndefined();
    expect(cityReportSnapshotFromUnknown("invalido")).toBeUndefined();
  });

  it("preserva o JSON exato que acompanhou a geração do documento", () => {
    const archive = {
      schemaVersion: 1 as const,
      generationId: "geracao-123",
      reportType: "raio_x" as const,
      generatedAt: "2026-07-29T15:00:00.000Z",
      exercise: 2026,
      municipality: {
        name: "Sítio d'Abadia",
        uf: "GO",
        codigoIbge: "5220702",
      },
      data: {
        primary: {
          relatorio: {
            identificacao: { municipioNome: "Sítio d'Abadia", uf: "GO" },
            receitas: { totalReceitas: 12_000_000 },
          },
          payload: {
            dados_basicos: { codigo_ibge: "5220702" },
            relatorio_dirigido_base: { historico: { anos: [2025, 2026] } },
          },
        },
        context: {
          baseYear: 2025,
          currentYear: 2026,
          municipalProfile: { saneamento: { disponivel: true } },
        },
      },
    };

    const snapshot = cityReportSnapshotFromUnknown(archive);

    expect(snapshot?.schemaVersion).toBe(3);
    expect(snapshot?.generation?.generationId).toBe("geracao-123");
    expect(snapshot?.reportData?.receitas).toEqual({
      totalReceitas: 12_000_000,
    });
    expect(snapshot?.sourcePayload?.dados_basicos).toEqual({
      codigo_ibge: "5220702",
    });
    expect(snapshot?.generationContext?.municipalProfile).toEqual({
      saneamento: { disponivel: true },
    });
  });
});

describe("generatedReportBundleFromUnknown", () => {
  it("valida PDF e JSON companheiro antes do arquivamento", () => {
    const bundle = generatedReportBundleFromUnknown({
      schemaVersion: 1,
      fileName: "RAIO_X_SITIO_D_ABADIA.pdf",
      mimeType: "application/pdf",
      pdfBase64: "JVBERi0xLjQ=",
      archive: {
        schemaVersion: 1,
        generationId: "geracao-123",
        reportType: "raio_x",
        generatedAt: "2026-07-29T15:00:00.000Z",
        exercise: 2026,
        municipality: {
          name: "Sítio d'Abadia",
          uf: "GO",
          codigoIbge: "5220702",
        },
        data: { primary: { relatorio: { identificacao: {} } } },
      },
    });

    expect(bundle?.archive.municipality.codigoIbge).toBe("5220702");
    expect(generatedReportBundleFromUnknown({ pdfBase64: "" })).toBeNull();
  });
});
