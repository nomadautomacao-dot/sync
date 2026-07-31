import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildGoviaMunicipioCompleto } from "@/core/lib/govia-compat";
import { markGoviaMunicipioAccess } from "@/core/lib/govia-storage";
import { montarDossieComparativo } from "@/core/lib/dossie-comparativo";
import { generateDossieComparativoHtml } from "@/core/lib/dossie-comparativo-template";
import { generateDossieComparativoPdf } from "@/core/lib/dossie-comparativo-pdf";
import { registrarErro } from "@/core/lib/structured-log";

/**
 * Dossiê Comparativo — o município contra os pares de porte semelhante.
 *
 * Todas as fontes são dataset local, e a coorte nacional é construída uma vez
 * por processo. A emissão não vai à rede; o `maxDuration` folgado existe pelo
 * Chromium.
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

  const d = montarDossieComparativo(codigo, "", uf);
  return NextResponse.json({
    indicadores: d.resumo.total,
    melhores: d.resumo.melhores,
    piores: d.resumo.piores,
    posicaoMedia: d.resumo.posicaoMedia,
    coorte: d.gemeos?.faixaPorte.tamanho ?? 0,
    ausencias: d.ausencias.length,
    // Capa, sumário, painel, maiores distâncias e ~4 blocos por folha.
    paginasEstimadas:
      2 +
      (d.grupos.length > 0 ? 1 : 0) +
      (d.maioresDistancias.length > 0 ? 1 : 0) +
      Math.max(0, Math.ceil(d.indicadores.length / 4)),
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
    const dossie = montarDossieComparativo(basicos.codigo_ibge, basicos.nome, basicos.uf);

    // Sem indicador comparável não há dossiê comparativo — há uma folha de rosto
    // dizendo que não foi possível comparar, e isso não se cobra de ninguém.
    if (dossie.indicadores.length === 0) {
      return NextResponse.json(
        {
          error:
            "Nenhum indicador teve pares suficientes para comparação. Percentil sobre coorte rala é ruído com cara de estatística, e o dossiê prefere não publicá-lo.",
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
    const html = generateDossieComparativoHtml({
      municipio: basicos.nome,
      uf: basicos.uf,
      codigoIbge: basicos.codigo_ibge,
      dossie,
      geradoEm,
      logoDataUri: await carregarLogo(),
    });

    const { pdfBuffer, filename, paginas } = await generateDossieComparativoPdf(
      html,
      `${slug(basicos.nome)}_${slug(basicos.uf)}`,
      dossie.indicadores.length,
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
            reportType: "dossie_comparativo",
            generatedAt: geradoEm.toISOString(),
            exercise: geradoEm.getFullYear(),
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
    registrarErro("Dossiê Comparativo", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao gerar o dossiê." },
      { status: 500 },
    );
  }
}
