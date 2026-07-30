import { chromium, type Browser } from "playwright";

/**
 * Renderiza o Dossiê Comparativo em PDF.
 *
 * Contrato de completude: uma régua no painel e um bloco detalhado por
 * indicador. Os dois têm de bater com o mesmo número — um indicador que
 * aparecesse no painel e sumisse do detalhe (ou o contrário) faria o leitor
 * contar diferente em duas folhas do mesmo documento.
 */
export async function generateDossieComparativoPdf(
  htmlContent: string,
  municipalitySlug: string,
  indicadoresEsperados: number,
): Promise<{ pdfBuffer: Buffer; filename: string; paginas: number }> {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage({ viewport: { width: 816, height: 1056 } });
    await page.setContent(htmlContent, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts?.ready);

    const reguas = await page.locator("tr.regua-linha").count();
    if (reguas !== indicadoresEsperados) {
      throw new Error(
        `O painel imprimiu ${reguas} réguas; a coorte comparou ${indicadoresEsperados} indicadores.`,
      );
    }

    const blocos = await page.locator("article.indicador").count();
    if (blocos !== indicadoresEsperados) {
      throw new Error(
        `O detalhe imprimiu ${blocos} indicadores; o painel tem ${indicadoresEsperados}. As duas folhas precisam contar igual.`,
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
      filename: `DOSSIE_COMPARATIVO_${municipalitySlug}.pdf`,
      paginas,
    };
  } finally {
    await browser?.close();
  }
}
