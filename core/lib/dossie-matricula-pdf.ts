import { chromium, type Browser } from "playwright";

/**
 * Renderiza o Dossiê da Matrícula Ponderada em PDF.
 *
 * ## O contrato aqui
 *
 * Como no Dossiê das Escolas, o número de folhas é função do município e não
 * pode ser travado. O que se confere é **completude**: a tabela principal tem
 * de imprimir uma linha por segmento declarado, e o anexo, uma linha por
 * segmento da Portaria.
 *
 * Um segmento que suma no meio do caminho é a falha que este produto não pode
 * ter — a tabela existe justamente para ser conferida contra a planilha do
 * FNDE, e uma linha faltando inverte o sinal de tudo o que ela prova.
 *
 * `pdf-corte.ts` não roda aqui: ele detecta conteúdo cortado por
 * `overflow:hidden`, regime das seções de altura fixa. Nas de fluxo, transbordar
 * para a folha seguinte é o comportamento correto.
 */
export async function generateDossieMatriculaPdf(
  htmlContent: string,
  municipalitySlug: string,
  segmentosEsperados: number,
  catalogoEsperado: number,
): Promise<{ pdfBuffer: Buffer; filename: string; paginas: number }> {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage({ viewport: { width: 816, height: 1056 } });
    await page.setContent(htmlContent, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts?.ready);

    const segmentos = await page.locator("tr.seg").count();
    if (segmentos !== segmentosEsperados) {
      throw new Error(
        `A tabela de segmentos imprimiu ${segmentos} linhas; o município declara ${segmentosEsperados}. ` +
          "A tabela existe para ser conferida contra a planilha do FNDE — linha faltando invalida a conferência.",
      );
    }

    const catalogo = await page.locator("tr.cat").count();
    if (catalogo !== catalogoEsperado) {
      throw new Error(
        `O anexo imprimiu ${catalogo} segmentos; a Portaria tem ${catalogoEsperado}.`,
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
      filename: `DOSSIE_MATRICULA_PONDERADA_${municipalitySlug}.pdf`,
      paginas,
    };
  } finally {
    await browser?.close();
  }
}
