import { chromium, type Browser } from "playwright";

/**
 * Renderiza o Dever de Casa em PDF.
 *
 * Sem contrato de páginas — o volume é função das fontes que responderam. O
 * contrato é de completude: **toda linha de item julgado tem de estar
 * impressa** (`tr.item`). Item que some é veredito que o consultor não vê, e
 * um placar de "9 de 14" com 12 linhas visíveis é pior que a falha.
 */
export async function generateDeverDeCasaPdf(
  htmlContent: string,
  municipalitySlug: string,
  itensEsperados: number,
): Promise<{ pdfBuffer: Buffer; filename: string }> {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage({ viewport: { width: 816, height: 1056 } });
    await page.setContent(htmlContent, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts?.ready);

    if (itensEsperados > 0) {
      const linhas = await page.locator("section.flow tr.item").count();
      if (linhas < itensEsperados) {
        throw new Error(
          `O Dever de Casa imprimiu ${linhas} itens; o julgamento tem ${itensEsperados}. ` +
            "Item que some é veredito que o consultor não vê.",
        );
      }
    }

    const pdfBytes = await page.pdf({
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    return {
      pdfBuffer: Buffer.from(pdfBytes),
      filename: `DEVER_DE_CASA_${municipalitySlug}.pdf`,
    };
  } finally {
    await browser?.close();
  }
}
