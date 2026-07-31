import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildFundebComparativeSnapshot } from "@/core/lib/fundeb-comparative";
import { generateFundebPdfBuffer, isFundebPdfTipo } from "@/core/lib/fundeb-pdf";
import { buildGoviaMunicipioCompleto } from "@/core/lib/govia-compat";
import { generateLevantamentoHtml } from "@/core/lib/fundeb-levantamento-template";
import { generateLevantamentoPdf } from "@/core/lib/fundeb-levantamento-pdf";
import type { RelatorioFundeb } from "@/modules/levantamento-fundeb/types";
import { registrarErro } from "@/core/lib/structured-log";

export const maxDuration = 300;

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

/**
 * Logo em data-URI. O template imprime fora do servidor de arquivos, então a
 * marca precisa viajar embutida no HTML — `<img src="/...">` não resolveria.
 */
async function carregarLogo(): Promise<string | null> {
  try {
    const arquivo = path.join(process.cwd(), "public", "global-sync-icon.png");
    const bytes = await readFile(arquivo);
    return `data:image/png;base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

interface LevantamentoRequest {
  codigo_ibge?: string;
  nome?: string;
  uf?: string;
  exercicio?: number;
  response_format?: "pdf" | "bundle";
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = (searchParams.get("tipo") || "levantamento").toLowerCase();

    // ── Novo modelo: HTML + Chromium, sem Python ─────────────────────────────
    // O `levantamento` deixou de ser gerado pelo ReportLab (`gerador.py`, o
    // primeiro modelo do produto). Agora ele recebe só o identificador e
    // remonta tudo no servidor, como o Raio-X — o cliente não precisa mais
    // carregar o relatório inteiro só para pedir um PDF.
    if (tipo === "levantamento") {
      const body = (await request.json().catch(() => ({}))) as LevantamentoRequest;
      const hasCodigo = Boolean(body.codigo_ibge?.trim());
      const hasNomeUf = Boolean(body.nome?.trim() && body.uf?.trim());

      if (!hasCodigo && !hasNomeUf) {
        return NextResponse.json(
          { error: "Informe codigo_ibge ou o par nome/uf para gerar o levantamento." },
          { status: 400 },
        );
      }

      const dados = await buildGoviaMunicipioCompleto({
        codigo_ibge: body.codigo_ibge,
        nome: body.nome,
        uf: body.uf,
        exercicio: body.exercicio,
      });

      if (!dados) {
        return NextResponse.json({ error: "Municipio nao encontrado." }, { status: 404 });
      }

      const html = generateLevantamentoHtml({
        relatorio: dados.relatorio,
        payload: dados.payload,
        logoDataUri: await carregarLogo(),
      });

      const identificacao = dados.relatorio.identificacao;
      const { pdfBuffer, filename } = await generateLevantamentoPdf(
        html,
        slug(`${identificacao.municipioNome}_${identificacao.uf}`),
        identificacao.exercicio,
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
              reportType: "diagnostico_fundeb",
              generatedAt: new Date().toISOString(),
              exercise: identificacao.exercicio,
              municipality: {
                name: identificacao.municipioNome,
                uf: identificacao.uf,
                codigoIbge: String(identificacao.codigoIBGE),
              },
              data: {
                primary: dados,
                context: {
                  generator: "fundeb-levantamento-html",
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
        },
      });
    }

    // ── Modelos ainda em Python: executiva, comparativa, comercial-premium ───
    if (!isFundebPdfTipo(tipo)) {
      return NextResponse.json(
        { error: `Tipo invalido: "${tipo}". Use: levantamento | executiva | comparativa | comercial-premium` },
        { status: 400 },
      );
    }

    const relatorio = (await request.json()) as RelatorioFundeb;
    const comparativeSnapshot =
      tipo === "comparativa" || tipo === "executiva"
        ? await buildFundebComparativeSnapshot(relatorio)
        : null;
    const pdfPayload =
      tipo === "comparativa"
        ? comparativeSnapshot?.comparativaPdfInput ?? relatorio
        : tipo === "executiva"
          ? { ...relatorio, ...(comparativeSnapshot?.comparativaPdfInput ?? {}) }
          : relatorio;
    const { pdfBuffer, filename } = await generateFundebPdfBuffer(pdfPayload, tipo, relatorio);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=${filename}`,
      },
    });
  } catch (error) {
    registrarErro("PDF", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha na requisicao" },
      { status: 500 },
    );
  }
}
