import { chromium, type Browser } from "playwright";

/**
 * Renderiza o Dossiê da Aprendizagem em PDF.
 *
 * Contrato de completude: uma folha de bloco por prova do Saeb e uma linha por
 * edição do IDEB. As duas listas são curtas — quatro provas, dez edições —, o
 * que torna a conferência barata e a omissão silenciosa especialmente cara:
 * perder a prova de Matemática do 9º ano num documento sobre distribuição de
 * aprendizagem inverteria o sentido do que sobra.
 */
export async function generateDossieAprendizagemPdf(
  htmlContent: string,
  municipalitySlug: string,
  seriesEsperadas: number,
  edicoesEsperadas: number,
): Promise<{ pdfBuffer: Buffer; filename: string; paginas: number }> {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage({ viewport: { width: 816, height: 1056 } });
    await page.setContent(htmlContent, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts?.ready);

    const series = await page.locator("article.serie").count();
    if (series !== seriesEsperadas) {
      throw new Error(
        `O dossiê imprimiu ${series} provas do Saeb; a divulgação traz ${seriesEsperadas} para esta rede.`,
      );
    }

    const edicoes = await page.locator("tr.ano-ideb").count();
    if (edicoes !== edicoesEsperadas) {
      throw new Error(
        `O dossiê imprimiu ${edicoes} edições do IDEB; a série do município tem ${edicoesEsperadas}.`,
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
      filename: `DOSSIE_APRENDIZAGEM_${municipalitySlug}.pdf`,
      paginas,
    };
  } finally {
    await browser?.close();
  }
}
