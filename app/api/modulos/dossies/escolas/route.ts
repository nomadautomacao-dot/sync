import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildGoviaMunicipioCompleto } from "@/core/lib/govia-compat";
import { markGoviaMunicipioAccess } from "@/core/lib/govia-storage";
import { montarDossieEscolas } from "@/core/lib/dossie-escolas";
import { generateDossieEscolasHtml } from "@/core/lib/dossie-escolas-template";
import { generateDossieEscolasPdf } from "@/core/lib/dossie-escolas-pdf";
import { registrarErro } from "@/core/lib/structured-log";

/**
 * Dossiê das Escolas — a rede municipal unidade por unidade.
 *
 * O volume é função do município: 20 blocos em Ibateguara, 508 em Manaus (130
 * folhas). Por isso o `maxDuration` é o teto da plataforma, e por isso o
 * método `GET` existe — a tela precisa saber quantas escolas o município tem
 * **antes** de disparar a geração, para avisar o tamanho.
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

/** Prévia para a tela: quantas escolas e quanto isso vira de documento. */
export async function GET(request: NextRequest) {
  const codigo = request.nextUrl.searchParams.get("codigo_ibge")?.trim();
  if (!codigo) {
    return NextResponse.json({ error: "Informe codigo_ibge." }, { status: 400 });
  }

  const dossie = montarDossieEscolas(codigo);
  if (!dossie) {
    return NextResponse.json(
      { error: "Os microdados do Censo Escolar não trouxeram a rede municipal deste município." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    escolas: dossie.cobertura.total,
    matriculas: dossie.resumo.matriculas,
    cobertura: dossie.cobertura,
    anoCenso: dossie.anoTerritorio,
    // ~4 blocos por folha, mais capa, sumário e índice.
    paginasEstimadas: Math.ceil(dossie.cobertura.total / 4) + 3,
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
    const dossie = montarDossieEscolas(basicos.codigo_ibge);
    if (!dossie) {
      return NextResponse.json(
        {
          error:
            "Os microdados do Censo Escolar não trouxeram a rede municipal deste município — sem escolas, não há dossiê.",
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
    const html = generateDossieEscolasHtml({
      municipio: basicos.nome,
      uf: basicos.uf,
      codigoIbge: basicos.codigo_ibge,
      dossie,
      geradoEm,
      logoDataUri: await carregarLogo(),
    });

    const { pdfBuffer, filename, paginas } = await generateDossieEscolasPdf(
      html,
      `${slug(basicos.nome)}_${slug(basicos.uf)}`,
      dossie.escolas.length,
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
            reportType: "dossie_escolas",
            generatedAt: geradoEm.toISOString(),
            exercise: dossie.anoTerritorio,
            municipality: {
              name: basicos.nome,
              uf: basicos.uf,
              codigoIbge: basicos.codigo_ibge,
            },
            data: {
              primary: municipio,
              context: {
                dossie,
                paginas,
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
    registrarErro("Dossiê das Escolas", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao gerar o dossiê." },
      { status: 500 },
    );
  }
}
