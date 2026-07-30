import { chromium, type Browser } from "playwright";

/**
 * Renderiza o Dossiê da Demanda em PDF.
 *
 * Contrato de completude: uma linha por coorte de nascimento e uma por faixa
 * etária. As duas listas são curtas — cinco coortes, quatro faixas —, e é
 * justamente por isso que a omissão silenciosa seria cara: perder uma coorte
 * num calendário de chegada muda o ano em que a rede precisa da vaga.
 */
export async function generateDossieDemandaPdf(
  htmlContent: string,
  municipalitySlug: string,
  coortesEsperadas: number,
  faixasEsperadas: number,
): Promise<{ pdfBuffer: Buffer; filename: string; paginas: number }> {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage({ viewport: { width: 816, height: 1056 } });
    await page.setContent(htmlContent, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts?.ready);

    const coortes = await page.locator("tr.coorte").count();
    if (coortes !== coortesEsperadas) {
      throw new Error(
        `O dossiê imprimiu ${coortes} coortes de nascimento; o Registro Civil trouxe ${coortesEsperadas}.`,
      );
    }

    const faixas = await page.locator("tr.faixa").count();
    if (faixas !== faixasEsperadas) {
      throw new Error(
        `O dossiê imprimiu ${faixas} faixas etárias; o Censo trouxe população para ${faixasEsperadas}.`,
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
      filename: `DOSSIE_DEMANDA_${municipalitySlug}.pdf`,
      paginas,
    };
  } finally {
    await browser?.close();
  }
}
