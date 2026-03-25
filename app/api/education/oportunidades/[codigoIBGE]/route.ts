import { NextResponse } from "next/server";
import { buildGoviaMunicipioCompleto } from "@/core/lib/govia-compat";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ codigoIBGE: string }> },
) {
  const { codigoIBGE } = await params;

  try {
    const data = await buildGoviaMunicipioCompleto({ codigo_ibge: codigoIBGE });
    return NextResponse.json(data?.oportunidades ?? []);
  } catch (error) {
    console.error("Erro no endpoint education/oportunidades/[codigoIBGE]:", error);
    return NextResponse.json([], { status: 500 });
  }
}
