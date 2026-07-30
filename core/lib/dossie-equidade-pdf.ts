import { chromium, type Browser } from "playwright";

/**
 * Renderiza o Dossiê da Equidade e dos Territórios em PDF.
 *
 * Contrato de completude: uma linha por ano de cada série de cor/raça e um
 * bloco por povo com corrente montada. A série é curta — três anos, duas redes
 * —, e é exatamente por isso que perder um ano seria grave: o achado da folha é
 * a **variação** entre anos consecutivos, e uma linha faltando muda o
 * diagnóstico de mudança de cadastro.
 */
export async function generateDossieEquidadePdf(
  htmlContent: string,
  municipalitySlug: string,
  anosEsperados: number,
  correntesEsperadas: number,
): Promise<{ pdfBuffer: Buffer; filename: string; paginas: number }> {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage({ viewport: { width: 816, height: 1056 } });
    await page.setContent(htmlContent, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts?.ready);

    const anos = await page.locator("tr.ano-serie").count();
    if (anos !== anosEsperados) {
      throw new Error(
        `O dossiê imprimiu ${anos} anos de série de cor/raça; as duas redes somam ${anosEsperados}.`,
      );
    }

    const correntes = await page.locator("article.corrente").count();
    if (correntes !== correntesEsperadas) {
      throw new Error(
        `O dossiê imprimiu ${correntes} correntes de povo; o município tem ${correntesEsperadas} acima do piso de conferência.`,
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
      filename: `DOSSIE_EQUIDADE_${municipalitySlug}.pdf`,
      paginas,
    };
  } finally {
    await browser?.close();
  }
}
