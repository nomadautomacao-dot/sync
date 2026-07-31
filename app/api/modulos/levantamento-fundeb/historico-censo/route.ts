import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getInepCensoMunicipalHistory } from "@/core/lib/inep-censo";
import { getCorRacaHistorico } from "@/core/lib/cor-raca-historico";
import {
  generateCensoHistoricoHtml,
  mapCensoHistoricoModel,
} from "@/core/lib/censo-historico-template";
import { generateCensoHistoricoPdf } from "@/core/lib/censo-historico-pdf";
import { registrarErro } from "@/core/lib/structured-log";

export const maxDuration = 120;

interface CensoHistoricoRequest {
  codigo_ibge?: string;
  response_format?: "pdf" | "bundle";
}

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CensoHistoricoRequest;
    const codigoIbge = body.codigo_ibge?.trim();
    if (!codigoIbge) {
      return NextResponse.json(
        { error: "Informe codigo_ibge para gerar o Histórico do Censo Escolar." },
        { status: 400 },
      );
    }

    // O relatório é 100% dados locais: as sinopses do Censo já versionadas
    // trazem nome e UF, então nenhuma API viva é consultada.
    const records = getInepCensoMunicipalHistory(codigoIbge);
    if (records.length < 2) {
      return NextResponse.json(
        {
          error:
            "O Histórico do Censo precisa de pelo menos dois Censos publicados para este município — a base local não os encontrou.",
        },
        { status: 404 },
      );
    }

    const corRaca = getCorRacaHistorico(codigoIbge);
    const model = mapCensoHistoricoModel({ records, corRaca });
    const html = generateCensoHistoricoHtml(model);
    const primeiro = model.years[0].anoReferencia;
    const ultimo = model.years[model.years.length - 1].anoReferencia;
    const municipalitySlug = `${slug(model.municipality)}_${slug(model.uf)}_${primeiro}_${ultimo}`;
    const { pdfBuffer, filename } = await generateCensoHistoricoPdf(html, municipalitySlug);

    if (body.response_format === "bundle") {
      return NextResponse.json(
        {
          schemaVersion: 1,
          fileName: filename,
          mimeType: "application/pdf",
          pdfBase64: pdfBuffer.toString("base64"),
          archive: {
            schemaVersion: 1,
            generationId: randomUUID(),
            reportType: "historico_censo",
            generatedAt: model.generatedAt.toISOString(),
            exercise: ultimo,
            municipality: {
              name: model.municipality,
              uf: model.uf,
              codigoIbge: model.ibgeCode,
            },
            data: {
              primary: { censoHistorico: records, corRaca },
              context: { anos: model.years.map((r) => r.anoReferencia) },
            },
          },
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=${filename}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    registrarErro("Histórico do Censo", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Falha ao gerar o Histórico do Censo Escolar.",
      },
      { status: 500 },
    );
  }
}
