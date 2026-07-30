import { chromium, type Browser } from "playwright";

export async function generateOficioDocumentosPdf(
  htmlContent: string,
  municipalitySlug: string,
): Promise<{ pdfBuffer: Buffer; filename: string }> {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage({ viewport: { width: 816, height: 1056 } });
    await page.setContent(htmlContent, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts?.ready);

    // 1 do ofício + 1 do detalhamento dos documentos + 2 do questionário.
    //
    // O contrato conta `<section class="page">` no DOM e NÃO enxerga
    // transbordo: conteúdo que estoura a altura vira folha extra só no PDF
    // impresso. Ao engordar uma página existente, conferir as folhas reais —
    // ver a seção do contrato de páginas em `docs/continuar-no-mac.md`.
    const PAGINAS_ESPERADAS = 4;
    const pageCount = await page.locator("section.page").count();
    if (pageCount !== PAGINAS_ESPERADAS) {
      throw new Error(
        `O template do Ofício gerou ${pageCount} páginas; eram esperadas ${PAGINAS_ESPERADAS}.`,
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
      filename: `OFICIO_DOCUMENTOS_${municipalitySlug}.pdf`,
    };
  } finally {
    await browser?.close();
  }
}
