import { NextResponse } from "next/server";

import { edicaoPrefeituraSchema, validarContraCatalogo } from "@/core/domain/sistemas";
import { atualizarPrefeitura } from "@/core/lib/sistemas-admin";
import { corpo, erro, falha, operador, sistemaOuErro } from "@/core/lib/sistemas-http";
import { registrarNoConsole } from "@/core/lib/sistemas-registro";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sistema: string; prefeitura: string }> },
) {
  const guarda = await operador();
  if ("resposta" in guarda) return guarda.resposta;

  const { sistema: id, prefeitura: slug } = await params;
  const alvo = sistemaOuErro(id);
  if ("resposta" in alvo) return alvo.resposta;

  const entrada = await corpo(request, edicaoPrefeituraSchema);
  if ("resposta" in entrada) return entrada.resposta;

  const invalido = validarContraCatalogo(alvo.sistema, { status: entrada.dados.status });
  if (invalido) return erro(400, "STATUS_INVALIDO", invalido);

  try {
    const prefeitura = await atualizarPrefeitura(alvo.sistema, slug, entrada.dados);
    await registrarNoConsole({
      groupId: guarda.operador.groupId,
      atorUid: guarda.operador.id,
      atorEmail: guarda.operador.email,
      sistemaId: alvo.sistema.id,
      acao: "prefeitura.alterada",
      alvo: slug,
      detalhe: descreverMudanca(entrada.dados),
    });
    return NextResponse.json(prefeitura);
  } catch (e) {
    return falha(`alterar prefeitura ${slug} em ${id}`, e);
  }
}

function descreverMudanca(patch: Record<string, unknown>): string {
  const partes = Object.entries(patch)
    .filter(([, v]) => v !== undefined)
    .map(([campo, valor]) => `${campo} → ${String(valor)}`);
  return partes.length ? partes.join(", ") : "sem alteração";
}
