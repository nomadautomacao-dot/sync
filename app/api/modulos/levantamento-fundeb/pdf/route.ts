import { NextRequest, NextResponse } from "next/server";
import { buildFundebComparativeSnapshot } from "@/core/lib/fundeb-comparative";
import { generateFundebPdfBuffer, isFundebPdfTipo } from "@/core/lib/fundeb-pdf";
import type { RelatorioFundeb } from "@/modules/levantamento-fundeb/types";

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = (searchParams.get("tipo") || "levantamento").toLowerCase();

    if (!isFundebPdfTipo(tipo)) {
      return NextResponse.json(
        { error: `Tipo invalido: "${tipo}". Use: levantamento | executiva | comparativa` },
        { status: 400 }
      );
    }

    const relatorio = (await request.json()) as RelatorioFundeb;
    const comparativeSnapshot =
      tipo === "comparativa" || tipo === "executiva"
        ? await buildFundebComparativeSnapshot(relatorio)
        : null;
    const pdfPayload =
      tipo === "comparativa"
        ? comparativeSnapshot?.comparativaPdfInput ?? relatorio
        : tipo === "executiva"
          ? { ...relatorio, ...(comparativeSnapshot?.comparativaPdfInput ?? {}) }
          : relatorio;
    const { pdfBuffer, filename } = await generateFundebPdfBuffer(pdfPayload, tipo, relatorio);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=${filename}`,
      },
    });
  } catch (error) {
    console.error("[PDF] Erro na API:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha na requisicao" },
      { status: 500 },
    );
  }
}
