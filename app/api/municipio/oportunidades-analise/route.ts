import { NextRequest, NextResponse } from "next/server";
import { buildGoviaMunicipioCompleto } from "@/core/lib/govia-compat";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await buildGoviaMunicipioCompleto({
      codigo_ibge: body.codigo_ibge,
      nome: body.nome,
      uf: body.uf,
      exercicio: body.exercicio,
    });

    if (!data) {
      return NextResponse.json({ success: false, error: "Municipio nao encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      oportunidades: data.oportunidades,
      insights: [
        {
          type: "fundeb_projection",
          description: data.payload.analise_ia.diagnostico_executivo,
          implication: "Priorizar validacao das bases e sistemas para converter o potencial em incremento real.",
          priority: data.payload.score_viabilidade >= 75 ? "high" : "medium",
        },
      ],
      correlations: [],
      resumo: {
        oportunidades_encontradas: data.oportunidades.length,
        insights_gerados: 1,
      },
    });
  } catch (error) {
    console.error("Erro no endpoint municipio/oportunidades-analise:", error);
    return NextResponse.json({ success: false, error: "Falha ao analisar oportunidades." }, { status: 500 });
  }
}
