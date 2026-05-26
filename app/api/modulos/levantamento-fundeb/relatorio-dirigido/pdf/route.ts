import { NextRequest, NextResponse } from "next/server";
import { generateDirectedFundebPdfBuffer } from "@/core/lib/fundeb-directed-pdf";
import type { RelatorioDirigidoMunicipio } from "@/modules/levantamento-fundeb/types";

export async function POST(request: NextRequest) {
  try {
    const report = (await request.json()) as RelatorioDirigidoMunicipio;

    if (!report?.municipio || !report?.codigoIbge) {
      return NextResponse.json(
        { error: "Payload invalido para PDF do relatorio dirigido." },
        { status: 400 },
      );
    }

    const { pdfBuffer, filename } = await generateDirectedFundebPdfBuffer(report);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=${filename}`,
      },
    });
  } catch (error) {
    console.error("[PDF Dirigido] Erro na API:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha na requisicao" },
      { status: 500 },
    );
  }
}
