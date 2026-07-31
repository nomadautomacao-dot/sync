import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildGoviaMunicipioCompleto } from "@/core/lib/govia-compat";
import { markGoviaMunicipioAccess } from "@/core/lib/govia-storage";
import { montarDossieMatricula } from "@/core/lib/dossie-matricula";
import { getCatalogoSegmentos } from "@/core/lib/fundeb-ponderacao";
import { generateDossieMatriculaHtml } from "@/core/lib/dossie-matricula-template";
import { generateDossieMatriculaPdf } from "@/core/lib/dossie-matricula-pdf";
import { registrarErro } from "@/core/lib/structured-log";

/**
 * Dossiê da Matrícula Ponderada — de onde vem cada real do fundo.
 *
 * Todas as fontes são dataset local (planilha do FNDE, Portaria, Censo), então
 * a emissão não depende de rede e é rápida. O `maxDuration` folgado existe pelo
 * Chromium, não pela coleta.
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
  const uf = request.nextUrl.searchParams.get("uf")?.trim() || undefined;
  if (!codigo) {
    return NextResponse.json({ error: "Informe codigo_ibge." }, { status: 400 });
  }

  const d = montarDossieMatricula(codigo, uf);
  if (!d) {
    return NextResponse.json(
      { error: "A planilha de matrículas ponderadas do FNDE não traz este município." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    exercicio: d.exercicio,
    matriculas: d.matriculas,
    ponderadaVaaf: d.ponderadaVaaf,
    ponderadaVaat: d.ponderadaVaat,
    fatorMedio: d.fatorMedio,
    segmentos: d.resumo.segmentosComMatricula,
    divergencias: d.resumo.divergencias,
    receitaDoPeso: d.receitaDoPeso,
    // Capa, sumário, VAAF×VAAT, conciliação, cortes, segmentos, anexo e o que
    // cada fonte tiver respondido. ~24 linhas de tabela por folha de fluxo.
    paginasEstimadas:
      4 +
      Math.ceil(d.segmentos.length / 24) +
      3 +
      Math.ceil(d.conferencias.length / 4) +
      d.oportunidades.length +
      (d.serie.length > 0 ? 1 : 0) +
      (d.pnae ? 1 : 0) +
      Math.ceil(getCatalogoSegmentos().length / 30),
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
    const dossie = montarDossieMatricula(basicos.codigo_ibge, basicos.uf);
    if (!dossie) {
      return NextResponse.json(
        {
          error:
            "A planilha de matrículas ponderadas do FNDE não traz este município — sem ela não há ponderação para abrir.",
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
    const html = generateDossieMatriculaHtml({
      municipio: basicos.nome,
      uf: basicos.uf,
      codigoIbge: basicos.codigo_ibge,
      dossie,
      geradoEm,
      logoDataUri: await carregarLogo(),
    });

    const { pdfBuffer, filename, paginas } = await generateDossieMatriculaPdf(
      html,
      `${slug(basicos.nome)}_${slug(basicos.uf)}`,
      dossie.segmentos.length,
      getCatalogoSegmentos().length,
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
            reportType: "dossie_matricula",
            generatedAt: geradoEm.toISOString(),
            exercise: dossie.exercicio,
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
    registrarErro("Dossiê da Matrícula Ponderada", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao gerar o dossiê." },
      { status: 500 },
    );
  }
}
