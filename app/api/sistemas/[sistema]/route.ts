import { NextResponse } from "next/server";

import { paraTela } from "@/core/domain/sistemas";
import { resumoDoSistema } from "@/core/lib/sistemas-admin";
import { falha, operador, sistemaOuErro } from "@/core/lib/sistemas-http";

export async function GET(_request: Request, { params }: { params: Promise<{ sistema: string }> }) {
  const guarda = await operador();
  if ("resposta" in guarda) return guarda.resposta;

  const { sistema: id } = await params;
  const alvo = sistemaOuErro(id);
  if ("resposta" in alvo) return alvo.resposta;

  try {
    return NextResponse.json({ ...paraTela(alvo.sistema), ...(await resumoDoSistema(alvo.sistema)) });
  } catch (e) {
    return falha(`sistema ${id}`, e);
  }
}
