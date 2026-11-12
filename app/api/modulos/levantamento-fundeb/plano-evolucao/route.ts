import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { montarPlanoEvolucao } from "@/core/lib/plano-evolucao";
import { generatePlanoEvolucaoPdf } from "@/core/lib/plano-evolucao-pdf";
import { buildRelatorioSnapshot } from "@/core/lib/relatorio-snapshot";
import { registrarErro } from "@/core/lib/structured-log";
import type { GeneratedReportArchive } from "@/modules/cidades/reports-types";

/**
 * Plano de evolução FUNDEB — duas folhas que transformam o levantamento em
 * proposta de trabalho. Mesma coleta do levantamento (`buildRelatorioSnapshot`,
 * com cache), então os números das duas peças são os mesmos.
 *
 * `preview` devolve o modelo sem abrir o Chromium; `bundle` devolve PDF e JSON
 * de arquivamento, que é o que a tela de emissão e a fila consomem.
 */
export const maxDuration = 300;
export const runtime = "nodejs";

const pedido = z
  .object({
    codigo_ibge: z.string().trim().regex(/^\d{7}$/).optional(),
    nome: z.string().trim().min(1).max(150).optional(),
    uf: z.string().trim().regex(/^[A-Za-z]{2}$/).transform((v) => v.toUpperCase()).optional(),
    exercicio: z.number().int().min(2022).max(2100).optional(),
    response_format: z.enum(["pdf", "bundle", "preview"]).default("pdf"),
    atualizar: z.boolean().default(false),
  })
  .refine((v) => Boolean(v.codigo_ibge || (v.nome && v.uf)), { message: "Informe codigo_ibge ou nome e UF." });

export async function POST(request: NextRequest) {
  const parsed = pedido.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Pedido inválido. Informe código IBGE de 7 dígitos ou nome/UF e um exercício válido." }, { status: 400 });
  const { response_format, atualizar, ...identificacao } = parsed.data;
  try {
    const snapshot = await buildRelatorioSnapshot({ ...identificacao, exercicio: identificacao.exercicio ?? new Date().getFullYear() }, atualizar);
    const model = montarPlanoEvolucao(snapshot);
    const headers = { "Cache-Control": "no-store" };
    if (response_format === "preview") return NextResponse.json(model, { headers });
    const { pdfBuffer, filename, paginas } = await generatePlanoEvolucaoPdf(model);
    if (response_format === "bundle") {
      const archive: GeneratedReportArchive = {
        schemaVersion: 1,
        generationId: randomUUID(),
        reportType: "plano_evolucao",
        generatedAt: model.geradoEm,
        exercise: model.exercicio,
        municipality: { name: model.municipio, uf: model.uf, codigoIbge: model.codigoIbge },
        data: { primary: snapshot.current, context: { plano: model, qualidade: snapshot.qualidade } },
      };
      return NextResponse.json(
        { schemaVersion: 1, fileName: filename, mimeType: "application/pdf", pdfBase64: pdfBuffer.toString("base64"), diagnostics: { paginas, frentes: model.frentes.length }, archive },
        { headers },
      );
    }
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"` },
    });
  } catch (error) {
    registrarErro("Plano de evolução FUNDEB", error, { codigoIbge: identificacao.codigo_ibge });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao gerar o plano de evolução." }, { status: 500 });
  }
}
