import { chromium, type Browser } from "playwright";

/**
 * Renderiza o Dossiê das Escolas em PDF.
 *
 * ## Por que não há contrato de páginas aqui
 *
 * O Raio-X e o Levantamento conferem a contagem de folhas contra uma constante:
 * página a mais significa seção duplicada, e falhar é melhor que entregar
 * documento torto. Neste dossiê o número de folhas é **função do município** —
 * 20 escolas em Ibateguara, 508 em Manaus — e travar a contagem seria travar o
 * produto.
 *
 * O contrato aqui é de **completude**: o número de blocos de escola impressos
 * tem de bater com o número de escolas da rede. Uma escola que suma no meio do
 * caminho — por erro de template, por filtro esquecido — é exatamente a falha
 * que este produto não pode ter, porque o cliente conta as dele.
 *
 * `pdf-corte.ts` **não** roda aqui: ele detecta conteúdo cortado por
 * `overflow:hidden`, que é o regime das seções de altura fixa. As seções de
 * fluxo devem transbordar para a folha seguinte, e transbordo lá é o
 * comportamento correto, não defeito.
 */
export async function generateDossieEscolasPdf(
  htmlContent: string,
  municipalitySlug: string,
  escolasEsperadas: number,
): Promise<{ pdfBuffer: Buffer; filename: string; paginas: number }> {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage({ viewport: { width: 816, height: 1056 } });
    await page.setContent(htmlContent, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts?.ready);

    const blocos = await page.locator("article.escola").count();
    if (blocos !== escolasEsperadas) {
      throw new Error(
        `O Dossiê das Escolas imprimiu ${blocos} blocos; a rede tem ${escolasEsperadas} escolas. ` +
          "Nenhuma unidade pode ficar de fora — o cliente conta as dele.",
      );
    }

    const pdfBytes = await page.pdf({
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    // Contagem só para o log e para a UI avisar o tamanho antes do download.
    const paginas = (pdfBytes.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;

    return {
      pdfBuffer: Buffer.from(pdfBytes),
      filename: `DOSSIE_ESCOLAS_${municipalitySlug}.pdf`,
      paginas,
    };
  } finally {
    await browser?.close();
  }
}
