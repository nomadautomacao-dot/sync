import { applyReportVisualTheme } from './report-visual-theme';
import { chromium } from 'playwright';
import { assertSemCorte } from './pdf-corte';
import type { RaioXAtuacao } from './raio-x-atuacao';
import { generateRaioXAtuacaoHtml } from './raio-x-atuacao-template';

export async function generateRaioXAtuacaoPdf(model: RaioXAtuacao) {
  const html = generateRaioXAtuacaoHtml(model);
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
    await page.emulateMedia({ media: 'print' });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await applyReportVisualTheme(page, `${model.municipio}_${model.uf}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase());
    const ids = await page.locator('[data-acao]').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-acao')));
    if (JSON.stringify(ids) !== JSON.stringify(model.acoes.map(a => a.id))) throw new Error('Ficha de ação ausente ou duplicada no PDF.');
    if (await page.locator('[data-documento]').count() !== model.documentos.length) throw new Error('Pedido documental ausente no PDF.');
    await assertSemCorte(page, 'Raio-X de Atuação');
    const overflow = await page.evaluate(() => [...document.querySelectorAll('.page-body')].some(el => el.scrollWidth > el.clientWidth + 2));
    if (overflow) throw new Error('Conteúdo excede a largura disponível do PDF.');
    const paginas = await page.locator('section.page').count();
    const pdfBuffer = Buffer.from(await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } }));
    const slug = `${model.municipio}_${model.uf}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase();
    return { pdfBuffer, filename: `RAIO_X_ATUACAO_${slug}_${model.exercicio}.pdf`, paginas, html };
  } finally { await browser.close(); }
}
