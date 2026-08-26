/**
 * POST /api/modulos/contratos/proposta-dispensa
 *
 * Gera a Proposta Comercial (contratação direta por dispensa, Art. 75 da
 * Lei 14.133/21) em DOCX, a partir do modelo do dono. Exige sessão: ao
 * contrário das rotas de relatório — que o smoke test emite sem login — esta
 * peça carrega valores comerciais e sai em nome da empresa.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/core/lib/auth";
import { registrarErro } from "@/core/lib/structured-log";
import {
  SERVICOS_PADRAO,
  type PropostaDispensa,
} from "@/modules/contratos/proposta-dispensa";
import { gerarPropostaDispensaDocx } from "@/modules/contratos/proposta-dispensa-docx";

const esquema = z.object({
  municipioNome: z.string().trim().min(2),
  municipioUf: z.string().trim().length(2),
  prazoMeses: z.number().int().min(1).max(60),
  valorMensalCents: z.number().int().min(1),
  // A via do processo; ausente, a peça sai como dispensa (o caso comum).
  via: z.enum(["dispensa", "inexigibilidade"]).optional(),
});

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let entrada: z.infer<typeof esquema>;
  try {
    entrada = esquema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Dados da proposta inválidos." },
      { status: 400 },
    );
  }

  try {
    const proposta: PropostaDispensa = {
      ...entrada,
      emitidaEm: new Date().toISOString().slice(0, 10),
      itens: SERVICOS_PADRAO,
    };
    const buffer = await gerarPropostaDispensaDocx(proposta);

    const slug = entrada.municipioNome
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_");

    // `Buffer` do Node não é corpo válido para a Web API; a view sobre os
    // mesmos bytes é, e não copia nada.
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="Proposta_Comercial_${slug}.docx"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error) {
    registrarErro("api/modulos/contratos/proposta-dispensa", error, {
      municipio: entrada.municipioNome,
      uf: entrada.municipioUf,
    });
    return NextResponse.json(
      { error: "Falha ao gerar a proposta." },
      { status: 500 },
    );
  }
}
