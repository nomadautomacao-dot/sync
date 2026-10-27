import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { buildRelatorioSnapshot } from '@/core/lib/relatorio-snapshot';
import { montarRaioXAtuacao } from '@/core/lib/raio-x-atuacao';
import { generateRaioXAtuacaoPdf } from '@/core/lib/raio-x-atuacao-pdf';
import { registrarErro } from '@/core/lib/structured-log';
import type { GeneratedReportArchive } from '@/modules/cidades/reports-types';
import { acompanhamentoSchema } from '@/modules/levantamento-fundeb/acompanhamento';

export const maxDuration = 300;
export const runtime = 'nodejs';
const pedido = z.object({
  codigo_ibge: z.string().trim().regex(/^\d{7}$/).optional(),
  nome: z.string().trim().min(1).max(150).optional(),
  uf: z.string().trim().regex(/^[A-Za-z]{2}$/).transform(v => v.toUpperCase()).optional(),
  exercicio: z.number().int().min(2022).max(2100).optional(),
  response_format: z.enum(['pdf', 'bundle', 'preview']).default('pdf'),
  atualizar: z.boolean().default(false),
  acompanhamento: z.array(z.object({ id:z.string().max(300),groupId:z.string().max(200),codigoIbge:z.string().regex(/^\d{7}$/),exercicio:z.number().int(),acaoId:z.string().max(60),titulo:z.string().max(300),snapshotId:z.string().max(100),linhaBase:z.string().max(4000),atualizadoPor:z.string().max(200),revisao:z.number().int().min(1),acompanhamento:acompanhamentoSchema })).max(100).optional(),
}).refine(v => Boolean(v.codigo_ibge || (v.nome && v.uf)), { message: 'Informe codigo_ibge ou nome e UF.' });

export async function POST(request: NextRequest) {
  const parsed = pedido.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Pedido inválido. Informe código IBGE de 7 dígitos ou nome/UF e um exercício válido.' }, { status: 400 });
  const { response_format, atualizar, acompanhamento, ...identificacao } = parsed.data;
  try {
    const snapshot = await buildRelatorioSnapshot({ ...identificacao, exercicio: identificacao.exercicio ?? new Date().getFullYear() }, atualizar);
    const model = montarRaioXAtuacao(snapshot);
    if(acompanhamento?.some(r=>r.codigoIbge!==model.codigoIbge||r.exercicio!==model.exercicio)) return NextResponse.json({error:'Acompanhamento de outro município ou exercício.'},{status:400});
    model.acompanhamento = acompanhamento;
    const headers = { 'Cache-Control': 'no-store' };
    if (response_format === 'preview') return NextResponse.json(model, { headers });
    const { pdfBuffer, filename, paginas } = await generateRaioXAtuacaoPdf(model);
    if (response_format === 'bundle') {
      const archive: GeneratedReportArchive = {
        schemaVersion: 1, generationId: randomUUID(), reportType: 'raio_x_atuacao', generatedAt: model.geradoEm,
        exercise: model.exercicio, municipality: { name: model.municipio, uf: model.uf, codigoIbge: model.codigoIbge },
        data: { primary: snapshot.current, context: { atuacao: model, qualidade: snapshot.qualidade } },
      };
      return NextResponse.json({ schemaVersion: 1, fileName: filename, mimeType: 'application/pdf', pdfBase64: pdfBuffer.toString('base64'), diagnostics: { paginas, acoes: model.acoes.length }, archive }, { headers });
    }
    return new NextResponse(new Uint8Array(pdfBuffer), { headers: { ...headers, 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"` } });
  } catch (error) {
    registrarErro('Raio-X de Atuação', error, { codigoIbge: identificacao.codigo_ibge });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Falha ao gerar o Raio-X de Atuação.' }, { status: 500 });
  }
}
