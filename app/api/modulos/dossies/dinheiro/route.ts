import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildGoviaMunicipioCompleto } from "@/core/lib/govia-compat";
import { markGoviaMunicipioAccess } from "@/core/lib/govia-storage";
import { montarDossieDinheiro } from "@/core/lib/dossie-dinheiro";
import { generateDossieDinheiroHtml } from "@/core/lib/dossie-dinheiro-template";
import { generateDossieDinheiroPdf } from "@/core/lib/dossie-dinheiro-pdf";
import { registrarErro } from "@/core/lib/structured-log";

/**
 * Dossiê do Dinheiro Federal — obras, emendas, convênios e sanções.
 *
 * É o dossiê que mais depende de rede: o painel do Pacto vem de uma planilha do
 * FNDE e as duas consultas do Portal da Transparência paginam dezenas de vezes.
 * Por isso o `maxDuration` é o teto da plataforma, e por isso o `GET` de prévia
 * não repete as consultas caras — ele monta o dossiê inteiro uma vez e devolve
 * só o placar.
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
  const nome = request.nextUrl.searchParams.get("nome")?.trim();
  const uf = request.nextUrl.searchParams.get("uf")?.trim();
  if (!codigo || !nome || !uf) {
    return NextResponse.json(
      { error: "Informe codigo_ibge, nome e uf — o painel do FNDE resolve obra por nome e UF." },
      { status: 400 },
    );
  }

  const d = await montarDossieDinheiro(codigo, nome, uf);
  return NextResponse.json({
    obras: d.resumo.obras,
    obrasParadas: d.resumo.obrasParadas,
    conveniosVigentes: d.resumo.conveniosVigentes,
    autoresEmenda: (d.emendas?.autores.length ?? 0) + (d.emendas?.autoresDemais?.quantidade ?? 0),
    totalRastreado: d.resumo.totalRastreado,
    ausencias: d.ausencias.length,
    // Capa, sumário, obras (~3 por folha), emendas, autores, convênios (~20 por
    // folha) e a folha final das transferências automáticas.
    paginasEstimadas:
      2 +
      Math.max(1, Math.ceil(d.obras.length / 3)) +
      (d.emendas ? 2 : 0) +
      Math.max(1, Math.ceil(d.conveniosLista.length / 20)) +
      2,
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
    const geradoEm = new Date();
    const dossie = await montarDossieDinheiro(
      basicos.codigo_ibge,
      basicos.nome,
      basicos.uf,
      geradoEm,
    );

    // Nenhuma fonte isolada é obrigatória — cada seção some com a explicação de
    // por quê. Mas um documento em que as quatro falharam é folha de rosto, e
    // entregá-lo seria pior que a falha.
    if (
      dossie.obras.length === 0 &&
      !dossie.emendas &&
      !dossie.convenios &&
      !dossie.sancoes
    ) {
      return NextResponse.json(
        {
          error:
            "Nenhuma das fontes de recursos federais respondeu nesta emissão (painel do Pacto, emendas, convênios e sanções). O Portal da Transparência limita chamadas por minuto — tente novamente em alguns minutos.",
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

    const html = generateDossieDinheiroHtml({
      municipio: basicos.nome,
      uf: basicos.uf,
      codigoIbge: basicos.codigo_ibge,
      dossie,
      geradoEm,
      logoDataUri: await carregarLogo(),
    });

    const { pdfBuffer, filename, paginas } = await generateDossieDinheiroPdf(
      html,
      `${slug(basicos.nome)}_${slug(basicos.uf)}`,
      dossie.obras.length,
      dossie.conveniosLista.length,
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
            reportType: "dossie_dinheiro",
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
    registrarErro("Dossiê do Dinheiro Federal", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao gerar o dossiê." },
      { status: 500 },
    );
  }
}
