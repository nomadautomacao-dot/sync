/**
 * POST /api/modulos/contrato-fundeb/gerar-proposta
 *
 * Gera a Proposta Técnica e Comercial como DOCX standalone.
 * Separada do Kit ZIP para que possa ser assinada individualmente.
 */
import { NextRequest, NextResponse } from "next/server";
import { gerarPropostaDocx } from "@/modules/contrato-fundeb/services/contrato-docx-generator";
import type { ContratosFundebData } from "@/modules/contrato-fundeb/types";
import { registrarErro } from "@/core/lib/structured-log";

export async function POST(request: NextRequest) {
  try {
    const data = (await request.json()) as ContratosFundebData;

    if (!data.municipioNome) {
      return NextResponse.json(
        { error: "Campo municipioNome é obrigatório." },
        { status: 400 },
      );
    }

    const { buffer, filename } = await gerarPropostaDocx(data);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error) {
    registrarErro("api/modulos/contrato-fundeb/gerar-proposta", error);
    return NextResponse.json(
      { error: "Falha ao gerar a proposta." },
      { status: 500 },
    );
  }
}
