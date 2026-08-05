/**
 * Encanamento comum das rotas do console: quem pode entrar, qual sistema,
 * e como um erro vira resposta.
 *
 * A guarda mora aqui e não na tela. Esconder o item da barra lateral é
 * cosmético — qualquer pessoa com sessão válida pode chamar a rota na mão. É
 * esta função que decide.
 */

import { NextResponse } from "next/server";
import type { ZodType } from "zod";

import { podeAdministrarSistemas } from "@/core/domain/rbac";
import { sistemaPorId, type SistemaGlobal } from "@/core/domain/sistemas";
import { getSessionUser, type SessionUser } from "@/core/lib/auth";
import { ErroDoConsole } from "@/core/lib/sistemas-admin";
import { registrarErro } from "@/core/lib/structured-log";

export function erro(status: number, codigo: string, mensagem: string) {
  return NextResponse.json({ error: mensagem, code: codigo }, { status });
}

/**
 * Sessão de quem pode operar o console, ou a resposta que barra.
 * Devolve uma união para que a rota faça `if ("resposta" in guarda) return ...`.
 */
export async function operador(): Promise<
  { operador: SessionUser } | { resposta: NextResponse }
> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return { resposta: erro(401, "UNAUTHORIZED", "Sessão ausente ou expirada.") };
  }
  if (!podeAdministrarSistemas(sessionUser.groupRole)) {
    return {
      resposta: erro(
        403,
        "SEM_PERMISSAO",
        "O console de sistemas é restrito a administradores do grupo.",
      ),
    };
  }
  return { operador: sessionUser };
}

export function sistemaOuErro(
  id: string,
): { sistema: SistemaGlobal } | { resposta: NextResponse } {
  const sistema = sistemaPorId(id);
  if (!sistema) {
    return { resposta: erro(404, "SISTEMA_DESCONHECIDO", `Não existe o sistema "${id}".`) };
  }
  return { sistema };
}

/** Faz o parse do corpo com Zod e devolve a primeira mensagem de erro legível. */
export async function corpo<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ dados: T } | { resposta: NextResponse }> {
  let bruto: unknown;
  try {
    bruto = await request.json();
  } catch {
    return { resposta: erro(400, "CORPO_INVALIDO", "O corpo da requisição não é JSON válido.") };
  }

  const r = schema.safeParse(bruto);
  if (!r.success) {
    const primeira = r.error.issues[0];
    const campo = primeira?.path.join(".");
    return {
      resposta: erro(
        400,
        "VALIDACAO",
        campo ? `${campo}: ${primeira?.message}` : (primeira?.message ?? "Dados inválidos."),
      ),
    };
  }
  return { dados: r.data };
}

/**
 * Traduz a exceção em resposta.
 *
 * `ErroDoConsole` é situação prevista e vai com a mensagem para a tela.
 * Qualquer outra é defeito: vai agrupada para o Error Reporting e devolve um
 * texto genérico — mensagem de erro do Firebase costuma trazer id de projeto e
 * caminho de coleção, que não têm por que aparecer no navegador.
 */
export function falha(contexto: string, e: unknown) {
  if (e instanceof ErroDoConsole) return erro(e.status, e.codigo, e.message);
  registrarErro(`Console de sistemas — ${contexto}`, e);
  return erro(500, "ERRO_INTERNO", "Não foi possível concluir a operação. Tente de novo.");
}
