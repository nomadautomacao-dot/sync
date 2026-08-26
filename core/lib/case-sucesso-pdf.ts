import { chromium, type Browser } from "playwright";

/**
 * Renderiza o Case de Sucesso em PDF, uma folha 16:9 por slide.
 *
 * ## O contrato deste documento é diferente do dos dossiês
 *
 * Nos dossiês o contrato é de **completude**: o número de blocos impressos tem
 * de bater com o número de linhas da fonte. Aqui ele é de **caber**.
 *
 * A folha do deck tem altura fixa (1080px) e `overflow:hidden`. Conteúdo que
 * passa disso não empurra para a folha seguinte: **desaparece**, em silêncio, e
 * só na apresentação alguém percebe que o rodapé com a fonte sumiu. Foi o que
 * aconteceu na primeira montagem — uma folha somava 1.219px e a fileira de
 * baixo não existia no PDF.
 *
 * Por isso a conferência abaixo mede a altura real de cada folha **antes** de
 * imprimir, e falha com o número em vez de devolver um arquivo mutilado. Some-se
 * a isso a contagem de fichas, que pega o caso oposto: município que entrou no
 * pedido e não saiu no documento.
 */
export async function generateCaseSucessoPdf(
  htmlContent: string,
  nomeArquivo: string,
  municipiosEsperados: number,
): Promise<{ pdfBuffer: Buffer; filename: string; folhas: number }> {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.setContent(htmlContent, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts?.ready);

    // Cada ficha de série é um município; se o pedido tinha cinco e o documento
    // imprimiu quatro, alguém sumiu entre a apuração e a folha.
    const fichas = await page.locator("article.cidade").count();
    if (fichas !== municipiosEsperados) {
      throw new Error(
        `O documento imprimiu ${fichas} municípios; o case tem ${municipiosEsperados}.`,
      );
    }

    // Mede com todas as folhas visíveis: fora do modo de exportação só a folha
    // ativa tem altura, e as demais mediriam zero.
    const transbordos = await page.evaluate(() => {
      const fora: Array<{ folha: string; altura: number }> = [];
      document.querySelectorAll<HTMLElement>(".slide").forEach((s) => {
        s.classList.add("visible");
        const pad = s.querySelector<HTMLElement>(".pad");
        if (pad && pad.scrollHeight > 1080) {
          fora.push({ folha: s.dataset.slide ?? "?", altura: pad.scrollHeight });
        }
        s.classList.remove("visible");
      });
      return fora;
    });

    if (transbordos.length > 0) {
      const detalhe = transbordos.map((t) => `${t.folha} (${t.altura}px)`).join(", ");
      throw new Error(
        `Conteúdo não cabe na folha e seria cortado no PDF — ${detalhe}. O limite é 1080px.`,
      );
    }

    const folhas = await page.locator(".slide").count();

    await page.emulateMedia({ media: "print" });
    const pdfBytes = await page.pdf({
      width: "1920px",
      height: "1080px",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    return { pdfBuffer: Buffer.from(pdfBytes), filename: nomeArquivo, folhas };
  } finally {
    await browser?.close();
  }
}
