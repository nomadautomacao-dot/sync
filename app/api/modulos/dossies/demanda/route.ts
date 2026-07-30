import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildGoviaMunicipioCompleto } from "@/core/lib/govia-compat";
import { markGoviaMunicipioAccess } from "@/core/lib/govia-storage";
import { montarDossieDemanda } from "@/core/lib/dossie-demanda";
import { generateDossieDemandaHtml } from "@/core/lib/dossie-demanda-template";
import { generateDossieDemandaPdf } from "@/core/lib/dossie-demanda-pdf";

/**
 * Dossiê da Demanda — a coorte que já nasceu contra a vaga que existe.
 *
 * Três consultas ao vivo (IBGE ×2 e MDS), todas com tolerância a falha. O
 * `maxDuration` folgado cobre a rede e o Chromium.
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

  const d = await montarDossieDemanda(codigo, "", uf);
  return NextResponse.json({
    coortes: d.demografia?.nascimentos.length ?? 0,
    faixas: d.faixas.length,
    coberturaCreche: d.resumo.coberturaCrecheTotal,
    demandaCrecheNaoAtendida: d.resumo.demandaCrecheNaoAtendida,
    foraDaEscolaObrigatoria: d.resumo.foraDaEscolaObrigatoria,
    ausencias: d.ausencias.length,
    // Capa, sumário, coortes, cobertura + creche, busca ativa e contextos.
    paginasEstimadas:
      2 +
      (d.demografia?.nascimentos.length ? 1 : 0) +
      (d.faixas.length > 0 ? 1 : 0) +
      (d.buscaAtiva ? 1 : 0),
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
    const dossie = await montarDossieDemanda(basicos.codigo_ibge, basicos.nome, basicos.uf);

    // Sem coorte e sem cobertura não sobra dossiê de demanda — sobra capa.
    if (!dossie.demografia && dossie.faixas.length === 0) {
      return NextResponse.json(
        {
          error:
            "As consultas ao IBGE (população por idade e nascidos vivos) não responderam nesta emissão. Sem elas não há coorte nem denominador de cobertura — tente novamente em alguns minutos.",
        },
        { status: 503 },
      );
    }

    await markGoviaMunicipioAccess({
      codigo_ibge: basicos.codigo_ibge,
      nome: basicos.nome,
      uf: basicos.uf,
      regiao: basicos.regiao,
    });

    const geradoEm = new Date();
    const html = generateDossieDemandaHtml({
      municipio: basicos.nome,
      uf: basicos.uf,
      codigoIbge: basicos.codigo_ibge,
      dossie,
      geradoEm,
      logoDataUri: await carregarLogo(),
    });

    const { pdfBuffer, filename, paginas } = await generateDossieDemandaPdf(
      html,
      `${slug(basicos.nome)}_${slug(basicos.uf)}`,
      dossie.demografia?.nascimentos.length ?? 0,
      dossie.faixas.length,
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
            reportType: "dossie_demanda",
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
    console.error("[Dossiê da Demanda] Erro:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao gerar o dossiê." },
      { status: 500 },
    );
  }
}
