import { NextRequest, NextResponse } from "next/server";
import { searchGoviaMunicipios } from "@/core/lib/govia-compat";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const uf = request.nextUrl.searchParams.get("uf") ?? undefined;

  try {
    const data = await searchGoviaMunicipios(query, uf);
    return NextResponse.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("Erro ao buscar municipios:", error);
    return NextResponse.json(
      { success: false, count: 0, data: [], error: "Falha ao buscar municipios." },
      { status: 500 },
    );
  }
}
