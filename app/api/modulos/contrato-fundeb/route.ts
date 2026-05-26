import { NextRequest, NextResponse } from "next/server";
import { buildGoviaMunicipioCompleto } from "@/core/lib/govia-compat";
import { buildContratoFromLevantamento } from "@/modules/contrato-fundeb/services/contrato-fundeb-service";
import type { ContratoFundebGenerateResponse } from "@/modules/contrato-fundeb/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const municipioNome = (body.municipioNome || "").trim();
    const codigoIbge = (body.codigoIbge || "").trim();
    const uf = (body.uf || "").trim();
    const exercicio = Number(body.exercicio) || new Date().getFullYear();

    if (!municipioNome && !codigoIbge) {
      return NextResponse.json(
        { success: false, error: "Informe o nome do município ou o código IBGE." } satisfies ContratoFundebGenerateResponse,
        { status: 400 },
      );
    }

    const govioPayload = codigoIbge
      ? { codigo_ibge: codigoIbge, exercicio }
      : { nome: municipioNome, uf: uf.toUpperCase(), exercicio };

    const govioData = await buildGoviaMunicipioCompleto(govioPayload);

    if (!govioData?.relatorio) {
      return NextResponse.json(
        { success: false, error: "Município não encontrado na base do Sync." } satisfies ContratoFundebGenerateResponse,
        { status: 404 },
      );
    }

    const { contrato, metas } = buildContratoFromLevantamento(govioData.relatorio, {
      valorMensal: body.valorMensal ? Number(body.valorMensal) : undefined,
      quantidadeMeses: body.quantidadeMeses ? Number(body.quantidadeMeses) : undefined,
      dataAssinatura: body.dataAssinatura || undefined,
      contratoNumero: body.contratoNumero || undefined,
      processoNumero: body.processoNumero || undefined,
    });

    const warnings = metas
      .filter((m) => m.status === "vazio" || m.status === "indisponivel")
      .map((m) => `Campo "${m.label}" não foi preenchido automaticamente.`);

    return NextResponse.json({
      success: true,
      contrato,
      metas,
      warnings,
    } satisfies ContratoFundebGenerateResponse);
  } catch (error) {
    console.error("Erro ao gerar contrato FUNDEB:", error);
    return NextResponse.json(
      { success: false, error: "Falha ao gerar o contrato." } satisfies ContratoFundebGenerateResponse,
      { status: 500 },
    );
  }
}
