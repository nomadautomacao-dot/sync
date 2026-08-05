import { NextResponse, type NextRequest } from "next/server";

import { buscarMunicipios } from "@/core/lib/municipios-dossie";
import { falha, operador } from "@/core/lib/sistemas-http";

/** Municípios que casam com o termo — alimenta o autocomplete do cadastro. */
export async function GET(request: NextRequest) {
  const guarda = await operador();
  if ("resposta" in guarda) return guarda.resposta;

  const termo = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const uf = request.nextUrl.searchParams.get("uf")?.trim() || undefined;

  // Menos de dois caracteres varreria os 5.570 municípios para nada.
  if (termo.length < 2) return NextResponse.json({ municipios: [] });

  try {
    return NextResponse.json({ municipios: await buscarMunicipios(termo, uf) });
  } catch (e) {
    return falha("busca de municípios", e);
  }
}
