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

    return NextResponse.json({
      success: true,
      oportunidades: data?.oportunidades ?? [],
    });
  } catch (error) {
    console.error("Erro no endpoint education/oportunidades/calcular:", error);
    return NextResponse.json({ success: false, oportunidades: [] }, { status: 500 });
  }
}
