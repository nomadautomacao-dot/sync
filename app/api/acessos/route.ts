import { NextResponse } from "next/server";

import { getSessionUser } from "@/core/lib/auth";
import { firebaseAuth } from "@/core/lib/firebase-admin";
import { registrarAcesso } from "@/core/lib/acessos-registro";
import { registrarErro } from "@/core/lib/structured-log";
import {
  claimsCabem,
  claimsDeAcesso,
  doGrupo,
  mesclarClaims,
  normalizarEmail,
  normalizarPapel,
  podeAtribuirPapel,
  podeVincularAoGrupo,
  usuariaDoRegistro,
  type RegistroFirebase,
} from "@/core/lib/acessos";
import {
  ajustesDaClaim,
  permissoesEfetivas,
  podeAdministrarAcessos,
} from "@/core/domain/rbac";

/**
 * Quem pode ver e conceder acesso.
 *
 * O Admin SDK vive aqui e em nenhum outro lugar do caminho: as rules do
 * Firestore leem o token, e nenhum SDK do cliente consegue escrever custom
 * claim. Um console em SPA precisaria de um servidor só para esta parte — este
 * é o servidor.
 */

function naoAutorizada() {
  return NextResponse.json(
    { error: "Sem permissão para administrar acessos.", code: "FORBIDDEN" },
    { status: 403 },
  );
}

/** O Auth não consulta por claim: lista tudo e filtra pelo groupId. */
async function registrosDoGrupo(groupId: string): Promise<RegistroFirebase[]> {
  const auth = firebaseAuth();
  const encontrados: RegistroFirebase[] = [];
  let pageToken: string | undefined;

  do {
    const pagina = await auth.listUsers(1000, pageToken);
    encontrados.push(...(pagina.users as unknown as RegistroFirebase[]));
    pageToken = pagina.pageToken;
  } while (pageToken);

  return doGrupo(encontrados, groupId);
}

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!podeAdministrarAcessos(sessionUser.groupRole)) return naoAutorizada();

  try {
    const registros = await registrosDoGrupo(sessionUser.groupId);
    const usuarias = registros
      .map(usuariaDoRegistro)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    return NextResponse.json({ usuarias });
  } catch (error) {
    registrarErro("Listagem de acessos", error, { groupId: sessionUser.groupId });
    return NextResponse.json(
      { error: "Não foi possível listar os acessos.", code: "ACESSOS_LIST_ERROR" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!podeAdministrarAcessos(sessionUser.groupRole)) return naoAutorizada();

  const corpo = (await request.json().catch(() => null)) as {
    email?: unknown;
    nome?: unknown;
    groupRole?: unknown;
    permissoes?: unknown;
  } | null;

  const email = normalizarEmail(corpo?.email);
  if (!email) {
    return NextResponse.json(
      { error: "E-mail inválido.", code: "EMAIL_INVALIDO" },
      { status: 400 },
    );
  }

  const papel = normalizarPapel(corpo?.groupRole);
  if (!podeAtribuirPapel(sessionUser.groupRole, papel)) {
    return NextResponse.json(
      { error: "Só a dona do grupo concede o papel de dona.", code: "PAPEL_NEGADO" },
      { status: 403 },
    );
  }

  const nome = typeof corpo?.nome === "string" ? corpo.nome.trim() : "";
  const permissoes = permissoesEfetivas(papel, ajustesDaClaim(corpo?.permissoes));

  try {
    const auth = firebaseAuth();

    // Conta preexistente não tem a senha tocada: procura antes de criar. A
    // mesma pessoa pode já ter conta por outro produto Global.
    const existente = await auth.getUserByEmail(email).catch(() => null);

    const vinculo = podeVincularAoGrupo(existente?.customClaims, sessionUser.groupId);
    if (!vinculo.permitido) {
      return NextResponse.json(
        { error: vinculo.motivo, code: "CONTA_DE_OUTRO_GRUPO" },
        { status: 409 },
      );
    }

    const registro =
      existente ??
      (await auth.createUser({
        email,
        displayName: nome || undefined,
        // Sem senha de propósito. Quem define é ela, pelo link abaixo — assim
        // a senha não passa por esta rota, nem pelo log, nem por quem cadastra.
        emailVerified: false,
      }));

    if (existente && nome && existente.displayName !== nome) {
      await auth.updateUser(registro.uid, { displayName: nome });
    }

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
    await auth.setCustomUserClaims(registro.uid, claims);

    const linkDeSenha = await auth.generatePasswordResetLink(email);
    const atualizado = await auth.getUser(registro.uid);

    await registrarAcesso({
      groupId: sessionUser.groupId,
      atorUid: sessionUser.id,
      atorEmail: sessionUser.email,
      acao: "acesso.concedido",
      alvo: registro.uid,
      // O link de senha nunca entra no detalhe — ver a nota no topo do lib.
      detalhe: `${email} entrou como ${papel}${existente ? " (conta já existia)" : ""}.`,
    });

    return NextResponse.json({
      usuaria: usuariaDoRegistro(atualizado as unknown as RegistroFirebase),
      jaExistia: Boolean(existente),
      linkDeSenha,
    });
  } catch (error) {
    registrarErro("Provisionamento de acesso", error, {
      groupId: sessionUser.groupId,
      papel,
    });
    return NextResponse.json(
      { error: "Não foi possível conceder o acesso.", code: "ACESSO_CREATE_ERROR" },
      { status: 500 },
    );
  }
}
