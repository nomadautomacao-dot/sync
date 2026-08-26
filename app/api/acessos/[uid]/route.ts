import { NextResponse } from "next/server";

import { getSessionUser } from "@/core/lib/auth";
import { firebaseAuth } from "@/core/lib/firebase-admin";
import { registrarAcesso } from "@/core/lib/acessos-registro";
import { registrarErro } from "@/core/lib/structured-log";
import {
  claimsCabem,
  claimsDeAcesso,
  mesclarClaims,
  normalizarPapel,
  podeAtribuirPapel,
  usuariaDoRegistro,
  validarAlvo,
  type RegistroFirebase,
} from "@/core/lib/acessos";
import {
  CLAIM_PERMISSOES,
  ajustesDaClaim,
  permissoesEfetivas,
  podeAdministrarAcessos,
} from "@/core/domain/rbac";

type Contexto = { params: Promise<{ uid: string }> };

function naoAutorizada() {
  return NextResponse.json(
    { error: "Sem permissão para administrar acessos.", code: "FORBIDDEN" },
    { status: 403 },
  );
}

/**
 * Edita papel, permissões e situação de uma usuária do grupo.
 *
 * A conferência de que o alvo pertence ao mesmo grupo é o que impede que um
 * uid colado à mão alcance usuária de outro produto Global — o Auth é um só do
 * projeto, e sem essa checagem esta rota seria um caminho para mexer em conta
 * que não é daqui.
 */
export async function PATCH(request: Request, contexto: Contexto) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!podeAdministrarAcessos(sessionUser.groupRole)) return naoAutorizada();

  const { uid } = await contexto.params;
  const corpo = (await request.json().catch(() => null)) as {
    groupRole?: unknown;
    permissoes?: unknown;
    desativada?: unknown;
  } | null;

  try {
    const auth = firebaseAuth();
    const registro = await auth.getUser(uid).catch(() => null);
    if (!registro || registro.customClaims?.groupId !== sessionUser.groupId) {
      return NextResponse.json(
        { error: "Usuária não encontrada neste grupo.", code: "NAO_ENCONTRADA" },
        { status: 404 },
      );
    }

    const papel =
      corpo?.groupRole === undefined
        ? normalizarPapel(registro.customClaims?.groupRole)
        : normalizarPapel(corpo.groupRole);
    const desativar =
      typeof corpo?.desativada === "boolean" ? corpo.desativada : undefined;

    if (!podeAtribuirPapel(sessionUser.groupRole, papel)) {
      return NextResponse.json(
        { error: "Só a dona do grupo concede o papel de dona.", code: "PAPEL_NEGADO" },
        { status: 403 },
      );
    }

    const { erro } = validarAlvo(sessionUser.id, uid, { papel, desativar });
    if (erro) {
      return NextResponse.json({ error: erro, code: "ALVO_INVALIDO" }, { status: 400 });
    }

    const permissoes = permissoesEfetivas(
      papel,
      corpo?.permissoes === undefined
        ? ajustesDaClaim(registro.customClaims?.[CLAIM_PERMISSOES])
        : ajustesDaClaim(corpo.permissoes),
    );

    const claims = mesclarClaims(
      registro.customClaims,
      claimsDeAcesso(sessionUser.groupId, papel, permissoes),
    );
    if (!claimsCabem(claims)) {
      return NextResponse.json(
        { error: "As permissões não cabem no limite de claims.", code: "CLAIMS_GRANDES" },
        { status: 400 },
      );
    }

    await auth.setCustomUserClaims(uid, claims);
    if (desativar !== undefined) await auth.updateUser(uid, { disabled: desativar });

    const papelAnterior = normalizarPapel(registro.customClaims?.groupRole);
    await registrarAcesso({
      groupId: sessionUser.groupId,
      atorUid: sessionUser.id,
      atorEmail: sessionUser.email,
      acao:
        desativar === true
          ? "acesso.desativado"
          : desativar === false
            ? "acesso.reativado"
            : "acesso.editado",
      alvo: uid,
      detalhe:
        desativar !== undefined
          ? `${registro.email ?? uid} ${desativar ? "desativada" : "reativada"}.`
          : papelAnterior === papel
            ? `Permissões de ${registro.email ?? uid} ajustadas.`
            : `Papel de ${registro.email ?? uid}: ${papelAnterior} → ${papel}.`,
    });

    const atualizado = await auth.getUser(uid);
    return NextResponse.json({
      usuaria: usuariaDoRegistro(atualizado as unknown as RegistroFirebase),
      // As claims novas só valem no próximo token. Quem edita precisa saber
      // disso para não achar que a mudança não pegou.
      avisoDeToken: "A mudança vale quando ela entrar de novo no sistema.",
    });
  } catch (error) {
    registrarErro("Edição de acesso", error, { groupId: sessionUser.groupId, uid });
    return NextResponse.json(
      { error: "Não foi possível salvar o acesso.", code: "ACESSO_UPDATE_ERROR" },
      { status: 500 },
    );
  }
}

/**
 * Gera um novo link para a usuária definir a senha dela.
 *
 * Não existe rota que grave senha: nem a administradora nem este servidor
 * chegam a ver a que ela vai usar.
 */
export async function POST(_request: Request, contexto: Contexto) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!podeAdministrarAcessos(sessionUser.groupRole)) return naoAutorizada();

  const { uid } = await contexto.params;

  try {
    const auth = firebaseAuth();
    const registro = await auth.getUser(uid).catch(() => null);
    if (!registro?.email || registro.customClaims?.groupId !== sessionUser.groupId) {
      return NextResponse.json(
        { error: "Usuária não encontrada neste grupo.", code: "NAO_ENCONTRADA" },
        { status: 404 },
      );
    }

    await registrarAcesso({
      groupId: sessionUser.groupId,
      atorUid: sessionUser.id,
      atorEmail: sessionUser.email,
      acao: "acesso.link_de_senha_reenviado",
      alvo: uid,
      // O link em si nunca entra no detalhe — ver a nota no topo do lib.
      detalhe: `Novo link de definição de senha gerado para ${registro.email}.`,
    });

    return NextResponse.json({
      linkDeSenha: await auth.generatePasswordResetLink(registro.email),
    });
  } catch (error) {
    registrarErro("Link de senha", error, { groupId: sessionUser.groupId, uid });
    return NextResponse.json(
      { error: "Não foi possível gerar o link.", code: "LINK_SENHA_ERROR" },
      { status: 500 },
    );
  }
}
