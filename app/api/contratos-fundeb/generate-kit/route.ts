/**
 * API Route: POST /api/contratos-fundeb/generate-kit
 *
 * Gera o kit completo de 14 documentos DOCX em formato ZIP.
 * Aceita dois modos:
 *   1. Dados completos (ContratosFundebData) → gera o ZIP imediatamente
 *   2. Município + UF → executa o agente IA + gera o ZIP
 *
 * Body modo 1 (dados diretos):
 *   { "contrato": { ...ContratosFundebData } }
 *
 * Body modo 2 (agente + geração):
 *   { "municipioNome": "Barreiras", "uf": "BA", ... }
 *
 * Response: application/zip (download do arquivo)
 */

import { NextRequest, NextResponse } from "next/server";
import { executeContratoAgent } from "@/modules/contrato-fundeb/services/contrato-agent";
import { gerarKitContratoZip } from "@/modules/contrato-fundeb/services/contrato-docx-generator";
import type { ContratosFundebData } from "@/modules/contrato-fundeb/types";
import { registrarErro } from "@/core/lib/structured-log";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    let contratoData: ContratosFundebData;

    if (body.contrato) {
      // Modo 1: Dados diretos fornecidos
      contratoData = body.contrato as ContratosFundebData;
    } else if (body.municipioNome && body.uf) {
      // Modo 2: Executar o agente primeiro
      const agentResult = await executeContratoAgent({
        municipioNome: body.municipioNome,
        uf: body.uf,
        codigoIBGE: body.codigoIBGE,
        exercicio: body.exercicio,
        valorMensal: body.valorMensal,
        quantidadeMeses: body.quantidadeMeses,
        skipGemini: body.skipGemini ?? false,
      });

      if (!agentResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: "Agente não conseguiu resolver o município.",
            warnings: agentResult.warnings,
          },
          { status: 404 },
        );
      }

      contratoData = agentResult.contrato;
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "Forneça 'contrato' (dados diretos) ou 'municipioNome' + 'uf' (modo agente).",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    // Gerar o ZIP com 14 DOCXs
    const zipBuffer = await gerarKitContratoZip(contratoData);

    const nomeArquivo = `Kit_Inexigibilidade_FUNDEB_${(contratoData.municipioNome || "municipio")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_")
      .toLowerCase()}.zip`;

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
        "Content-Length": String(zipBuffer.length),
      },
    });
  } catch (error) {
    registrarErro("api/contratos-fundeb/generate-kit", error);
    return NextResponse.json(
      {
        success: false,
        error: "Falha ao gerar o kit de contratos.",
        details: error instanceof Error ? error.message : "Erro desconhecido",
        code: "KIT_GENERATION_ERROR",
      },
      { status: 500 },
    );
  }
}
