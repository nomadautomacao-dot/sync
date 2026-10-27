import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { buildRelatorioSnapshot } from "@/core/lib/relatorio-snapshot";
import { markGoviaMunicipioAccess } from "@/core/lib/govia-storage";
import { generateMunicipalXrayPdf } from "@/core/lib/municipal-xray-pdf";
import { generateMunicipalXrayHtml, mapMunicipalXrayModel } from "@/core/lib/municipal-xray-template";
import { registrarErro } from "@/core/lib/structured-log";

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
  // Preenchido assim que o corpo é lido, para que o `catch` saiba *de qual
  // município* era o relatório que falhou. Sem isso o erro chega ao Error
  // Reporting como "falhou", sem o que reproduzir.
  const contexto: Record<string, unknown> = { relatorio: "raio-x" };
  try {
    const body = (await request.json()) as MunicipalXrayRequest;
    contexto.codigoIbge = body.codigo_ibge ?? null;
    contexto.municipio = body.nome ?? null;
    contexto.uf = body.uf ?? null;
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
    const snapshot=await buildRelatorioSnapshot({...identifier,exercicio:currentYear});
    const {current,base,profile,boundary}=snapshot;

    await markGoviaMunicipioAccess({
      codigo_ibge: current.payload.dados_basicos.codigo_ibge,
      nome: current.payload.dados_basicos.nome,
      uf: current.payload.dados_basicos.uf,
      regiao: current.payload.dados_basicos.regiao,
    });

    const model = mapMunicipalXrayModel({
      inteligencia: snapshot.inteligencia, qualidade: snapshot.qualidade,
      basePayload: base?.payload ?? {},
      currentPayload: current.payload,
      baseYear,
      currentYear,
      profile,
      boundary,
    });
    const html = generateMunicipalXrayHtml(model);
    const municipalitySlug = `${slug(model.municipality)}_${slug(model.uf)}_${baseYear}_${currentYear}`;
    const { pdfBuffer, filename, ajustadas } = await generateMunicipalXrayPdf(
      html,
      municipalitySlug,
    );

    if (body.response_format === "bundle") {
      const generatedAt = model.generatedAt.toISOString();
      return NextResponse.json(
        {
          schemaVersion: 1,
          fileName: filename,
          mimeType: "application/pdf",
          pdfBase64: pdfBuffer.toString("base64"),
          /**
           * Diagnóstico da geração, não conteúdo do relatório: as páginas que
           * só couberam depois de encolhidas. O smoke test pós-deploy lê isto
           * para alertar quando o template está no limite — corte de verdade
           * já é erro em `assertSemCorte`, mas o auto-ajuste salva em silêncio.
           */
          diagnostics: { paginasAjustadas: ajustadas, paginasEsperadas: Number(html.match(/data-paginas-esperadas="(\d+)"/)?.[1]) },
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
    registrarErro("Raio-X municipal", error, contexto);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao gerar o Raio-X municipal." },
      { status: 500 },
    );
  }
}
