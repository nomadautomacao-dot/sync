import { NextRequest, NextResponse } from "next/server";
import { buildDirectedFundebReportBase } from "@/core/lib/fundeb-directed-report";
import { buildGoviaMunicipioCompleto } from "@/core/lib/govia-compat";
import { buildDirectedReportMarkdown } from "@/modules/levantamento-fundeb/utils/directed-report-format";
import type { FundebRelatorioParametros } from "@/modules/levantamento-fundeb/types";
import { registrarErro } from "@/core/lib/structured-log";

interface DirectedReportRequestBody {
  codigo_ibge?: string;
  nome?: string;
  uf?: string;
  exercicio?: number;
  parametros?: FundebRelatorioParametros;
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const formato = (searchParams.get("formato") || "json").toLowerCase();

    if (formato !== "json" && formato !== "md") {
      return NextResponse.json(
        { success: false, error: `Formato invalido: "${formato}". Use json ou md.` },
        { status: 400 },
      );
    }

    const body = (await request.json()) as DirectedReportRequestBody;
    const data = await buildGoviaMunicipioCompleto({
      codigo_ibge: body.codigo_ibge,
      nome: body.nome,
      uf: body.uf,
      exercicio: body.exercicio,
      parametros: body.parametros,
    });

    if (!data) {
      return NextResponse.json({ success: false, error: "Municipio nao encontrado." }, { status: 404 });
    }

    const report = await buildDirectedFundebReportBase({
      relatorio: data.relatorio,
      payload: data.payload,
    });

    if (formato === "md") {
      const markdown = buildDirectedReportMarkdown(report);
      const safeName = (data.payload.dados_basicos?.nome ?? "municipio")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      return new NextResponse(markdown, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename=relatorio-dirigido-${safeName || "municipio"}.md`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: report,
      base: report,
    });
  } catch (error) {
    registrarErro("Relatorio Dirigido FUNDEB", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Falha ao gerar relatorio dirigido." },
      { status: 500 },
    );
  }
}
