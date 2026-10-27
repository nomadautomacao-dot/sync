import {describe,it,expect,vi,beforeEach} from 'vitest';
import {NextRequest} from 'next/server';
vi.mock('@/core/lib/relatorio-snapshot',()=>({buildRelatorioSnapshot:vi.fn()}));
vi.mock('@/core/lib/ibge-municipal-boundary',()=>({fetchMunicipalBoundary:vi.fn().mockResolvedValue(null)}));
vi.mock('@/core/lib/municipal-xray-visual',()=>({generateMunicipalXrayVisual:vi.fn().mockReturnValue({pdfHtml:'<html>PDF</html>',interactiveHtml:'<html>Interativo</html>',pages:10})}));
vi.mock('@/core/lib/municipal-xray-visual-pdf',()=>({generateMunicipalXrayVisualPdf:vi.fn().mockResolvedValue({pdfBuffer:Buffer.from('%PDF-1.7'),pages:10})}));
import {buildRelatorioSnapshot} from '@/core/lib/relatorio-snapshot';
import {generateMunicipalXrayVisualPdf} from '@/core/lib/municipal-xray-visual-pdf';
import {POST} from './route';
const request=(body:unknown)=>new NextRequest('http://localhost/api/modulos/levantamento-fundeb/raio-x-visual',{method:'POST',body:JSON.stringify(body)});
beforeEach(()=>{vi.clearAllMocks();vi.mocked(buildRelatorioSnapshot).mockResolvedValue({current:{relatorio:{identificacao:{municipioNome:'Fortaleza',uf:'CE',codigoIBGE:'2304400',exercicio:2026}}},qualidade:{snapshotId:'base-validada'},inteligencia:{versao:1},boundary:null} as never)});
describe('Emissão e arquivo da edição visual',()=>{
 it('rejeita município inválido antes de consultar fontes',async()=>{expect((await POST(request({codigo_ibge:'123'}))).status).toBe(400);expect(buildRelatorioSnapshot).not.toHaveBeenCalled()});
 it('arquiva a identidade, a base de dados e a versão visual junto ao PDF',async()=>{const r=await POST(request({codigo_ibge:'2304400',response_format:'bundle'}));const b=await r.json();expect(r.status).toBe(200);expect(b.archive).toMatchObject({reportType:'raio_x_visual',exercise:2026,municipality:{codigoIbge:'2304400'},data:{context:{visualVersion:'2026.1',qualidade:{snapshotId:'base-validada'}}}});expect(b.pdfBase64).toBeTruthy()});
 it('permite baixar o HTML interativo sem renderização de PDF',async()=>{const r=await POST(request({codigo_ibge:'2304400',response_format:'html'}));expect(r.headers.get('Content-Type')).toContain('text/html');expect(r.headers.get('Content-Disposition')).toContain('attachment');expect(await r.text()).toContain('Interativo');expect(generateMunicipalXrayVisualPdf).not.toHaveBeenCalled()});
});
