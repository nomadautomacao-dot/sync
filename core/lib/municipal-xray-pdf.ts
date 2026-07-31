import { chromium, type Browser } from "playwright";

import { ajustarParaCaber, assertSemCorte } from "./pdf-corte";
import { registrarInfo } from "./structured-log";

/**
 * Contrato de folhas do Raio-X. **A tela de emissão anuncia este número** —
 * o card de `_components/documentos.ts` lê a constante, e um teste amarra os
 * dois. Antes disso o card dizia 41 enquanto o relatório entregava 40, e
 * ninguém percebeu.
 *
 * 11 do núcleo (fiscal, FUNDEB, educação) + 17 do FUNDEB profundo
 * (complementações e por que se perdem, ponderação + ganho apurado,
 * vinculações SIOPE + piso, obras FNDE, dinheiro federal além do fundo,
 * precatório do FUNDEF, requisitos fiscais do CAUC, gêmeos estatísticos,
 * Saeb/IDEB por escola, contexto por escola, alfabetização, distribuição de
 * proficiência, demografia e demanda futura, território e fator, declaração
 * étnica, mapa das escolas, densidade e dispersão, estado nutricional,
 * frequência do PBF, contexto de segurança)
 * + 8 do Perfil Municipal (saneamento, saúde, emprego, assistência,
 * capacidade institucional, governança educacional, quem dirige a educação,
 * conformidade legal)
 * + 1 de ciclo político (calendário que fecha as transferências).
 *
 * Duas saídas explicam o número não bater com a soma ingênua das seções do
 * template:
 *   · o roteiro de campo virou o Ofício de solicitação de documentos,
 *     endereçado à prefeitura (`oficio-documentos-pdf.ts`);
 *   · quatro folhas da geração antiga viraram uma ("Porte e resultado") e a de
 *     saúde fiscal saiu, por repetir a de capacidade fiscal linha por linha.
 *     Ver o doc-comment de `paginaRedeEResultado`.
 */
export const PAGINAS_ESPERADAS_RAIO_X = 41;

/**
 * Página que só coube porque o auto-ajuste a encolheu. Sai junto com o PDF
 * para que o chamador possa expor a informação — encolhimento não é erro, mas
 * é o aviso de que a folha chegou ao limite, e até aqui vivia só num
 * `console.info` que ninguém lê.
 */
export interface PaginaAjustadaRaioX {
  pagina: number;
  escala: number;
}

export async function generateMunicipalXrayPdf(
  htmlContent: string,
  municipalitySlug: string,
): Promise<{ pdfBuffer: Buffer; filename: string; ajustadas: PaginaAjustadaRaioX[] }> {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage({ viewport: { width: 816, height: 1056 } });
    await page.setContent(htmlContent, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts?.ready);

    const pageCount = await page.locator("section.page").count();
    if (pageCount !== PAGINAS_ESPERADAS_RAIO_X) {
      throw new Error(`O template do Raio-X gerou ${pageCount} páginas; eram esperadas ${PAGINAS_ESPERADAS_RAIO_X}.`);
    }

    // O contrato acima conta seções; o que vem agora verifica se o conteúdo
    // coube nelas. Com overflow:hidden, corte não muda a contagem nem gera
    // folha extra — some em silêncio. Ver `pdf-corte.ts`.
    //
    // O volume varia por município, então a página que cabe num estoura no
    // outro: primeiro encolhe o que passou, depois falha se nem no piso coube.
    const ajustadas = await ajustarParaCaber(page);
    if (ajustadas.length > 0) {
      registrarInfo(
        "Raio-X",
        `${ajustadas.length} página(s) ajustadas para caber.`,
        { paginasAjustadas: ajustadas, municipio: municipalitySlug },
      );
    }
    await assertSemCorte(page, "Raio-X");

    const pdfBytes = await page.pdf({
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    return {
      pdfBuffer: Buffer.from(pdfBytes),
      filename: `RAIO_X_${municipalitySlug}.pdf`,
      ajustadas,
    };
  } finally {
    await browser?.close();
  }
}
