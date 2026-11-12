import { chromium } from "playwright";

import type { PlanoEvolucao } from "@/core/lib/plano-evolucao";
import { generatePlanoEvolucaoHtml, PAGINAS_PLANO_EVOLUCAO } from "@/core/lib/plano-evolucao-template";

/**
 * Contrato do gerador: **caber**. As folhas têm altura fixa e `overflow:hidden`,
 * então o que passa do rodapé some do PDF em vez de transbordar. Cada folha é
 * medida antes de imprimir, e a emissão falha com o excesso em pixels — melhor
 * que um plano com a última linha da tabela faltando na mão do secretário.
 */
export async function generatePlanoEvolucaoPdf(model: PlanoEvolucao) {
  const html = generatePlanoEvolucaoHtml(model);
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 816, height: 1056 } });
    await page.setContent(html, { waitUntil: "load" });
    const folhas = await page.evaluate(() =>
      [...document.querySelectorAll("section.pg")].map((sec, i) => {
        const rodape = sec.querySelector(".foot")!.getBoundingClientRect().top;
        const fundo = Math.max(...[...sec.querySelectorAll("*")].filter((e) => !e.closest(".foot")).map((e) => e.getBoundingClientRect().bottom));
        return { folha: i + 1, excesso: Math.round(fundo - rodape + 6) };
      }),
    );
    if (folhas.length !== PAGINAS_PLANO_EVOLUCAO) throw new Error(`O plano saiu com ${folhas.length} folhas; o esperado é ${PAGINAS_PLANO_EVOLUCAO}.`);
    const cortada = folhas.find((f) => f.excesso > 0);
    if (cortada) throw new Error(`Plano de evolução: a folha ${cortada.folha} passa ${cortada.excesso}px do rodapé.`);
    const frentes = await page.locator("[data-frente]").count();
    if (frentes !== model.frentes.length) throw new Error("Frente do plano ausente ou duplicada no PDF.");
    const pdfBuffer = Buffer.from(await page.pdf({ preferCSSPageSize: true, printBackground: true }));
    const slug = `${model.municipio}_${model.uf}`.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase();
    return { pdfBuffer, filename: `PLANO_EVOLUCAO_FUNDEB_${slug}_${model.exercicio}.pdf`, paginas: folhas.length, html };
  } finally {
    await browser.close();
  }
}
