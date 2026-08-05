import { NextResponse } from "next/server";

import { edicaoUsuarioSchema, validarContraCatalogo } from "@/core/domain/sistemas";
import { atualizarUsuario, revogarAcesso } from "@/core/lib/sistemas-admin";
import { corpo, erro, falha, operador, sistemaOuErro } from "@/core/lib/sistemas-http";
import { registrarNoConsole } from "@/core/lib/sistemas-registro";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sistema: string; uid: string }> },
) {
  const guarda = await operador();
  if ("resposta" in guarda) return guarda.resposta;

  const { sistema: id, uid } = await params;
  const alvo = sistemaOuErro(id);
  if ("resposta" in alvo) return alvo.resposta;

  const entrada = await corpo(request, edicaoUsuarioSchema);
  if ("resposta" in entrada) return entrada.resposta;

  const invalido = validarContraCatalogo(alvo.sistema, { papel: entrada.dados.papel });
  if (invalido) return erro(400, "PAPEL_INVALIDO", invalido);

  try {
    const usuario = await atualizarUsuario(alvo.sistema, uid, entrada.dados);
    await registrarNoConsole({
      groupId: guarda.operador.groupId,
      atorUid: guarda.operador.id,
      atorEmail: guarda.operador.email,
      sistemaId: alvo.sistema.id,
      acao: "usuario.alterado",
      alvo: uid,
      detalhe: `${usuario.email}: ${resumirPatch(entrada.dados)}`,
    });
    return NextResponse.json(usuario);
  } catch (e) {
    return falha(`alterar usuário ${uid} em ${id}`, e);
  }
}

/**
 * Tira o acesso a **este** produto.
 *
 * Não apaga a conta: ela pode ser a mesma que a pessoa usa no Sync ou em outro
 * produto Global. O que sai são as claims deste sistema e o `ativo` do
 * documento. Apagar conta é operação de console do Firebase, com intenção
 * explícita — não de uma tela de administração de município.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sistema: string; uid: string }> },
) {
  const guarda = await operador();
  if ("resposta" in guarda) return guarda.resposta;

  const { sistema: id, uid } = await params;
  const alvo = sistemaOuErro(id);
  if ("resposta" in alvo) return alvo.resposta;

  try {
    await revogarAcesso(alvo.sistema, uid);
    await registrarNoConsole({
      groupId: guarda.operador.groupId,
      atorUid: guarda.operador.id,
      atorEmail: guarda.operador.email,
      sistemaId: alvo.sistema.id,
      acao: "usuario.acesso_revogado",
      alvo: uid,
      detalhe: `Acesso ao ${alvo.sistema.nome} revogado. A conta e os demais produtos seguem intactos.`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return falha(`revogar acesso de ${uid} em ${id}`, e);
  }
}

function resumirPatch(patch: Record<string, unknown>): string {
  const partes = Object.entries(patch)
    .filter(([, v]) => v !== undefined)
    .map(([campo, valor]) => `${campo} → ${Array.isArray(valor) ? valor.join(", ") : String(valor)}`);
  return partes.length ? partes.join("; ") : "sem alteração";
}
