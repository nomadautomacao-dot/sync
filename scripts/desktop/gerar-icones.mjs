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
 * ## O que o macOS exige, e por que não dá para pular
 *
 * O `electron-builder` recusa fonte abaixo de 512×512 e, sem `.icns`, o app
 * herda o ícone genérico do Electron — que num notebook aberto na frente de um
 * secretário é pior que não ter app. O `.icns` precisa de um *iconset* com dez
 * variantes; `iconutil` e `sips` já vêm no macOS, então isto não adiciona
 * dependência nativa nenhuma.
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

function ladoDaFonte() {
  const saida = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", FONTE], { encoding: "utf8" });
  const largura = Number(saida.match(/pixelWidth:\s*(\d+)/)?.[1]);
  const altura = Number(saida.match(/pixelHeight:\s*(\d+)/)?.[1]);
  return { largura, altura };
}

/**
 * `-z altura largura` força as duas dimensões. A fonte é 298×300 — não
 * quadrada —, e um quadrado é obrigatório. Esticar 0,67% numa marca que já é
 * um quadrado arredondado é invisível; preencher as laterais deslocaria o
 * desenho 1px do centro, o que aparece nos tamanhos pequenos.
 */
function redimensionar(destino, lado) {
  execFileSync("sips", ["-z", String(lado), String(lado), FONTE, "--out", destino], { stdio: "ignore" });
}

async function main() {
  if (process.platform !== "darwin") {
    console.error("Este gerador usa `sips` e `iconutil`, que só existem no macOS.");
    console.error("Para construir a versão Windows a partir de outra máquina, gere os ícones aqui e versione-os.");
    process.exit(1);
  }
  if (!fs.existsSync(FONTE)) {
    console.error(`Fonte não encontrada: ${FONTE}`);
    process.exit(1);
  }

  const { largura, altura } = ladoDaFonte();
  console.log(`Fonte: ${path.relative(RAIZ, FONTE)} (${largura}×${altura})`);
  if (Math.min(largura, altura) < 1024) {
    // Aviso, não erro: o ícone no dock aparece a 256px físicos, e 298 cobre
    // isso de sobra. O que fica macio é a pré-visualização grande no Finder e
    // no Get Info, que ninguém usa para trabalhar.
    console.warn(
      `  aviso: abaixo de 1024px. O dock fica nítido; a variante de 512 e 1024 sai\n` +
        `  interpolada. Se existir um export maior da marca, troque a fonte e rode de novo.`,
    );
  }

  fs.rmSync(SAIDA, { recursive: true, force: true });
  const iconset = path.join(SAIDA, "icon.iconset");
  fs.mkdirSync(iconset, { recursive: true });

  for (const [nome, lado] of VARIANTES) redimensionar(path.join(iconset, nome), lado);
  execFileSync("iconutil", ["-c", "icns", iconset, "-o", path.join(SAIDA, "icon.icns")]);
  console.log(`  desktop/icones/icon.icns — ${VARIANTES.length} variantes`);

  // O `electron-builder` também aceita um PNG grande como fonte para Linux e
  // como fallback; 1024 é o que ele espera.
  redimensionar(path.join(SAIDA, "icon.png"), 1024);
  console.log("  desktop/icones/icon.png — 1024×1024");

  const { default: pngParaIco } = await import("png-to-ico");
  const entradas = TAMANHOS_ICO.map((lado) => {
    const temporario = path.join(SAIDA, `.ico-${lado}.png`);
    redimensionar(temporario, lado);
    return temporario;
  });
  fs.writeFileSync(path.join(SAIDA, "icon.ico"), await pngParaIco(entradas));
  for (const arquivo of entradas) fs.rmSync(arquivo);
  console.log(`  desktop/icones/icon.ico — ${TAMANHOS_ICO.length} tamanhos`);

  fs.rmSync(iconset, { recursive: true, force: true });
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
