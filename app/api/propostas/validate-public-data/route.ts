import { NextRequest, NextResponse } from "next/server";
import { buildPropostaPrefillMunicipioData } from "@/core/lib/propostas-prefill";
import { saveStoredMunicipalityPublicValidation } from "@/core/lib/propostas-public-history";
import { validateMunicipioPublicDataWithAi } from "@/core/lib/propostas-public-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ValidatePublicDataRequestBody {
  codigo_ibge?: string;
  nome?: string;
  uf?: string;
  exercicio?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ValidatePublicDataRequestBody;
    const hasCodigoIbge = Boolean(body.codigo_ibge?.trim());
    const hasNomeUf = Boolean(body.nome?.trim() && body.uf?.trim());

    if (!hasCodigoIbge && !hasNomeUf) {
      return NextResponse.json(
        { error: "Informe codigo_ibge ou o par nome/uf para validar os dados publicos." },
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

    const municipality = await validateMunicipioPublicDataWithAi({
      codigoIbge: data.autofill.codigoIbge,
      municipioNome: data.autofill.municipioNome,
      municipioUf: data.autofill.municipioUf,
      estadoNome: data.autofill.estadoNome,
      nomeAutoridade: data.authorityName,
      partidoAutoridade: data.authorityParty,
    });

    try {
      await saveStoredMunicipalityPublicValidation(municipality);
    } catch (historyError) {
      console.error(
        "[Propostas validate-public-data] Falha ao salvar historico institucional:",
        historyError,
      );
    }

    return NextResponse.json({
      success: true,
      data: municipality,
    });
  } catch (error) {
    console.error("[Propostas validate-public-data] Erro:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao validar os dados publicos." },
      { status: 500 },
    );
  }
}
