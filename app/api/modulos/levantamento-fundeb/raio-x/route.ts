import { NextRequest, NextResponse } from "next/server";
import { buildGoviaMunicipioCompleto } from "@/core/lib/govia-compat";
import { markGoviaMunicipioAccess } from "@/core/lib/govia-storage";
import { generateMunicipalXrayPdf } from "@/core/lib/municipal-xray-pdf";
import { generateMunicipalXrayHtml, mapMunicipalXrayModel } from "@/core/lib/municipal-xray-template";

export const maxDuration = 300;

interface MunicipalXrayRequest {
  codigo_ibge?: string;
  nome?: string;
  uf?: string;
  exercicio?: number;
}

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MunicipalXrayRequest;
    const hasCodigo = Boolean(body.codigo_ibge?.trim());
    const hasNameAndUf = Boolean(body.nome?.trim() && body.uf?.trim());
    if (!hasCodigo && !hasNameAndUf) {
      return NextResponse.json(
        { error: "Informe codigo_ibge ou o par nome/uf para gerar o Raio-X municipal." },
        { status: 400 },
      );
    }

    const currentYear = body.exercicio && body.exercicio > 2000
      ? body.exercicio
      : new Date().getFullYear();
    const baseYear = currentYear - 1;
    const identifier = {
      codigo_ibge: body.codigo_ibge,
      nome: body.nome,
      uf: body.uf,
    };
    const [currentResult, baseResult] = await Promise.allSettled([
      buildGoviaMunicipioCompleto({ ...identifier, exercicio: currentYear }),
      buildGoviaMunicipioCompleto({ ...identifier, exercicio: baseYear }),
    ]);
    const current = currentResult.status === "fulfilled" ? currentResult.value : null;
    if (!current) {
      const reason = currentResult.status === "rejected" && currentResult.reason instanceof Error
        ? currentResult.reason.message
        : "Município não encontrado.";
      return NextResponse.json({ error: reason }, { status: 404 });
    }
    const base = baseResult.status === "fulfilled" ? baseResult.value : null;

    await markGoviaMunicipioAccess({
      codigo_ibge: current.payload.dados_basicos.codigo_ibge,
      nome: current.payload.dados_basicos.nome,
      uf: current.payload.dados_basicos.uf,
      regiao: current.payload.dados_basicos.regiao,
    });

    const model = mapMunicipalXrayModel({
      basePayload: base?.payload ?? {},
      currentPayload: current.payload,
      baseYear,
      currentYear,
    });
    const html = generateMunicipalXrayHtml(model);
    const municipalitySlug = `${slug(model.municipality)}_${slug(model.uf)}_${baseYear}_${currentYear}`;
    const { pdfBuffer, filename } = await generateMunicipalXrayPdf(html, municipalitySlug);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=${filename}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[Raio-X municipal] Erro:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao gerar o Raio-X municipal." },
      { status: 500 },
    );
  }
}
