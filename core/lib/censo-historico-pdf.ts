import { chromium, type Browser } from "playwright";

export async function generateCensoHistoricoPdf(
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

    // Capa + como ler + 8 páginas de séries (redes, infantil, fundamental,
    // EJA/especial, cor/raça, integral, docentes/escolas, infraestrutura) +
    // leitura da trajetória com perguntas de campo.
    const PAGINAS_ESPERADAS = 11;
    const pageCount = await page.locator("section.page").count();
    if (pageCount !== PAGINAS_ESPERADAS) {
      throw new Error(
        `O template do Histórico do Censo gerou ${pageCount} páginas; eram esperadas ${PAGINAS_ESPERADAS}.`,
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
      filename: `HISTORICO_CENSO_${municipalitySlug}.pdf`,
    };
  } finally {
    await browser?.close();
  }
}
