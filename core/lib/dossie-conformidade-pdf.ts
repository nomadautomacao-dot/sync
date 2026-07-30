import { chromium, type Browser } from "playwright";

/**
 * Renderiza o Dossiê da Conformidade em PDF.
 *
 * Como o Dossiê das Escolas, aqui não há contrato de páginas — o volume é
 * função do que as fontes devolveram na emissão. O contrato é de completude:
 * o número de linhas impressas na tabela de requisitos tem de bater com o
 * número de requisitos do extrato. Requisito que suma é pendência que o
 * município não vai ver.
 */
export async function generateDossieConformidadePdf(
  htmlContent: string,
  municipalitySlug: string,
  requisitosEsperados: number,
): Promise<{ pdfBuffer: Buffer; filename: string }> {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage({ viewport: { width: 816, height: 1056 } });
    await page.setContent(htmlContent, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts?.ready);

    if (requisitosEsperados > 0) {
      const linhas = await page.locator("section.flow table.lista td.cod").count();
      if (linhas < requisitosEsperados) {
        throw new Error(
          `O Dossiê da Conformidade imprimiu ${linhas} linhas de código; o extrato tem ${requisitosEsperados} requisitos. ` +
            "Requisito que some é pendência que o município não vê.",
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
      filename: `DOSSIE_CONFORMIDADE_${municipalitySlug}.pdf`,
    };
  } finally {
    await browser?.close();
  }
}
