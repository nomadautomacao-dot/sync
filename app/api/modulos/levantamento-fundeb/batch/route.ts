import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { buildGoviaMunicipioCompleto } from "@/core/lib/govia-compat";
import { buildDirectedFundebReportBase } from "@/core/lib/fundeb-directed-report";
import { buildFundebComparativeSnapshot } from "@/core/lib/fundeb-comparative";
import { generateFundebPdfBuffer, isFundebPdfTipo, type FundebPdfTipo } from "@/core/lib/fundeb-pdf";
import { markGoviaMunicipioAccess } from "@/core/lib/govia-storage";
import type { FundebRelatorioParametros } from "@/modules/levantamento-fundeb/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface BatchItem {
  codigo_ibge?: string;
  nome?: string;
  uf?: string;
  parametros?: FundebRelatorioParametros;
}

interface BatchRequestBody {
  municipios: BatchItem[];
  exercicio: number;
  tipos: FundebPdfTipo[];
  modo: "completo" | "rapido";
  parametros?: FundebRelatorioParametros;
}

interface BatchResultItem {
  codigo_ibge: string;
  nome: string;
  uf: string;
  status: "ok" | "erro" | "timeout";
  erro?: string;
  arquivos?: string[];
}

const CONCURRENCY = 2;
const PER_ITEM_TIMEOUT_MS = 60_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout (${ms / 1000}s): ${label}`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

async function processOneMunicipio(
  item: BatchItem,
  exercicio: number,
  tipos: FundebPdfTipo[],
  modo: "completo" | "rapido",
  zip: JSZip,
  parametros?: FundebRelatorioParametros,
): Promise<BatchResultItem> {
  const data = await withTimeout(
    buildGoviaMunicipioCompleto({
      codigo_ibge: item.codigo_ibge,
      nome: item.nome,
      uf: item.uf,
      exercicio,
      parametros: {
        ...(parametros ?? {}),
        ...(item.parametros ?? {}),
      },
    }),
    PER_ITEM_TIMEOUT_MS,
    `dados ${item.nome || item.codigo_ibge}`,
  );

  if (!data) {
    return {
      codigo_ibge: item.codigo_ibge ?? "",
      nome: item.nome ?? "",
      uf: item.uf ?? "",
      status: "erro",
      erro: "Municipio nao encontrado.",
    };
  }

  await markGoviaMunicipioAccess({
    codigo_ibge: data.payload.dados_basicos.codigo_ibge,
    nome: data.payload.dados_basicos.nome,
    uf: data.payload.dados_basicos.uf,
    regiao: data.payload.dados_basicos.regiao,
  });

  const slug = data.relatorio.identificacao.municipioNome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "-")
    .toLowerCase();

  const municipioFolder = zip.folder(slug);
  const arquivos: string[] = [];

  municipioFolder!.file(`dados-${slug}.json`, JSON.stringify(data.payload, null, 2));
  arquivos.push(`dados-${slug}.json`);

  if (modo === "completo") {
    for (const tipo of tipos) {
      try {
        const comparativeSnapshot =
          tipo === "comparativa" || tipo === "executiva"
            ? await withTimeout(buildFundebComparativeSnapshot(data.relatorio), 20_000, `comparativa ${slug}`)
            : null;

        const pdfPayload =
          tipo === "comparativa"
            ? comparativeSnapshot?.comparativaPdfInput ?? data.relatorio
            : tipo === "executiva"
              ? { ...data.relatorio, ...(comparativeSnapshot?.comparativaPdfInput ?? {}) }
              : data.relatorio;

        const { pdfBuffer, filename } = await withTimeout(
          generateFundebPdfBuffer(pdfPayload, tipo, data.relatorio),
          45_000,
          `PDF ${tipo} ${slug}`,
        );
        municipioFolder!.file(filename, pdfBuffer);
        arquivos.push(filename);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Erro ao gerar PDF";
        municipioFolder!.file(`${tipo}-erro.txt`, msg);
      }
    }
  }

  try {
    const dirigido = await buildDirectedFundebReportBase({
      relatorio: data.relatorio,
      payload: data.payload,
    });
    const filename = `relatorio-dirigido-${slug}.json`;
    municipioFolder!.file(filename, JSON.stringify(dirigido, null, 2));
    arquivos.push(filename);
  } catch {
    // non-critical
  }

  return {
    codigo_ibge: data.relatorio.identificacao.codigoIBGE,
    nome: data.relatorio.identificacao.municipioNome,
    uf: data.relatorio.identificacao.uf,
    status: "ok",
    arquivos,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BatchRequestBody;

    if (!Array.isArray(body.municipios) || body.municipios.length === 0) {
      return NextResponse.json(
        { success: false, error: "Envie ao menos um municipio." },
        { status: 400 },
      );
    }

    if (body.municipios.length > 50) {
      return NextResponse.json(
        { success: false, error: "Limite de 50 municipios por requisicao." },
        { status: 400 },
      );
    }

    const modo = body.modo === "rapido" ? "rapido" : "completo";
    const tipos = modo === "rapido" ? [] : (body.tipos ?? ["levantamento"]).filter(isFundebPdfTipo);

    if (modo === "completo" && tipos.length === 0) {
      return NextResponse.json(
        { success: false, error: "Envie ao menos um tipo: levantamento, executiva, comparativa." },
        { status: 400 },
      );
    }

    const exercicio = body.exercicio && body.exercicio > 2000 ? body.exercicio : new Date().getFullYear();
    const items = body.municipios;
    const resultados: BatchResultItem[] = [];

    const zip = new JSZip();

    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const chunk = items.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.all(
        chunk.map((item) =>
          withTimeout(
            processOneMunicipio(item, exercicio, tipos, modo, zip, body.parametros),
            modo === "rapido" ? 45_000 : 120_000,
            item.nome || item.codigo_ibge || "municipio",
          ).catch((error): BatchResultItem => ({
            codigo_ibge: item.codigo_ibge ?? "",
            nome: item.nome ?? "",
            uf: item.uf ?? "",
            status: error instanceof Error && error.message.includes("Timeout") ? "timeout" : "erro",
            erro: error instanceof Error ? error.message : "Erro desconhecido.",
          })),
        ),
      );
      resultados.push(...chunkResults);
    }

    zip.file(
      "resumo.json",
      JSON.stringify(
        {
          geradoEm: new Date().toISOString(),
          exercicio,
          tipos,
          modo,
          total: resultados.length,
          sucessos: resultados.filter((r) => r.status === "ok").length,
          erros: resultados.filter((r) => r.status === "erro").length,
          timeouts: resultados.filter((r) => r.status === "timeout").length,
          resultados,
        },
        null,
        2,
      ),
    );

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename=levantamento-fundeb-batch-${exercicio}.zip`,
      },
    });
  } catch (error) {
    console.error("[Batch FUNDEB] Erro:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Falha ao processar batch." },
      { status: 500 },
    );
  }
}
