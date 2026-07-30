import type { Page } from "playwright";

/**
 * Detecta conteúdo cortado no rodapé das páginas de um relatório.
 *
 * ## Por que isto existe
 *
 * O CSS dos relatórios fixa a folha em `8.5in × 11in` com `overflow:hidden`.
 * Isso é proposital — sem o corte, um bloco alto empurraria o rodapé para uma
 * folha extra e desalinharia toda a numeração. Mas tem um efeito colateral
 * cruel: **conteúdo que estoura a altura simplesmente desaparece**, sem erro,
 * sem folha a mais, sem nada no console.
 *
 * O contrato de páginas (`PAGINAS_ESPERADAS`) não pega isso: ele conta
 * `<section class="page">`, e o número continua certo. Contar as folhas do PDF
 * gerado também não pega — com `overflow:hidden` o total é sempre igual ao
 * número de seções, por construção. Foi assim que três páginas do Raio-X e uma
 * do Ofício ficaram meses com o pé cortado sem ninguém notar: as duas
 * verificações que existiam eram cegas para esta falha.
 *
 * A medida certa compara, dentro do navegador, a altura real do conteúdo
 * (`scrollHeight`) com a altura disponível (`clientHeight`) de cada
 * `.page-body`. Diferença positiva é conteúdo que o leitor nunca vai ver.
 */

/** Folga para arredondamento sub-pixel do layout. */
const TOLERANCIA_PX = 2;

/**
 * Piso do auto-ajuste. Abaixo de 88% o texto começa a ficar desconfortável
 * para leitura impressa, e o problema deixa de ser de layout: é conteúdo
 * demais na página, que precisa ser dividido por quem escreveu o template.
 */
const ESCALA_MINIMA = 0.88;
const PASSO = 0.01;

/**
 * Encolhe o conteúdo das páginas que não couberam, até caber.
 *
 * O volume de conteúdo **varia por município**: Manaus enche tabelas que em
 * Ibateguara ficam pela metade, e a mesma página cabe num e estoura no outro.
 * Ajustar o template para o pior caso significaria desperdiçar espaço em
 * quase todos os 5.570 municípios; ajustar para o caso médio significaria
 * cortar conteúdo nos grandes. Por isso o ajuste é por página e em tempo de
 * geração.
 *
 * O `zoom` vai num invólucro interno, não na própria `.page-body`: zoom no
 * elemento medido escalaria também a altura disponível, e a comparação nunca
 * convergiria. Com o invólucro, a caixa da página fica fixa e só o conteúdo
 * encolhe.
 *
 * Devolve as páginas que precisaram de ajuste, para o log da geração.
 */
export async function ajustarParaCaber(
  page: Page,
): Promise<Array<{ pagina: number; escala: number }>> {
  return page.evaluate(
    ({ tolerancia, minima, passo }) => {
      const ajustadas: { pagina: number; escala: number }[] = [];
      document.querySelectorAll("section.page").forEach((secao, indice) => {
        const corpo = secao.querySelector(".page-body");
        if (!(corpo instanceof HTMLElement)) return;
        if (corpo.scrollHeight - corpo.clientHeight <= tolerancia) return;

        // Invólucro criado uma única vez, preservando os filhos originais.
        const inv = document.createElement("div");
        while (corpo.firstChild) inv.appendChild(corpo.firstChild);
        corpo.appendChild(inv);

        let escala = 1;
        while (
          corpo.scrollHeight - corpo.clientHeight > tolerancia &&
          escala - passo >= minima
        ) {
          escala -= passo;
          inv.style.zoom = String(escala);
        }
        if (escala < 1) ajustadas.push({ pagina: indice + 1, escala });
      });
      return ajustadas;
    },
    { tolerancia: TOLERANCIA_PX, minima: ESCALA_MINIMA, passo: PASSO },
  );
}

export interface PaginaCortada {
  /** 1-based, na ordem em que aparece no documento. */
  pagina: number;
  /** Pixels de conteúdo que não couberam. */
  excessoPx: number;
  /** Título da página, para localizar sem contar seções à mão. */
  titulo: string;
}

/** Mede o corte de cada página. Exportada para diagnóstico e teste. */
export async function medirCorte(page: Page): Promise<PaginaCortada[]> {
  return page.evaluate((tolerancia) => {
    const cortadas: { pagina: number; excessoPx: number; titulo: string }[] = [];
    document.querySelectorAll("section.page").forEach((secao, indice) => {
      // A capa não tem `.page-body` e não é paginada como as demais.
      const corpo = secao.querySelector(".page-body");
      if (!(corpo instanceof HTMLElement)) return;
      const excesso = corpo.scrollHeight - corpo.clientHeight;
      if (excesso <= tolerancia) return;
      const titulo =
        secao.querySelector("h2")?.textContent?.trim() ??
        secao.querySelector(".page-header")?.textContent?.trim() ??
        "";
      cortadas.push({ pagina: indice + 1, excessoPx: excesso, titulo: titulo.slice(0, 60) });
    });
    return cortadas;
  }, TOLERANCIA_PX);
}

/**
 * Falha a geração quando alguma página está com o pé cortado.
 *
 * Entregar um PDF com meio parágrafo faltando é pior que não entregar: o
 * relatório vai para a mesa de um gestor municipal e ninguém sabe que falta
 * algo. Por isso é erro, não aviso.
 */
export async function assertSemCorte(page: Page, relatorio: string): Promise<void> {
  const cortadas = await medirCorte(page);
  if (cortadas.length === 0) return;

  const detalhe = cortadas
    .map((c) => `página ${c.pagina} (+${c.excessoPx}px)${c.titulo ? ` — "${c.titulo}"` : ""}`)
    .join("; ");
  throw new Error(
    `O template do ${relatorio} cortou conteúdo no rodapé de ${cortadas.length} página(s): ${detalhe}. ` +
      "Reduza o conteúdo da página ou divida o bloco — o CSS usa overflow:hidden, então o excesso some do PDF sem aviso.",
  );
}
