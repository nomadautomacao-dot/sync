import {afterEach, describe, expect, it, vi} from 'vitest';
import {emitirPdf} from './emissao';

afterEach(() => vi.unstubAllGlobals());
describe('emissão automática de PDF', () => {
  it('usa o MIME do PDF contido no bundle e preserva o município solicitado', async () => {
    vi.stubGlobal('window', {atob:globalThis.atob});
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      schemaVersion:1,fileName:'RAIO_X.pdf',mimeType:'application/pdf',pdfBase64:Buffer.from('%PDF-1.7 teste').toString('base64'),
      archive:{schemaVersion:1,generationId:'geracao-1',reportType:'raio_x_visual',generatedAt:'2026-10-27T12:00:00Z',exercise:2026,municipality:{name:'Fortaleza',uf:'CE',codigoIbge:'2304400'},data:{primary:{}}},
    }), {headers:{'Content-Type':'application/json'}})));
    const result=await emitirPdf({id:'raio-x-visual',nome:'Raio-X',endpoint:'/api/relatorio',reportType:'raio_x_visual'}, {codigoIbge:'2304400',nome:'Fortaleza',uf:'CE'});
    expect(result.contentType).toBe('application/pdf');
    expect(result.blob.type).toBe('application/pdf');
    expect(await result.blob.text()).toContain('%PDF-1.7');
    expect(result.generationId).toBe('geracao-1');
  });
});
