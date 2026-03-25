import { NextRequest, NextResponse } from "next/server";
import { buildPropostaPrefillMunicipioData } from "@/core/lib/propostas-prefill";
import { getStoredMunicipalityPublicValidation } from "@/core/lib/propostas-public-history";
import type { PropostaAutofillData } from "@/modules/propostas/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PrefillRequestBody {
  codigo_ibge?: string;
  nome?: string;
  uf?: string;
  exercicio?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PrefillRequestBody;
    const hasCodigoIbge = Boolean(body.codigo_ibge?.trim());
    const hasNomeUf = Boolean(body.nome?.trim() && body.uf?.trim());

    if (!hasCodigoIbge && !hasNomeUf) {
      return NextResponse.json(
        { error: "Informe codigo_ibge ou o par nome/uf para preencher a proposta." },
        { status: 400 },
      );
    }

    const data = await buildPropostaPrefillMunicipioData({
      codigo_ibge: body.codigo_ibge,
      nome: body.nome,
      uf: body.uf,
      exercicio: body.exercicio,
    });

    if (!data) {
      return NextResponse.json({ error: "Municipio nao encontrado." }, { status: 404 });
    }

    let publicValidation: PropostaAutofillData["publicValidation"] = null;

    try {
      publicValidation = await getStoredMunicipalityPublicValidation(
        data.autofill.codigoIbge,
      );
    } catch (historyError) {
      console.error("[Propostas prefill] Historico institucional indisponivel:", historyError);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...data.autofill,
        publicValidation,
        publicValidationSource: publicValidation ? "history" : "none",
      } satisfies PropostaAutofillData,
    });
  } catch (error) {
    console.error("[Propostas prefill] Erro:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao montar os dados da proposta." },
      { status: 500 },
    );
  }
}
