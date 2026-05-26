import { NextRequest, NextResponse } from "next/server";
import { buildGoviaMunicipioCompleto } from "@/core/lib/govia-compat";
import { buildContratoFromLevantamento, gerarContratoMarkdown } from "@/modules/contrato-fundeb/services/contrato-fundeb-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const municipioNome = (body.municipioNome || "").trim();
    const codigoIbge = (body.codigoIbge || "").trim();
    const uf = (body.uf || "").trim();
    const exercicio = Number(body.exercicio) || new Date().getFullYear();

    if (!municipioNome && !codigoIbge) {
      return NextResponse.json(
        { error: "Informe o nome do município ou o código IBGE." },
        { status: 400 },
      );
    }

    const govioPayload = codigoIbge
      ? { codigo_ibge: codigoIbge, exercicio }
      : { nome: municipioNome, uf: uf.toUpperCase(), exercicio };

    const govioData = await buildGoviaMunicipioCompleto(govioPayload);

    if (!govioData?.relatorio) {
      return NextResponse.json(
        { error: "Município não encontrado na base do Sync." },
        { status: 404 },
      );
    }

    const { contrato } = buildContratoFromLevantamento(govioData.relatorio, {
      valorMensal: body.valorMensal ? Number(body.valorMensal) : undefined,
      quantidadeMeses: body.quantidadeMeses ? Number(body.quantidadeMeses) : undefined,
      dataAssinatura: body.dataAssinatura || undefined,
      contratoNumero: body.contratoNumero || undefined,
      processoNumero: body.processoNumero || undefined,
    });

    const markdown = gerarContratoMarkdown(contrato);
    const filename = `Contrato_FUNDEB_${contrato.contratante.municipioNome.replace(/\s+/g, "_")}.md`;

    return new NextResponse(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown;charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error) {
    console.error("Erro ao gerar markdown do contrato:", error);
    return NextResponse.json(
      { error: "Falha ao gerar o contrato em markdown." },
      { status: 500 },
    );
  }
}
