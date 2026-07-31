import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildGoviaMunicipioCompleto } from "@/core/lib/govia-compat";
import { markGoviaMunicipioAccess } from "@/core/lib/govia-storage";
import { montarDossieConformidade } from "@/core/lib/dossie-conformidade";
import { generateDossieConformidadeHtml } from "@/core/lib/dossie-conformidade-template";
import { generateDossieConformidadePdf } from "@/core/lib/dossie-conformidade-pdf";
import { registrarErro } from "@/core/lib/structured-log";

/**
 * Dossiê da Conformidade — todo requisito, toda vinculação, toda entrega.
 *
 * Ao contrário do Dossiê das Escolas, aqui as fontes principais são de **rede**
 * (CAUC e extrato de entregas do Tesouro), não dataset local. O documento é
 * uma fotografia da data da consulta, e é por isso que ele imprime a
 * `dataPesquisa` em cada seção.
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
  if (!codigo) {
    return NextResponse.json({ error: "Informe codigo_ibge." }, { status: 400 });
  }

  const dossie = await montarDossieConformidade(codigo);
  return NextResponse.json({
    requisitos: dossie.resumo.requisitos,
    pendentes: dossie.resumo.pendentes,
    vencemEm60Dias: dossie.resumo.vencemEm60Dias,
    indicadoresSiope: dossie.resumo.indicadoresSiope,
    // Capa, sumário e as seções que a emissão conseguiu montar.
    paginasEstimadas:
      2 +
      (dossie.cauc ? 2 + Math.ceil(dossie.resumo.requisitos / 26) : 0) +
      (dossie.siope ? 1 : 0) +
      (dossie.pontualidade ? 1 : 0) +
      (dossie.vaar ? 1 : 0) +
      (dossie.remuneracao ? 1 : 0),
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
    const dossie = await montarDossieConformidade(basicos.codigo_ibge, geradoEm);

    // Nenhuma das fontes é obrigatória isoladamente — cada seção some com a
    // explicação de por quê. Mas um documento em que todas falharam não é
    // dossiê, é folha de rosto, e entregá-lo seria pior que a falha.
    if (!dossie.cauc && !dossie.siope && !dossie.pontualidade && !dossie.vaar) {
      return NextResponse.json(
        {
          error:
            "Nenhuma das fontes de conformidade respondeu nesta emissão (CAUC, SIOPE, extrato de entregas e VAAR). As consultas do Tesouro saem em dias úteis — tente novamente.",
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

    const html = generateDossieConformidadeHtml({
      municipio: basicos.nome,
      uf: basicos.uf,
      dossie,
      geradoEm,
      logoDataUri: await carregarLogo(),
    });

    const { pdfBuffer, filename } = await generateDossieConformidadePdf(
      html,
      `${slug(basicos.nome)}_${slug(basicos.uf)}`,
      dossie.resumo.requisitos,
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
            reportType: "dossie_conformidade",
            generatedAt: geradoEm.toISOString(),
            exercise: geradoEm.getFullYear(),
            municipality: {
              name: basicos.nome,
              uf: basicos.uf,
              codigoIbge: basicos.codigo_ibge,
            },
            data: { primary: municipio, context: { dossie } },
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
    registrarErro("Dossiê da Conformidade", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao gerar o dossiê." },
      { status: 500 },
    );
  }
}
