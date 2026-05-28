import { NextRequest, NextResponse } from "next/server";
import { buildFundebComparativeSnapshot } from "@/core/lib/fundeb-comparative";
import { buildGoviaMunicipioCompleto } from "@/core/lib/govia-compat";
import { markGoviaMunicipioAccess } from "@/core/lib/govia-storage";
import { generateFundebPdfBuffer, isFundebPdfTipo, buildFundebPdfFilename } from "@/core/lib/fundeb-pdf";
import { generateComercialHtml, mapPayloadToComercialData } from "@/core/lib/fundeb-comercial-template";
import { generateComercialPremiumPdf } from "@/core/lib/fundeb-comercial-pdf";

interface AutonomoRequestBody {
  codigo_ibge?: string;
  nome?: string;
  uf?: string;
  exercicio?: number;
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = (searchParams.get("tipo") || "levantamento").toLowerCase();
    const formato = (searchParams.get("formato") || "pdf").toLowerCase();

    if (!isFundebPdfTipo(tipo)) {
      return NextResponse.json(
        { error: `Tipo invalido: "${tipo}". Use: levantamento | executiva | comparativa | comercial-premium` },
        { status: 400 },
      );
    }

    if (formato !== "pdf" && formato !== "json") {
      return NextResponse.json(
        { error: `Formato invalido: "${formato}". Use: pdf | json` },
        { status: 400 },
      );
    }

    const body = (await request.json()) as AutonomoRequestBody;
    const hasCodigoIbge = Boolean(body.codigo_ibge?.trim());
    const hasNomeUf = Boolean(body.nome?.trim() && body.uf?.trim());

    if (!hasCodigoIbge && !hasNomeUf) {
      return NextResponse.json(
        { error: "Informe codigo_ibge ou o par nome/uf para gerar o levantamento autonomo." },
        { status: 400 },
      );
    }

    const data = await buildGoviaMunicipioCompleto({
      codigo_ibge: body.codigo_ibge,
      nome: body.nome,
      uf: body.uf,
      exercicio: body.exercicio,
    });

    if (!data) {
      return NextResponse.json({ error: "Municipio nao encontrado." }, { status: 404 });
    }

    await markGoviaMunicipioAccess({
      codigo_ibge: data.payload.dados_basicos.codigo_ibge,
      nome: data.payload.dados_basicos.nome,
      uf: data.payload.dados_basicos.uf,
      regiao: data.payload.dados_basicos.regiao,
    });

    if (formato === "json") {
      return NextResponse.json({
        success: true,
        data: data.payload,
      });
    }

    // ── Comercial Premium: Playwright-based HTML → PDF ──────────────
    if (tipo === "comercial-premium") {
      const comercialData = mapPayloadToComercialData(data.payload);
      const htmlContent = generateComercialHtml(comercialData);

      const municipioSlug = (comercialData.municipio || "municipio")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toUpperCase();
      const ufSlug = (comercialData.uf || "UF").toUpperCase();

      const { pdfBuffer, filename } = await generateComercialPremiumPdf(
        htmlContent,
        `${municipioSlug}-${ufSlug}`,
      );

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename=${filename}`,
        },
      });
    }

    // ── Traditional PDF types: Python-based ─────────────────────────
    const comparativeSnapshot =
      tipo === "comparativa" || tipo === "executiva"
        ? await buildFundebComparativeSnapshot(data.relatorio)
        : null;
    const pdfPayload =
      tipo === "comparativa"
        ? comparativeSnapshot?.comparativaPdfInput ?? data.relatorio
        : tipo === "executiva"
          ? { ...data.relatorio, ...(comparativeSnapshot?.comparativaPdfInput ?? {}) }
          : data.relatorio;
    const { pdfBuffer, filename } = await generateFundebPdfBuffer(pdfPayload, tipo, data.relatorio);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=${filename}`,
      },
    });
  } catch (error) {
    console.error("[Levantamento FUNDEB autonomo] Erro:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao gerar levantamento autonomo." },
      { status: 500 },
    );
  }
}

