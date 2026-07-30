import { chromium, type Browser } from "playwright";

/**
 * Renderiza o Dossiê do Dinheiro Federal em PDF.
 *
 * O contrato é de **completude**, como nos demais dossiês: uma obra por bloco e
 * um convênio por linha. Aqui ele importa mais que nos outros porque as duas
 * listas vêm de consulta ao vivo — uma página que perdesse silenciosamente as
 * últimas linhas produziria um inventário incompleto com cara de completo, e é
 * contra isso que o cliente confere.
 */
export async function generateDossieDinheiroPdf(
  htmlContent: string,
  municipalitySlug: string,
  obrasEsperadas: number,
  conveniosEsperados: number,
): Promise<{ pdfBuffer: Buffer; filename: string; paginas: number }> {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage({ viewport: { width: 816, height: 1056 } });
    await page.setContent(htmlContent, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts?.ready);

    const obras = await page.locator("article.obra").count();
    if (obras !== obrasEsperadas) {
      throw new Error(
        `O dossiê imprimiu ${obras} obras; o painel do Pacto lista ${obrasEsperadas} no município.`,
      );
    }

    const convenios = await page.locator("tr.conv").count();
    if (convenios !== conveniosEsperados) {
      throw new Error(
        `O dossiê imprimiu ${convenios} convênios; a consulta trouxe ${conveniosEsperados} vigentes.`,
      );
    }

    const pdfBytes = await page.pdf({
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    const paginas = (pdfBytes.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;

    return {
      pdfBuffer: Buffer.from(pdfBytes),
      filename: `DOSSIE_DINHEIRO_FEDERAL_${municipalitySlug}.pdf`,
      paginas,
    };
  } finally {
    await browser?.close();
  }
}
