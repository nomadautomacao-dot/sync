import {NextRequest,NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {buildRelatorioSnapshot} from '@/core/lib/relatorio-snapshot';
import {fetchMunicipalBoundary} from '@/core/lib/ibge-municipal-boundary';
import {generateMunicipalXrayVisual} from '@/core/lib/municipal-xray-visual';
import {generateMunicipalXrayVisualPdf} from '@/core/lib/municipal-xray-visual-pdf';
import {REPORT_VISUAL_VERSION} from '@/core/lib/report-visual-theme';
import type {GeneratedReportArchive} from '@/modules/cidades/reports-types';

export const maxDuration=300;
export const runtime='nodejs';
const schema=z.object({codigo_ibge:z.string().trim().regex(/^\d{7}$/).optional(),nome:z.string().trim().min(1).max(150).optional(),uf:z.string().trim().regex(/^[A-Za-z]{2}$/).optional(),exercicio:z.number().int().min(2022).max(2100).optional(),response_format:z.enum(['pdf','bundle','html']).default('pdf')}).refine(x=>Boolean(x.codigo_ibge||(x.nome&&x.uf)));
export async function POST(req:NextRequest){
 const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'Informe código IBGE ou nome/UF e exercício válido.'},{status:400});
 try{
  const {response_format,...params}=parsed.data;
  const s=await buildRelatorioSnapshot(params);
  const id=s.current.relatorio.identificacao;
  const boundary=await fetchMunicipalBoundary(String(id.codigoIBGE))??s.boundary;
  const visual=generateMunicipalXrayVisual(s,boundary);
  const slug=`${id.municipioNome}_${id.uf}_${id.exercicio}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_]/g,'_').toUpperCase();
  const headers={'Cache-Control':'no-store','X-Report-Visual-Version':REPORT_VISUAL_VERSION};
  if(response_format==='html')return new NextResponse(visual.interactiveHtml,{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Disposition':`attachment; filename="RAIO_X_VISUAL_${slug}.html"`,'X-Content-Type-Options':'nosniff'}});
  const {pdfBuffer,pages}=await generateMunicipalXrayVisualPdf(visual.pdfHtml,visual.pages);
  const fileName=`RAIO_X_VISUAL_${slug}.pdf`;
  if(response_format==='bundle'){
   const archive:GeneratedReportArchive={schemaVersion:1,generationId:randomUUID(),reportType:'raio_x_visual',generatedAt:new Date().toISOString(),exercise:id.exercicio,municipality:{name:id.municipioNome,uf:id.uf,codigoIbge:String(id.codigoIBGE)},data:{primary:s.current,context:{visualVersion:REPORT_VISUAL_VERSION,qualidade:s.qualidade,inteligencia:s.inteligencia,boundary}}};
   return NextResponse.json({schemaVersion:1,fileName,mimeType:'application/pdf',pdfBase64:pdfBuffer.toString('base64'),archive,diagnostics:{paginas:pages,visualVersion:REPORT_VISUAL_VERSION}}, {headers});
  }
  return new NextResponse(new Uint8Array(pdfBuffer),{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${fileName}"`}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Falha na emissão visual.'},{status:500})}
}
