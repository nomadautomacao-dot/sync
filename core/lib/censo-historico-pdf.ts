import { chromium, type Browser } from "playwright";

import { ajustarParaCaber, assertSemCorte } from "./pdf-corte";

/** Contrato de folhas do documento. A tela de emissão anuncia este número. */
export const PAGINAS_ESPERADAS_HISTORICO_CENSO = 11;

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
    const pageCount = await page.locator("section.page").count();
    if (pageCount !== PAGINAS_ESPERADAS_HISTORICO_CENSO) {
      throw new Error(
        `O template do Histórico do Censo gerou ${pageCount} páginas; eram esperadas ${PAGINAS_ESPERADAS_HISTORICO_CENSO}.`,
      );
    }

    // O contrato acima conta seções; o que vem agora verifica se o conteúdo
    // coube nelas. Com overflow:hidden, corte não muda a contagem nem gera
    // folha extra — some em silêncio. Ver `pdf-corte.ts`.
    //
    // O volume varia por município, então a página que cabe num estoura no
    // outro: primeiro encolhe o que passou, depois falha se nem no piso coube.
    const ajustadas = await ajustarParaCaber(page);
    if (ajustadas.length > 0) {
      console.info(
        `[Histórico do Censo] ${ajustadas.length} página(s) ajustadas para caber:`,
        ajustadas.map((a) => `p${a.pagina} ${Math.round(a.escala * 100)}%`).join(", "),
      );
    }
    await assertSemCorte(page, "Histórico do Censo");

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
