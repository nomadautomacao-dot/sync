import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('@/core/lib/relatorio-snapshot', () => ({ buildRelatorioSnapshot: vi.fn() }));
vi.mock('@/core/lib/raio-x-atuacao', () => ({ montarRaioXAtuacao: vi.fn() }));
vi.mock('@/core/lib/raio-x-atuacao-pdf', () => ({ generateRaioXAtuacaoPdf: vi.fn() }));
vi.mock('@/core/lib/structured-log', () => ({ registrarErro: vi.fn() }));
import { buildRelatorioSnapshot } from '@/core/lib/relatorio-snapshot';
import { montarRaioXAtuacao } from '@/core/lib/raio-x-atuacao';
import { generateRaioXAtuacaoPdf } from '@/core/lib/raio-x-atuacao-pdf';
import { POST } from './route';
const request = (body: unknown) => new NextRequest('http://localhost/api/modulos/levantamento-fundeb/raio-x-atuacao', { method: 'POST', body: JSON.stringify(body) });
beforeEach(() => vi.resetAllMocks());
describe('emissão de Raio-X de Atuação', () => {
  it.each([{}, { codigo_ibge: '123' }, { codigo_ibge: '2304400', exercicio: '2026' }, { codigo_ibge: '2304400', response_format: 'html' }])('rejeita pedido inválido antes da coleta: %j', async body => {
    expect((await POST(request(body))).status).toBe(400);
    expect(buildRelatorioSnapshot).not.toHaveBeenCalled();
  });
  it('retorna a prévia sem abrir o renderer de PDF', async () => {
    vi.mocked(buildRelatorioSnapshot).mockResolvedValue({ current: {}, qualidade: {} } as never);
    vi.mocked(montarRaioXAtuacao).mockReturnValue({ snapshotId: 'teste', acoes: [] } as never);
    const r = await POST(request({ codigo_ibge: '2304400', exercicio: 2026, response_format: 'preview' }));
    expect(await r.json()).toMatchObject({ snapshotId: 'teste' });
    expect(generateRaioXAtuacaoPdf).not.toHaveBeenCalled();
  });
  it('arquiva a versão, snapshot e plano efetivamente usados', async () => {
    vi.mocked(buildRelatorioSnapshot).mockResolvedValue({ current: { payload: {} }, qualidade: { snapshotId: 'base-1' } } as never);
    vi.mocked(montarRaioXAtuacao).mockReturnValue({ municipio: 'Fortaleza', uf: 'CE', codigoIbge: '2304400', exercicio: 2026, geradoEm: '2026-10-26T12:00:00Z', snapshotId: 'base-1', versao: '1.0.0', acoes: [] } as never);
    vi.mocked(generateRaioXAtuacaoPdf).mockResolvedValue({ pdfBuffer: Buffer.from('%PDF'), filename: 'teste.pdf', paginas: 4, html: '' });
    const r = await POST(request({ codigo_ibge: '2304400', exercicio: 2026, response_format: 'bundle' }));
    const b = await r.json();
    expect(b.archive.reportType).toBe('raio_x_atuacao');
    expect(b.archive.data.context.atuacao.snapshotId).toBe('base-1');
    expect(b.archive.data.context.atuacao.versao).toBe('1.0.0');
    expect(b.pdfBase64).toBe(Buffer.from('%PDF').toString('base64'));
    expect(r.headers.get('Cache-Control')).toBe('no-store');
  });
});
