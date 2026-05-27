/**
 * API Route: POST /api/contratos-fundeb/agent
 *
 * Endpoint do agente de IA para preenchimento autônomo de contratos FUNDEB.
 * Recebe município + UF e retorna todos os dados preenchidos automaticamente.
 *
 * Body:
 *   {
 *     "municipioNome": "Barreiras",
 *     "uf": "BA",
 *     "exercicio": 2026,         // opcional, padrão: ano atual
 *     "valorMensal": 27500,      // opcional, padrão: 27.500
 *     "quantidadeMeses": 12,     // opcional, padrão: 12
 *     "skipGemini": false         // opcional, pula busca IA
 *   }
 *
 * Response:
 *   {
 *     "success": true,
 *     "contrato": { ...ContratosFundebData },
 *     "metas": [ ...campo status ],
 *     "stats": { total, preenchidoAutomatico, preenchidoIA, vazio, percentual },
 *     "warnings": [ ...avisos ],
 *     "tempoExecucaoMs": 12345,
 *     "geminiConfianca": 75
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { executeContratoAgent } from "@/modules/contrato-fundeb/services/contrato-agent";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.municipioNome || !body.uf) {
      return NextResponse.json(
        {
          success: false,
          error: "Campos obrigatórios: municipioNome e uf.",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    const result = await executeContratoAgent({
      municipioNome: body.municipioNome,
      uf: body.uf,
      codigoIBGE: body.codigoIBGE,
      exercicio: body.exercicio,
      valorMensal: body.valorMensal,
      quantidadeMeses: body.quantidadeMeses,
      skipGemini: body.skipGemini ?? false,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/contratos-fundeb/agent] Erro:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Falha ao executar o agente de contratos FUNDEB.",
        details: error instanceof Error ? error.message : "Erro desconhecido",
        code: "AGENT_EXECUTION_ERROR",
      },
      { status: 500 },
    );
  }
}
