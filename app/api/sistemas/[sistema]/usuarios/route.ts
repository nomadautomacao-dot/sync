import { NextResponse, type NextRequest } from "next/server";

import { novoUsuarioSchema, papelDoSistema, validarContraCatalogo } from "@/core/domain/sistemas";
import { listarUsuarios, provisionarUsuario } from "@/core/lib/sistemas-admin";
import { corpo, erro, falha, operador, sistemaOuErro } from "@/core/lib/sistemas-http";
import { registrarNoConsole } from "@/core/lib/sistemas-registro";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sistema: string }> },
) {
  const guarda = await operador();
  if ("resposta" in guarda) return guarda.resposta;

  const { sistema: id } = await params;
  const alvo = sistemaOuErro(id);
  if ("resposta" in alvo) return alvo.resposta;

  const prefeitura = request.nextUrl.searchParams.get("prefeitura") ?? undefined;

  try {
    return NextResponse.json({ usuarios: await listarUsuarios(alvo.sistema, { prefeitura }) });
  } catch (e) {
    return falha(`usuários de ${id}`, e);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ sistema: string }> }) {
  const guarda = await operador();
  if ("resposta" in guarda) return guarda.resposta;

  const { sistema: id } = await params;
  const alvo = sistemaOuErro(id);
  if ("resposta" in alvo) return alvo.resposta;

  const entrada = await corpo(request, novoUsuarioSchema);
  if ("resposta" in entrada) return entrada.resposta;

  const invalido = validarContraCatalogo(alvo.sistema, { papel: entrada.dados.papel });
  if (invalido) return erro(400, "PAPEL_INVALIDO", invalido);

  try {
    const r = await provisionarUsuario(alvo.sistema, entrada.dados);
    const papel = papelDoSistema(alvo.sistema, entrada.dados.papel);

    await registrarNoConsole({
      groupId: guarda.operador.groupId,
      atorUid: guarda.operador.id,
      atorEmail: guarda.operador.email,
      sistemaId: alvo.sistema.id,
      acao: "usuario.provisionado",
      alvo: r.usuario.id,
      // O link de definição de senha **não** entra no registro: quem lê o log
      // passaria a poder assumir a conta.
      detalhe:
        `${entrada.dados.email} — ${papel?.rotulo ?? entrada.dados.papel} em ` +
        `${entrada.dados.prefeitura}. ${r.contaNova ? "Conta criada." : "Conta já existia no projeto e foi vinculada."}`,
    });

    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    return falha(`provisionar usuário em ${id}`, e);
  }
}
