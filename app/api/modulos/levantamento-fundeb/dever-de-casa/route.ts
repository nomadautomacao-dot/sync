import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildGoviaMunicipioCompleto } from "@/core/lib/govia-compat";
import { markGoviaMunicipioAccess } from "@/core/lib/govia-storage";
import { montarDeverDeCasa } from "@/core/lib/dever-de-casa";
import { generateDeverDeCasaHtml } from "@/core/lib/dever-de-casa-template";
import { generateDeverDeCasaPdf } from "@/core/lib/dever-de-casa-pdf";
import { registrarErro } from "@/core/lib/structured-log";

/**
 * Dever de Casa — o veredito interno, item a item.
 *
 * Substitui o antigo "Comercial Premium": em vez de um deck de venda com o
 * dado acoplado depois, um julgamento com parâmetro legal, dado apurado e
 * veredito em cada linha. Documento de uso interno — não vai ao município.
 */
export const maxDuration = 300;

interface DeverRequest {
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

/** Prévia para a tela: nota e placar, sem gerar o PDF. */
export async function GET(request: NextRequest) {
  const codigo = request.nextUrl.searchParams.get("codigo_ibge")?.trim();
  const uf = request.nextUrl.searchParams.get("uf")?.trim() ?? "";
  if (!codigo) {
    return NextResponse.json({ error: "Informe codigo_ibge." }, { status: 400 });
  }

  const dever = await montarDeverDeCasa(codigo, uf);
  return NextResponse.json({
    nota: dever.placar.nota,
    rotulo: dever.placar.rotulo,
    cumpre: dever.placar.cumpre,
    avaliados: dever.placar.avaliados,
    semDado: dever.placar.semDado,
    // Capa + placar, um flow por bloco, dinheiro (quando há) e fontes.
    paginasEstimadas: 2 + dever.blocos.length + (dever.naMesa.length || dever.potencial.length ? 1 : 0) + 1,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DeverRequest;
    const hasCodigo = Boolean(body.codigo_ibge?.trim());
    const hasNomeUf = Boolean(body.nome?.trim() && body.uf?.trim());
    if (!hasCodigo && !hasNomeUf) {
      return NextResponse.json(
        { error: "Informe codigo_ibge ou o par nome/uf para gerar o relatório." },
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
    const dever = await montarDeverDeCasa(basicos.codigo_ibge, basicos.uf, geradoEm);

    // Nota sobre zero item verificável não é veredito, é falha de coleta — e
    // entregá-la como relatório seria pior que o erro.
    if (dever.placar.avaliados === 0) {
      return NextResponse.json(
        {
          error:
            "Nenhum item pôde ser verificado nesta emissão — as fontes vivas não responderam e os datasets locais não cobrem o município. Tente novamente em horário comercial.",
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

    const html = generateDeverDeCasaHtml({
      municipio: basicos.nome,
      uf: basicos.uf,
      dever,
      geradoEm,
      logoDataUri: await carregarLogo(),
    });

    const totalItens = dever.blocos.reduce((t, b) => t + b.itens.length, 0);
    const { pdfBuffer, filename } = await generateDeverDeCasaPdf(
      html,
      `${slug(basicos.nome)}_${slug(basicos.uf)}`,
      totalItens,
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
            reportType: "dever_de_casa",
            generatedAt: geradoEm.toISOString(),
            exercise: geradoEm.getFullYear(),
            municipality: {
              name: basicos.nome,
              uf: basicos.uf,
              codigoIbge: basicos.codigo_ibge,
            },
            data: { primary: municipio, context: { dever } },
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
    registrarErro("Dever de Casa", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao gerar o relatório." },
      { status: 500 },
    );
  }
}
