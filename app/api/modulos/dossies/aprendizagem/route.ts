import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildGoviaMunicipioCompleto } from "@/core/lib/govia-compat";
import { markGoviaMunicipioAccess } from "@/core/lib/govia-storage";
import { montarDossieAprendizagem } from "@/core/lib/dossie-aprendizagem";
import { generateDossieAprendizagemHtml } from "@/core/lib/dossie-aprendizagem-template";
import { generateDossieAprendizagemPdf } from "@/core/lib/dossie-aprendizagem-pdf";

/**
 * Dossiê da Aprendizagem — a distribuição que a média esconde.
 *
 * Todas as fontes são dataset local (Saeb, IDEB, CNCA, Censo, ENEM), então a
 * emissão não vai à rede. O `maxDuration` folgado existe pelo Chromium.
 */
export const maxDuration = 300;

interface DossieRequest {
  codigo_ibge?: string;
  nome?: string;
  uf?: string;
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

async function carregarLogo(): Promise<string | null> {
  try {
    const arquivo = path.join(process.cwd(), "public", "global-sync-icon.png");
    return `data:image/png;base64,${(await readFile(arquivo)).toString("base64")}`;
  } catch {
    return null;
  }
}

/** Prévia para a tela: o placar, sem gerar o PDF. */
export async function GET(request: NextRequest) {
  const codigo = request.nextUrl.searchParams.get("codigo_ibge")?.trim();
  const uf = request.nextUrl.searchParams.get("uf")?.trim() ?? "";
  if (!codigo) {
    return NextResponse.json({ error: "Informe codigo_ibge." }, { status: 400 });
  }

  const d = montarDossieAprendizagem(codigo, "", uf);
  return NextResponse.json({
    provas: d.series.length,
    edicoesIdeb: d.serieIdeb.length,
    piorInsuficiente: d.resumo.piorInsuficiente?.pct ?? null,
    idebAnosIniciais: d.resumo.idebAnosIniciais,
    seriesAtipicas: d.resumo.seriesAtipicas,
    ausencias: d.ausencias.length,
    // Capa, sumário, as provas (~3 por folha), IDEB, alfabetização, fluxo,
    // VAAR e ENEM.
    paginasEstimadas:
      2 +
      Math.max(1, Math.ceil(d.series.length / 3)) +
      (d.serieIdeb.length > 0 ? 1 : 0) +
      (d.alfabetizacao ? 1 : 0) +
      (d.rendimento ? 1 : 0) +
      (d.vaar ? 1 : 0),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DossieRequest;
    const hasCodigo = Boolean(body.codigo_ibge?.trim());
    const hasNomeUf = Boolean(body.nome?.trim() && body.uf?.trim());
    if (!hasCodigo && !hasNomeUf) {
      return NextResponse.json(
        { error: "Informe codigo_ibge ou o par nome/uf para gerar o dossiê." },
        { status: 400 },
      );
    }

    const municipio = await buildGoviaMunicipioCompleto({
      codigo_ibge: body.codigo_ibge,
      nome: body.nome,
      uf: body.uf,
    });
    if (!municipio) {
      return NextResponse.json({ error: "Município não encontrado." }, { status: 404 });
    }

    const basicos = municipio.payload.dados_basicos;
    const dossie = montarDossieAprendizagem(basicos.codigo_ibge, basicos.nome, basicos.uf);

    // Sem Saeb, sem IDEB e sem alfabetização não sobra dossiê — sobra capa.
    if (dossie.series.length === 0 && dossie.serieIdeb.length === 0 && !dossie.alfabetizacao) {
      return NextResponse.json(
        {
          error:
            "Nenhuma das avaliações nacionais traz este município: sem Saeb, sem série do IDEB e sem o Indicador Criança Alfabetizada não há o que abrir.",
        },
        { status: 404 },
      );
    }

    await markGoviaMunicipioAccess({
      codigo_ibge: basicos.codigo_ibge,
      nome: basicos.nome,
      uf: basicos.uf,
      regiao: basicos.regiao,
    });

    const geradoEm = new Date();
    const html = generateDossieAprendizagemHtml({
      municipio: basicos.nome,
      uf: basicos.uf,
      codigoIbge: basicos.codigo_ibge,
      dossie,
      geradoEm,
      logoDataUri: await carregarLogo(),
    });

    const { pdfBuffer, filename, paginas } = await generateDossieAprendizagemPdf(
      html,
      `${slug(basicos.nome)}_${slug(basicos.uf)}`,
      dossie.series.length,
      dossie.serieIdeb.length,
    );

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
            reportType: "dossie_aprendizagem",
            generatedAt: geradoEm.toISOString(),
            exercise: dossie.saeb?.ano ?? geradoEm.getFullYear(),
            municipality: {
              name: basicos.nome,
              uf: basicos.uf,
              codigoIbge: basicos.codigo_ibge,
            },
            data: { primary: municipio, context: { dossie, paginas } },
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
    console.error("[Dossiê da Aprendizagem] Erro:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao gerar o dossiê." },
      { status: 500 },
    );
  }
}
