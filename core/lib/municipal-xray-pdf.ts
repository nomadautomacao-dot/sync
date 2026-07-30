import { chromium, type Browser } from "playwright";

export async function generateMunicipalXrayPdf(
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

    // 13 do núcleo (fiscal, FUNDEB, educação) + 16 do FUNDEB profundo
    // (complementações e por que se perdem, ponderação + ganho apurado,
    // vinculações SIOPE + piso, obras FNDE, dinheiro federal além do fundo,
    // requisitos fiscais do CAUC, gêmeos estatísticos, Saeb/IDEB por escola,
    // contexto por escola, alfabetização, distribuição de proficiência,
    // demografia e demanda futura, território e fator, declaração étnica,
    // mapa das escolas,
    // densidade e dispersão, frequência do PBF, contexto de segurança)
    // + 8 do Perfil Municipal (saneamento, saúde, emprego, assistência,
    // capacidade institucional, governança educacional, quem dirige a
    // educação, conformidade legal)
    // + 3 do roteiro de campo (as perguntas que os blocos novos geraram).
    // + 1 de ciclo político (calendário que fecha as transferências).
    const PAGINAS_ESPERADAS = 44;
    const pageCount = await page.locator("section.page").count();
    if (pageCount !== PAGINAS_ESPERADAS) {
      throw new Error(`O template do Raio-X gerou ${pageCount} páginas; eram esperadas ${PAGINAS_ESPERADAS}.`);
    }

    const pdfBytes = await page.pdf({
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    return {
      pdfBuffer: Buffer.from(pdfBytes),
      filename: `RAIO_X_${municipalitySlug}.pdf`,
    };
  } finally {
    await browser?.close();
  }
}
