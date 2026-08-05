import { NextResponse } from "next/server";
import { z } from "zod";

import { gerarLinkDeSenha, ressincronizarClaims } from "@/core/lib/sistemas-admin";
import { corpo, erro, falha, operador, sistemaOuErro } from "@/core/lib/sistemas-http";
import { registrarNoConsole } from "@/core/lib/sistemas-registro";

const acaoSchema = z.object({
  acao: z.enum(["ressincronizar_claims", "link_de_senha"]),
  /** Obrigatório em `link_de_senha`: o link é gerado por e-mail, não por uid. */
  email: z.string().trim().toLowerCase().email().optional(),
});

/**
 * Os dois consertos do dia a dia.
 *
 * `ressincronizar_claims` regrava o token a partir do documento — é a resposta
 * para "entrei e não vejo nada". `link_de_senha` gera o link de definição, que
 * é como a pessoa entra pela primeira vez ou volta de uma senha perdida.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sistema: string; uid: string }> },
) {
  const guarda = await operador();
  if ("resposta" in guarda) return guarda.resposta;

  const { sistema: id, uid } = await params;
  const alvo = sistemaOuErro(id);
  if ("resposta" in alvo) return alvo.resposta;

  const entrada = await corpo(request, acaoSchema);
  if ("resposta" in entrada) return entrada.resposta;

  const trilha = {
    groupId: guarda.operador.groupId,
    atorUid: guarda.operador.id,
    atorEmail: guarda.operador.email,
    sistemaId: alvo.sistema.id,
    alvo: uid,
  };

  try {
    if (entrada.dados.acao === "ressincronizar_claims") {
      const usuario = await ressincronizarClaims(alvo.sistema, uid);
      await registrarNoConsole({
        ...trilha,
        acao: "usuario.claims_ressincronizadas",
        detalhe: `${usuario.email}: token regravado a partir do documento (${usuario.papel} em ${usuario.prefeitura ?? "—"}).`,
      });
      return NextResponse.json(usuario);
    }

    if (!entrada.dados.email) {
      return erro(400, "EMAIL_OBRIGATORIO", "Informe o e-mail da conta para gerar o link.");
    }

    const link = await gerarLinkDeSenha(entrada.dados.email);
    await registrarNoConsole({
      ...trilha,
      acao: "usuario.link_de_senha_gerado",
      // O link em si fica fora do registro — quem lesse o log assumiria a conta.
      detalhe: `Link de definição de senha gerado para ${entrada.dados.email}.`,
    });
    return NextResponse.json({ link });
  } catch (e) {
    return falha(`ação em ${uid} de ${id}`, e);
  }
}
