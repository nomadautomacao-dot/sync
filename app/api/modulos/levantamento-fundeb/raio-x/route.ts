import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { buildGoviaMunicipioCompleto } from "@/core/lib/govia-compat";
import { buildMunicipalProfile } from "@/core/lib/municipal-profile";
import { markGoviaMunicipioAccess } from "@/core/lib/govia-storage";
import { generateMunicipalXrayPdf } from "@/core/lib/municipal-xray-pdf";
import { generateMunicipalXrayHtml, mapMunicipalXrayModel } from "@/core/lib/municipal-xray-template";
import { fetchMunicipalBoundary } from "@/core/lib/ibge-municipal-boundary";

export const maxDuration = 300;

interface MunicipalXrayRequest {
  codigo_ibge?: string;
  nome?: string;
  uf?: string;
  exercicio?: number;
  response_format?: "pdf" | "bundle";
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
    // O Perfil Municipal fala com bases que nada têm a ver com o FUNDEB
    // (Censo, CNES, CAGED, CadÚnico, MUNIC), então roda junto com os dois
    // exercícios em vez de esperar por eles.
    const [currentResult, baseResult, profileResult, boundaryResult] = await Promise.allSettled([
      buildGoviaMunicipioCompleto({ ...identifier, exercicio: currentYear }),
      buildGoviaMunicipioCompleto({ ...identifier, exercicio: baseYear }),
      buildMunicipalProfile({
        codigoIbge: body.codigo_ibge ?? "",
        uf: body.uf ?? "",
        municipio: body.nome ?? "",
      }),
      hasCodigo
        ? fetchMunicipalBoundary(body.codigo_ibge!.trim())
        : Promise.resolve(null),
    ]);
    const current = currentResult.status === "fulfilled" ? currentResult.value : null;
    if (!current) {
      const reason = currentResult.status === "rejected" && currentResult.reason instanceof Error
        ? currentResult.reason.message
        : "Município não encontrado.";
      return NextResponse.json({ error: reason }, { status: 404 });
    }
    const base = baseResult.status === "fulfilled" ? baseResult.value : null;
    const boundary = boundaryResult.status === "fulfilled" && boundaryResult.value
      ? boundaryResult.value
      : !hasCodigo
        ? await fetchMunicipalBoundary(current.payload.dados_basicos.codigo_ibge)
        : null;

    await markGoviaMunicipioAccess({
      codigo_ibge: current.payload.dados_basicos.codigo_ibge,
      nome: current.payload.dados_basicos.nome,
      uf: current.payload.dados_basicos.uf,
      regiao: current.payload.dados_basicos.regiao,
    });

    const profile =
      profileResult.status === "fulfilled" ? profileResult.value : null;
    const model = mapMunicipalXrayModel({
      basePayload: base?.payload ?? {},
      currentPayload: current.payload,
      baseYear,
      currentYear,
      profile,
      boundary,
    });
    const html = generateMunicipalXrayHtml(model);
    const municipalitySlug = `${slug(model.municipality)}_${slug(model.uf)}_${baseYear}_${currentYear}`;
    const { pdfBuffer, filename } = await generateMunicipalXrayPdf(html, municipalitySlug);

    if (body.response_format === "bundle") {
      const generatedAt = model.generatedAt.toISOString();
      return NextResponse.json(
        {
          schemaVersion: 1,
          fileName: filename,
          mimeType: "application/pdf",
          pdfBase64: pdfBuffer.toString("base64"),
          archive: {
            schemaVersion: 1,
            generationId: randomUUID(),
            reportType: "raio_x",
            generatedAt,
            exercise: currentYear,
            municipality: {
              name: model.municipality,
              uf: model.uf,
              codigoIbge: model.ibgeCode,
            },
            data: {
              primary: current,
              context: {
                baseYear,
                currentYear,
                baseReport: base,
                municipalProfile: profile,
                xrayModel: model,
              },
            },
          },
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

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
