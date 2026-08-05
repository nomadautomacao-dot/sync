import { NextResponse } from "next/server";

import { novaPrefeituraSchema, validarContraCatalogo } from "@/core/domain/sistemas";
import { criarPrefeitura, listarPrefeituras } from "@/core/lib/sistemas-admin";
import { corpo, erro, falha, operador, sistemaOuErro } from "@/core/lib/sistemas-http";
import { registrarNoConsole } from "@/core/lib/sistemas-registro";

export async function GET(_request: Request, { params }: { params: Promise<{ sistema: string }> }) {
  const guarda = await operador();
  if ("resposta" in guarda) return guarda.resposta;

  const { sistema: id } = await params;
  const alvo = sistemaOuErro(id);
  if ("resposta" in alvo) return alvo.resposta;

  try {
    return NextResponse.json({ prefeituras: await listarPrefeituras(alvo.sistema) });
  } catch (e) {
    return falha(`prefeituras de ${id}`, e);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ sistema: string }> }) {
  const guarda = await operador();
  if ("resposta" in guarda) return guarda.resposta;

  const { sistema: id } = await params;
  const alvo = sistemaOuErro(id);
  if ("resposta" in alvo) return alvo.resposta;

  const entrada = await corpo(request, novaPrefeituraSchema);
  if ("resposta" in entrada) return entrada.resposta;

  const invalido = validarContraCatalogo(alvo.sistema, { status: entrada.dados.status });
  if (invalido) return erro(400, "STATUS_INVALIDO", invalido);

  try {
    const prefeitura = await criarPrefeitura(alvo.sistema, entrada.dados);
    await registrarNoConsole({
      groupId: guarda.operador.groupId,
      atorUid: guarda.operador.id,
      atorEmail: guarda.operador.email,
      sistemaId: alvo.sistema.id,
      acao: "prefeitura.criada",
      alvo: prefeitura.slug,
      detalhe: `${prefeitura.nome}/${prefeitura.uf} criada com status "${prefeitura.status}".`,
    });
    return NextResponse.json(prefeitura, { status: 201 });
  } catch (e) {
    return falha(`criar prefeitura em ${id}`, e);
  }
}
