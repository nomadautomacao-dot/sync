import { NextRequest, NextResponse } from "next/server";
import { listGoviaCarteira, upsertGoviaCarteira } from "@/core/lib/govia-storage";

export async function GET(request: NextRequest) {
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "200");

  try {
    const itens = await listGoviaCarteira(Number.isFinite(limit) ? limit : 200);
    return NextResponse.json({
      success: true,
      data: {
        itens,
        total: itens.length,
      },
    });
  } catch (error) {
    console.error("Erro ao listar carteira GovIA:", error);
    return NextResponse.json({ success: false, data: { itens: [], total: 0 } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const item = await upsertGoviaCarteira({
      codigo_ibge: String(body.codigo_ibge ?? "").trim(),
      nome: String(body.nome ?? "").trim(),
      uf: String(body.uf ?? "").trim().toUpperCase(),
      regiao: String(body.regiao ?? "").trim(),
    });

    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error) {
    console.error("Erro ao salvar carteira GovIA:", error);
    return NextResponse.json({ success: false, error: "Falha ao salvar municipio na carteira." }, { status: 500 });
  }
}
