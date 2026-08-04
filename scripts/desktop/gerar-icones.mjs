#!/usr/bin/env node
/**
 * Gera os ícones do app desktop a partir da identidade visual do produto.
 *
 * ## Fonte única
 *
 * `public/global-sync-icon.png` — o mesmo arquivo que assina a tela de login,
 * a sidebar e o rodapé de todos os dossiês. Não há uma arte separada "do app":
 * se a marca mudar, muda num lugar e este script propaga.
 *
 * ## Quem redimensiona, e por que não é o `sips`
 *
 * A primeira versão usava `sips` e `iconutil`, que só existem no macOS — e o
 * script recusava rodar em qualquer outro lugar. Como ele é o **primeiro passo
 * de `npm run desktop:empacotar`**, isso significava que o empacotamento
 * inteiro morria na linha 1 num Windows, antes de tocar em código.
 *
 * O redimensionador agora é o Chromium do Playwright: já é dependência do
 * projeto (os 14 geradores de PDF são ele), já está instalado em qualquer
 * máquina onde se constrói, reamostra igual nos três sistemas, e não
 * acrescenta binário nenhum ao `package.json`.
 *
 * O `.icns` continua sendo coisa do macOS — `iconutil` não tem equivalente
 * portátil e um `.app` só se constrói lá de qualquer forma. Fora do macOS o
 * script pula essa parte e diz que pulou, em vez de abortar.
 *
 * ## Uso
 *
 *     node scripts/desktop/gerar-icones.mjs
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const FONTE = path.join(RAIZ, "public", "global-sync-icon.png");
const SAIDA = path.join(RAIZ, "desktop", "icones");

/** As dez variantes que o `iconutil` espera, por nome de arquivo e lado em px. */
const VARIANTES = [
  ["icon_16x16.png", 16],
  ["icon_16x16@2x.png", 32],
  ["icon_32x32.png", 32],
  ["icon_32x32@2x.png", 64],
  ["icon_128x128.png", 128],
  ["icon_128x128@2x.png", 256],
  ["icon_256x256.png", 256],
  ["icon_256x256@2x.png", 512],
  ["icon_512x512.png", 512],
  ["icon_512x512@2x.png", 1024],
];

/** Tamanhos que entram no `.ico` do Windows. */
const TAMANHOS_ICO = [16, 24, 32, 48, 64, 128, 256];

/**
 * Lê largura e altura direto do cabeçalho IHDR, que num PNG são sempre os
 * bytes 16–23. Doze linhas evitam depender de uma ferramenta externa só para
 * imprimir dois números.
 */
function ladoDaFonte() {
  const cabecalho = Buffer.alloc(24);
  const arquivo = fs.openSync(FONTE, "r");
  fs.readSync(arquivo, cabecalho, 0, 24, 0);
  fs.closeSync(arquivo);
  return { largura: cabecalho.readUInt32BE(16), altura: cabecalho.readUInt32BE(20) };
}

/**
 * Abre um Chromium com a marca carregada e devolve um redimensionador.
 *
 * A imagem entra como data URI e ocupa a janela inteira; o tamanho de saída é
 * o tamanho da janela, então `screenshot()` devolve exatamente `lado × lado`.
 * `omitBackground` preserva a transparência — sem isso todo ícone sairia com
 * um quadrado branco em volta, visível no dock e na barra de tarefas.
 *
 * O `width/height: 100%` estica a fonte, que é 298×300, até o quadrado
 * obrigatório. Distorcer 0,67% numa marca que já é um quadrado arredondado é
 * invisível; preencher as laterais deslocaria o desenho 1px do centro, o que
 * aparece nos tamanhos pequenos.
 */
async function abrirRedimensionador() {
  const { chromium } = await import("playwright");
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage();
  const dados = fs.readFileSync(FONTE).toString("base64");
  await pagina.setContent(
    `<style>html,body{margin:0;padding:0;width:100%;height:100%;background:transparent}` +
      `img{display:block;width:100%;height:100%}</style>` +
      `<img src="data:image/png;base64,${dados}">`,
  );

  return {
    async redimensionar(destino, lado) {
      await pagina.setViewportSize({ width: lado, height: lado });
      fs.writeFileSync(destino, await pagina.screenshot({ omitBackground: true }));
    },
    fechar: () => navegador.close(),
  };
}

/**
 * O `.icns`. Só no macOS: `iconutil` não tem equivalente portátil, e um `.app`
 * também não se constrói fora de lá.
 */
function gerarIcns(iconset) {
  if (process.platform !== "darwin") {
    fs.rmSync(iconset, { recursive: true, force: true });
    console.log("  desktop/icones/icon.icns — pulado (o `iconutil` só existe no macOS)");
    return;
  }
  execFileSync("iconutil", ["-c", "icns", iconset, "-o", path.join(SAIDA, "icon.icns")]);
  console.log(`  desktop/icones/icon.icns — ${VARIANTES.length} variantes`);
  fs.rmSync(iconset, { recursive: true, force: true });
}

async function main() {
  if (!fs.existsSync(FONTE)) {
    console.error(`Fonte não encontrada: ${FONTE}`);
    process.exit(1);
  }

  const { largura, altura } = ladoDaFonte();
  console.log(`Fonte: ${path.relative(RAIZ, FONTE)} (${largura}×${altura})`);
  if (Math.min(largura, altura) < 1024) {
    // Aviso, não erro: o ícone aparece a 256px físicos no dock e na barra de
    // tarefas, e 298 cobre isso de sobra. O que fica macio é a pré-visualização
    // grande no Finder e no Explorer, que ninguém usa para trabalhar.
    console.warn(
      `  aviso: abaixo de 1024px. Os tamanhos de uso ficam nítidos; as variantes\n` +
        `  de 512 e 1024 saem interpoladas. Se existir um export maior da marca,\n` +
        `  troque a fonte e rode de novo.`,
    );
  }

  fs.rmSync(SAIDA, { recursive: true, force: true });
  const iconset = path.join(SAIDA, "icon.iconset");
  fs.mkdirSync(iconset, { recursive: true });

  const chromium = await abrirRedimensionador();
  try {
    for (const [nome, lado] of VARIANTES) await chromium.redimensionar(path.join(iconset, nome), lado);
    gerarIcns(iconset);

    // O `electron-builder` aceita um PNG grande como fonte para Linux e como
    // fallback geral; 1024 é o que ele espera.
    await chromium.redimensionar(path.join(SAIDA, "icon.png"), 1024);
    console.log("  desktop/icones/icon.png — 1024×1024");

    const { default: pngParaIco } = await import("png-to-ico");
    const entradas = [];
    for (const lado of TAMANHOS_ICO) {
      const temporario = path.join(SAIDA, `.ico-${lado}.png`);
      await chromium.redimensionar(temporario, lado);
      entradas.push(temporario);
    }
    fs.writeFileSync(path.join(SAIDA, "icon.ico"), await pngParaIco(entradas));
    for (const arquivo of entradas) fs.rmSync(arquivo);
    console.log(`  desktop/icones/icon.ico — ${TAMANHOS_ICO.length} tamanhos`);
  } finally {
    await chromium.fechar();
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
