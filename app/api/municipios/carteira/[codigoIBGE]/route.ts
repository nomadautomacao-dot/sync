import { NextResponse } from "next/server";
import { removeGoviaCarteira } from "@/core/lib/govia-storage";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ codigoIBGE: string }> },
) {
  const { codigoIBGE } = await params;

  try {
    const removed = await removeGoviaCarteira(codigoIBGE);
    if (!removed) {
      return NextResponse.json({ success: false, error: "Municipio nao encontrado na carteira." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao remover municipio da carteira GovIA:", error);
    return NextResponse.json({ success: false, error: "Falha ao remover municipio da carteira." }, { status: 500 });
  }
}
