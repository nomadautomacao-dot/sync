import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/core/lib/auth";
import { podeVer } from "@/core/domain/rbac";
import { listarProspeccaoVaat } from "@/core/lib/fundeb-prospeccao-vaat";
import { registrarErro } from "@/core/lib/structured-log";

/**
 * Prospecção pelo VAAT — os municípios habilitados acima do piso, ordenados
 * pelo tempo até entrar na faixa. Ver `core/lib/fundeb-prospeccao-vaat.ts`.
 *
 * Só dataset local; não vai à rede. Lista comercial, por isso exige a área de
 * Pipeline — a mesma régua que esconde o bloco comercial da ficha da cidade.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  if (!podeVer(user.permissoes, "pipeline")) {
    return NextResponse.json({ error: "A prospecção exige acesso ao Pipeline." }, { status: 403 });
  }

  const exercicio = Number(new URL(request.url).searchParams.get("exercicio") ?? 2026);
  if (!Number.isInteger(exercicio) || exercicio < 2024 || exercicio > 2030) {
    return NextResponse.json({ error: "Exercício inválido." }, { status: 400 });
  }

  try {
    const prospeccao = await listarProspeccaoVaat(exercicio);
    if (!prospeccao) {
      return NextResponse.json({ error: `Sem a portaria do VAAT de ${exercicio} na base.` }, { status: 404 });
    }
    return NextResponse.json(prospeccao, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch (error) {
    registrarErro("Prospecção VAAT", error, { exercicio });
    return NextResponse.json({ error: "Falha ao montar a prospecção." }, { status: 500 });
  }
}
