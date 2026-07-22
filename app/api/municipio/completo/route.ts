import { NextRequest, NextResponse } from "next/server";
import { buildGoviaMunicipioCompleto } from "@/core/lib/govia-compat";
import { markGoviaMunicipioAccess } from "@/core/lib/govia-storage";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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

    await markGoviaMunicipioAccess({
      codigo_ibge: data.payload.dados_basicos.codigo_ibge,
      nome: data.payload.dados_basicos.nome,
      uf: data.payload.dados_basicos.uf,
      regiao: data.payload.dados_basicos.regiao,
    });

    return NextResponse.json({
      success: true,
      data: data.payload,
    });
  } catch (error) {
    console.error("Erro no endpoint municipio/completo:", error);
    return NextResponse.json({ success: false, error: "Falha ao montar municipio completo." }, { status: 500 });
  }
}
