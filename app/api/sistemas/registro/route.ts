import { NextResponse, type NextRequest } from "next/server";

import { listarRegistro } from "@/core/lib/sistemas-registro";
import { falha, operador } from "@/core/lib/sistemas-http";

/** Últimas ações do console, do grupo de quem está pedindo. */
export async function GET(request: NextRequest) {
  const guarda = await operador();
  if ("resposta" in guarda) return guarda.resposta;

  const sistemaId = request.nextUrl.searchParams.get("sistema") ?? undefined;

  try {
    const registro = await listarRegistro(guarda.operador.groupId, { sistemaId });
    return NextResponse.json({ registro });
  } catch (e) {
    return falha("registro do console", e);
  }
}
