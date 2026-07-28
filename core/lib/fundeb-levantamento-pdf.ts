import { chromium, type Browser } from "playwright";

import { LEVANTAMENTO_TOTAL_PAGINAS } from "./fundeb-levantamento-template";

/**
 * Renderiza o Levantamento FUNDEB (novo modelo) em PDF.
 *
 * Mesmo caminho do Raio-X: Chromium imprime o HTML já paginado pelo CSS
 * (`@page{size:letter;margin:0}`), em vez de um motor que remonta o layout do
 * zero. `preferCSSPageSize` é o que impede o Chromium de reinterpretar a
 * paginação e quebrar as páginas no meio.
 */
export async function generateLevantamentoPdf(
  htmlContent: string,
  municipalitySlug: string,
  exercicio: number,
): Promise<{ pdfBuffer: Buffer; filename: string }> {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage({ viewport: { width: 816, height: 1056 } });
    await page.setContent(htmlContent, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts?.ready);

    // O relatório tem contagem fixa. Divergência aqui significa seção que não
    // renderizou — melhor falhar do que entregar um documento incompleto.
    const pageCount = await page.locator("section.page").count();
    if (pageCount !== LEVANTAMENTO_TOTAL_PAGINAS) {
      throw new Error(
        `O template do Levantamento gerou ${pageCount} páginas; eram esperadas ${LEVANTAMENTO_TOTAL_PAGINAS}.`,
      );
    }

    const pdfBytes = await page.pdf({
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    return {
      pdfBuffer: Buffer.from(pdfBytes),
      filename: `LEVANTAMENTO_FUNDEB_${municipalitySlug}_${exercicio}.pdf`,
    };
  } finally {
    await browser?.close();
  }
}
