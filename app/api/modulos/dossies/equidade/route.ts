import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildGoviaMunicipioCompleto } from "@/core/lib/govia-compat";
import { markGoviaMunicipioAccess } from "@/core/lib/govia-storage";
import { montarDossieEquidade } from "@/core/lib/dossie-equidade";
import { generateDossieEquidadeHtml } from "@/core/lib/dossie-equidade-template";
import { generateDossieEquidadePdf } from "@/core/lib/dossie-equidade-pdf";

/**
 * Dossiê da Equidade e dos Territórios.
 *
 * Uma consulta ao vivo (IBGE, agregados 8176 e 8175 do Censo 2022); o resto é
 * dataset local. O `maxDuration` folgado cobre a rede e o Chromium.
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

  const d = await montarDossieEquidade(codigo, "", uf);
  return NextResponse.json({
    anosSerie: d.series.reduce((t, s) => t + s.anos.length, 0),
    correntes: d.correntes.length,
    povosComSinal: d.resumo.povosComSinal,
    naoDeclaradaPct: d.resumo.naoDeclaradaPct,
    mudouCadastro: d.series.some((s) => s.anosComMudanca.length > 0),
    ausencias: d.ausencias.length,
    // Capa, sumário, série, correntes, territórios, zona e VAAR.
    paginasEstimadas:
      2 +
      (d.series.length > 0 ? 1 : 0) +
      Math.max(0, Math.ceil(d.correntes.length / 1.5)) +
      (d.condicoes.length > 0 || d.assentamentos ? 1 : 0) +
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
    const dossie = await montarDossieEquidade(basicos.codigo_ibge, basicos.nome, basicos.uf);

    // Sem série de cor/raça e sem composição não sobra dossiê de equidade.
    if (dossie.series.length === 0 && !dossie.equidade) {
      return NextResponse.json(
        {
          error:
            "Os microdados do Censo Escolar não trazem a composição por cor/raça deste município, nem a série histórica. Sem elas não há o que abrir.",
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
    const html = generateDossieEquidadeHtml({
      municipio: basicos.nome,
      uf: basicos.uf,
      codigoIbge: basicos.codigo_ibge,
      dossie,
      geradoEm,
      logoDataUri: await carregarLogo(),
    });

    const { pdfBuffer, filename, paginas } = await generateDossieEquidadePdf(
      html,
      `${slug(basicos.nome)}_${slug(basicos.uf)}`,
      dossie.series.reduce((t, s) => t + s.anos.length, 0),
      dossie.correntes.length,
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
            reportType: "dossie_equidade",
            generatedAt: geradoEm.toISOString(),
            exercise: dossie.anoCensoEscolar ?? geradoEm.getFullYear(),
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
    console.error("[Dossiê da Equidade] Erro:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao gerar o dossiê." },
      { status: 500 },
    );
  }
}
