import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { buildGoviaMunicipioCompleto } from "@/core/lib/govia-compat";
import { buildMunicipalProfile } from "@/core/lib/municipal-profile";
import { markGoviaMunicipioAccess } from "@/core/lib/govia-storage";
import { generateOficioDocumentosPdf } from "@/core/lib/oficio-documentos-pdf";
import {
  generateOficioDocumentosHtml,
  RESPONSAVEL_PADRAO,
} from "@/core/lib/oficio-documentos-template";
import { mapMunicipalXrayModel } from "@/core/lib/municipal-xray-template";

export const maxDuration = 300;

interface OficioRequest {
  codigo_ibge?: string;
  nome?: string;
  uf?: string;
  exercicio?: number;
  /** Numeração do ofício, controle do escritório. Ex.: "014/2026". */
  numero?: string;
  prazo_dias?: number;
  response_format?: "pdf" | "bundle";
}

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as OficioRequest;
    const hasCodigo = Boolean(body.codigo_ibge?.trim());
    const hasNameAndUf = Boolean(body.nome?.trim() && body.uf?.trim());
    if (!hasCodigo && !hasNameAndUf) {
      return NextResponse.json(
        { error: "Informe codigo_ibge ou o par nome/uf para gerar o ofício." },
        { status: 400 },
      );
    }

    const currentYear =
      body.exercicio && body.exercicio > 2000 ? body.exercicio : new Date().getFullYear();
    const baseYear = currentYear - 1;
    const identifier = { codigo_ibge: body.codigo_ibge, nome: body.nome, uf: body.uf };

    // O ofício não desenha mapa, então dispensa a malha do IBGE. O Perfil
    // Municipal entra porque os contextos do questionário citam a MUNIC.
    const [currentResult, profileResult] = await Promise.allSettled([
      buildGoviaMunicipioCompleto({ ...identifier, exercicio: currentYear }),
      buildMunicipalProfile({
        codigoIbge: body.codigo_ibge ?? "",
        uf: body.uf ?? "",
        municipio: body.nome ?? "",
      }),
    ]);

    const current = currentResult.status === "fulfilled" ? currentResult.value : null;
    if (!current) {
      const reason =
        currentResult.status === "rejected" && currentResult.reason instanceof Error
          ? currentResult.reason.message
          : "Município não encontrado.";
      return NextResponse.json({ error: reason }, { status: 404 });
    }

    await markGoviaMunicipioAccess({
      codigo_ibge: current.payload.dados_basicos.codigo_ibge,
      nome: current.payload.dados_basicos.nome,
      uf: current.payload.dados_basicos.uf,
      regiao: current.payload.dados_basicos.regiao,
    });

    const profile = profileResult.status === "fulfilled" ? profileResult.value : null;
    const model = mapMunicipalXrayModel({
      basePayload: {},
      currentPayload: current.payload,
      baseYear,
      currentYear,
      profile,
    });

    const emitidoEm = model.generatedAt;
    const params = {
      // Sem numeração informada, cai em 001 do ano corrente — o escritório
      // sobrescreve pelo campo da tela quando mantém sequência própria.
      numero: body.numero?.trim() || `001/${emitidoEm.getFullYear()}`,
      prazoDias: body.prazo_dias && body.prazo_dias > 0 ? body.prazo_dias : 3,
      emitidoEm,
      responsavel: RESPONSAVEL_PADRAO,
      // A base pedida é a do último Censo publicado; sem ela, o exercício
      // anterior é o palpite correto (o Censo do ano corrente ainda não fechou).
      anoCenso: model.enrollmentYear ?? baseYear,
    };

    const html = generateOficioDocumentosHtml(model, params);
    const municipalitySlug = `${slug(model.municipality)}_${slug(model.uf)}`;
    const { pdfBuffer, filename } = await generateOficioDocumentosPdf(html, municipalitySlug);

    if (body.response_format === "bundle") {
      return NextResponse.json(
        {
          schemaVersion: 1,
          fileName: filename,
          mimeType: "application/pdf",
          pdfBase64: pdfBuffer.toString("base64"),
          archive: {
            schemaVersion: 1,
            generationId: randomUUID(),
            reportType: "oficio_documentos",
            generatedAt: emitidoEm.toISOString(),
            exercise: currentYear,
            municipality: {
              name: model.municipality,
              uf: model.uf,
              codigoIbge: model.ibgeCode,
            },
            data: {
              primary: current,
              context: {
                currentYear,
                municipalProfile: profile,
                oficio: { numero: params.numero, prazoDias: params.prazoDias, anoCenso: params.anoCenso },
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
    console.error("[Ofício de documentos] Erro:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao gerar o ofício." },
      { status: 500 },
    );
  }
}
