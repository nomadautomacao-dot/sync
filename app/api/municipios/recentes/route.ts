import { NextRequest, NextResponse } from "next/server";
import { listGoviaRecentes } from "@/core/lib/govia-storage";

export async function GET(request: NextRequest) {
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "20");

  try {
    const itens = await listGoviaRecentes(Number.isFinite(limit) ? limit : 20);
    return NextResponse.json({
      success: true,
      data: {
        itens,
        total: itens.length,
      },
    });
  } catch (error) {
    console.error("Erro ao listar recentes GovIA:", error);
    return NextResponse.json({ success: false, data: { itens: [], total: 0 } }, { status: 500 });
  }
}
