import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { getSessionUser } from "@/core/lib/auth";
import { generateCaseSucessoHtml } from "@/core/lib/case-sucesso-template";
import { generateCaseSucessoPdf } from "@/core/lib/case-sucesso-pdf";
import { registrarErro } from "@/core/lib/structured-log";
import { montarCaseSucesso } from "@/modules/case-de-sucesso/montar";

/**
 * Case de Sucesso — o deck comercial com a evolução do FUNDEB das redes atendidas.
 *
 * Toda fonte é dataset local (`data/fnde/receitas-*.csv`); a emissão não vai à
 * rede. O `maxDuration` folgado existe pelo Chromium, não pela coleta.
 */
export const maxDuration = 300;

const entradaSchema = z.object({
  codigoIbge: z.string().regex(/^\d{7}$/, "Código IBGE tem 7 dígitos."),
  /**
   * O último exercício que a Global reivindica naquela rede — e não o exercício
   * mais recente que existe. Município em que a consultoria saiu antes precisa
   * fechar no ano em que ainda estava lá.
   */
  fim: z.number().int().min(2023).max(2030),
  inicio: z.number().int().min(2022).max(2030).optional(),
  /**
   * O nome acentuado, que a tela tem do IBGE.
   *
   * As portarias do FNDE trazem "SAO FELIX DO CORIBE"; o deck que sai daqui vai
   * para a mesa do prefeito, e escrever o nome do município errado na capa é o
   * tipo de detalhe que apaga o resto do documento.
   */
  nome: z.string().trim().min(2).max(120).optional(),
});

const corpoSchema = z.object({
  municipios: z.array(entradaSchema).min(1, "Informe ao menos um município.").max(12),
});

function slug(valor: string) {
  return valor
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

/**
 * Prévia para a tela: apura os números sem gerar o PDF.
 *
 * É o que permite à tela mostrar o resultado antes de disparar uma emissão que
 * leva minutos — e o que deixa o usuário ajustar a janela de cada município
 * vendo o efeito na hora.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  // `2909109:2026,2930154:2025` — código e último exercício reivindicado.
  // A prévia não carrega o nome: quem a lê é a tela, que já o tem do IBGE. O
  // nome só importa na emissão, que é quando ele vai impresso.
  const bruto = request.nextUrl.searchParams.get("municipios")?.trim();
  if (!bruto) {
    return NextResponse.json(
      { error: "Informe municipios=<ibge>:<ano final>, separados por vírgula." },
      { status: 400 },
    );
  }

  const entradas = bruto.split(",").map((parte) => {
    const [codigoIbge, fim] = parte.split(":");
    return { codigoIbge: (codigoIbge ?? "").trim(), fim: Number(fim) };
  });

  const parsed = corpoSchema.safeParse({ municipios: entradas });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  try {
    const caso = await montarCaseSucesso(parsed.data.municipios);
    return NextResponse.json({ caso });
  } catch (error) {
    registrarErro("Case de Sucesso — prévia", error, { municipios: bruto });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao apurar o case." },
      { status: 422 },
    );
  }
}

/** Emite o deck em PDF. */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = corpoSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  try {
    const caso = await montarCaseSucesso(parsed.data.municipios);
    const html = generateCaseSucessoHtml({ caso, logoDataUri: await carregarLogo() });

    const fim = Math.max(...caso.municipios.map((m) => m.fim));
    const inicio = Math.min(...caso.municipios.map((m) => m.inicio));
    const identificacao =
      caso.municipios.length === 1 ? slug(caso.municipios[0].nome) : `${caso.municipios.length}_REDES`;
    const nomeArquivo = `CASE_SUCESSO_${identificacao}_${inicio}_${fim}.pdf`;

    const { pdfBuffer, filename, folhas } = await generateCaseSucessoPdf(
      html,
      nomeArquivo,
      caso.municipios.length,
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Case-Folhas": String(folhas),
        "X-Case-Municipios": String(caso.municipios.length),
      },
    });
  } catch (error) {
    registrarErro("Case de Sucesso — emissão", error, {
      municipios: parsed.data.municipios.map((m) => m.codigoIbge).join(","),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao gerar o case." },
      { status: 500 },
    );
  }
}
