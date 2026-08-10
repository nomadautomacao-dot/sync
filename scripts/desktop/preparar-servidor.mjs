#!/usr/bin/env node
/**
 * Deixa o `.next/standalone` pronto para virar app — e tira de dentro dele o
 * que não pode ser distribuído.
 *
 * ## Os três passos que o `next build` não faz
 *
 * O modo `standalone` monta o servidor e as dependências dele, mas **não**
 * copia `public/` nem `.next/static`. No Cloud Run é o `Dockerfile` que faz
 * isso; aqui é este script. Sem `public/`, todo dossiê sai sem a marca no
 * rodapé — os geradores leem `public/global-sync-icon.png` por caminho de
 * arquivo. Sem `.next/static`, a tela abre sem CSS nem JS.
 *
 * ## O passo que existe só por segurança
 *
 * O rastreamento do Next arrasta para dentro do standalone quase toda a raiz do
 * repositório — inclusive arquivos que são gitignorados justamente por conterem
 * credencial. Empacotar isso significaria distribuir:
 *
 * - a service account do Firebase, que é acesso administrativo ao Firestore —
 *   e um `.app` é um diretório, basta descompactar;
 * - o `cloudrun.env.yaml`, com `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_SECRET` e
 *   `SYNC_LOGIN_PASSWORD` dentro;
 * - `NODE_TLS_REJECT_UNAUTHORIZED=0`, que o `.env` local define. Isso desliga a
 *   verificação de certificado do processo inteiro. O código já trata o caso do
 *   QEdu por chamada, e essa variável foi removida do Cloud Run em 2026-07-31
 *   exatamente por isso.
 *
 * Por isso `enxugar()` trabalha com **lista branca**: enumera o que o servidor
 * precisa e apaga o resto. As credenciais do app vêm de fora do pacote — ver
 * `desktop/ambiente.js`.
 *
 * ## Uso
 *
 *     node scripts/desktop/preparar-servidor.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const STANDALONE = path.join(RAIZ, ".next", "standalone");
const CHROMIUM_ESTAGIO = path.join(RAIZ, "desktop", ".chromium");

function copiar(origem, destino) {
  fs.rmSync(destino, { recursive: true, force: true });
  fs.cpSync(origem, destino, { recursive: true, verbatimSymlinks: true });
}

function tamanhoLegivel(alvo) {
  let total = 0;
  const andar = (p) => {
    const info = fs.lstatSync(p);
    if (info.isDirectory()) for (const filho of fs.readdirSync(p)) andar(path.join(p, filho));
    else total += info.size;
  };
  andar(alvo);
  return `${(total / 1024 / 1024).toFixed(0)} MB`;
}

function exigirStandalone() {
  if (fs.existsSync(path.join(STANDALONE, "server.js"))) return;
  console.error("`.next/standalone/server.js` não existe. Rode `npm run build` antes.");
  process.exit(1);
}

/**
 * O que fica na raiz do standalone. **Lista branca, e não lista negra** — e a
 * diferença aqui custou caro.
 *
 * O rastreamento do Next copia a raiz do repositório quase inteira para dentro
 * do standalone: `docs/`, `scripts/`, `functions/`, o `package-lock.json`, os
 * `.md`. A primeira versão desta limpeza apagava só `.env*`, e o pacote saiu
 * com o `cloudrun.env.yaml` dentro — arquivo que é gitignorado exatamente por
 * carregar `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_SECRET` e `SYNC_LOGIN_PASSWORD`.
 *
 * Uma lista negra só protege do que alguém lembrou de listar. Numa pasta que é
 * varrida por heurística de terceiro, o padrão seguro é o inverso: enumera-se o
 * que o servidor precisa, e todo o resto sai.
 *
 * `core/` e `modules/` ficam por precaução — são TypeScript já compilado dentro
 * de `.next/server`, mas custam 3 MB e removê-los sem necessidade só
 * acrescentaria risco.
 */
const RAIZ_PERMITIDA = new Set([
  "server.js",
  "package.json",
  ".next",
  "node_modules",
  "public",
  "data",
  // Os geradores Python moram em `app/api/modulos/.../pdf`.
  "app",
  "kit_padrao_pdf",
  "core",
  "modules",
]);

/**
 * Arquivo de teste não tem o que fazer num produto entregue. Além do princípio,
 * há um efeito prático: o Vitest varre o repositório por `**\/*.test.ts`, e a
 * cópia dentro de `dist-desktop/` fazia a suíte dobrar de 57 para 113 arquivos
 * e "quebrar" um teste que só falhava por rodar num diretório onde os caminhos
 * relativos não valem. O `vitest.config.ts` também exclui `dist-desktop/`; esta
 * limpeza ataca a causa em vez do sintoma.
 */
function removerTestes(raiz) {
  let contagem = 0;
  const andar = (pasta) => {
    for (const entrada of fs.readdirSync(pasta, { withFileTypes: true })) {
      const alvo = path.join(pasta, entrada.name);
      if (entrada.isDirectory()) {
        if (entrada.name === "node_modules" || entrada.name === ".next") continue;
        andar(alvo);
      } else if (/\.test\.[cm]?[jt]sx?$/.test(entrada.name)) {
        fs.rmSync(alvo, { force: true });
        contagem += 1;
      }
    }
  };
  andar(raiz);
  return contagem;
}

function enxugar() {
  const removidos = [];
  for (const nome of fs.readdirSync(STANDALONE)) {
    if (RAIZ_PERMITIDA.has(nome)) continue;
    fs.rmSync(path.join(STANDALONE, nome), { recursive: true, force: true });
    removidos.push(nome);
  }
  const testes = removerTestes(STANDALONE);
  console.log(
    `  ${removidos.length} itens fora do runtime removidos: ${removidos.join(", ") || "nenhum"}` +
      `\n  ${testes} arquivo(s) de teste removidos do pacote`,
  );
}

/**
 * O que o rastreamento de dependências do Next não enxerga.
 *
 * O `output: "standalone"` inclui o que é `import`ado estaticamente. Arquivo
 * aberto por caminho em tempo de execução — um JSON de configuração, uma fonte,
 * um `.py` — fica de fora, e o defeito só aparece na primeira emissão.
 *
 * Foi exatamente o que aconteceu aqui: o `playwright-core` traçado veio sem
 * `browsers.json`, e a geração de PDF morreu com "Cannot find module".
 *
 * **Esta lista é a mesma do `Dockerfile` (linhas 68–99).** Os dois caminhos de
 * entrega — contêiner e app — precisam levar o mesmo conjunto; se um item for
 * acrescentado lá e esquecido aqui, o app passa a divergir da nuvem numa
 * funcionalidade só, em silêncio.
 */
const COMPLEMENTOS = [
  // Sobrescreve o pacote traçado, que perde `browsers.json`.
  ["node_modules/playwright", "o Playwright completo"],
  ["node_modules/playwright-core", "sem isto nenhum PDF sai"],
  ["node_modules/pdfjs-dist/legacy/build/pdf.mjs", "leitura de PDF"],
  ["node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs", "worker do pdfjs"],
  ["node_modules/pdfjs-dist/standard_fonts", "fontes padrão do pdfjs"],
  ["node_modules/pdf-parse", "contagem de páginas"],
  ["app/api/modulos/levantamento-fundeb/pdf", "geradores Python do FUNDEB"],
  ["app/api/modulos/slides/pdf", "geradores Python dos slides"],
  ["kit_padrao_pdf", "módulo ReportLab"],
  ["data/fnde", "CSVs do FNDE, lidos por caminho"],
  ["data/caged-municipios.json", "sem isto, baixa 117 MB do IPEADATA a cada partida"],
  ["data/inep-equidade-municipal.json", "equidade do Censo Escolar"],
  // Lidos em execução por `core/lib/dados-arquivo.ts` desde 2026-08-05. Eram
  // `import`, e com `resolveJsonModule` o TypeScript deduzia o tipo literal de
  // cada um: só os quatro Censos são 75 MB, e o `next build` deixou de caber
  // nos 8 GB da máquina do Cloud Build. Sem estas linhas o app abre, navega e
  // falha na emissão — o mesmo modo de falha do `playwright-core` sem
  // `browsers.json`.
  ["data/inep-censo-municipal-2022.json", "Censo Escolar 2022"],
  ["data/inep-censo-municipal-2023.json", "Censo Escolar 2023"],
  ["data/inep-censo-municipal-2024.json", "Censo Escolar 2024"],
  ["data/inep-censo-municipal-2025.json", "Censo Escolar 2025"],
  ["data/ideb-municipal-2025.json", "IDEB por município"],
  ["data/ideb-municipal-historico.json", "metas nacionais do IDEB"],
  ["data/ideb-municipal-historico-municipios.json", "série histórica do IDEB"],
  ["data/inep-rendimento-municipal-2023.json", "rendimento escolar"],
];

function completar() {
  let copiados = 0;
  for (const [relativo, motivo] of COMPLEMENTOS) {
    const origem = path.join(RAIZ, relativo);
    if (!fs.existsSync(origem)) {
      console.warn(`  aviso: ${relativo} não existe no repositório — ${motivo}`);
      continue;
    }
    const destino = path.join(STANDALONE, relativo);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    copiar(origem, destino);
    copiados += 1;
  }
  console.log(`  ${copiados} de ${COMPLEMENTOS.length} complementos copiados (o rastreamento do Next não os pega)`);
}

/**
 * O Chromium do Playwright viaja junto. Ele fica no cache do usuário
 * (`~/Library/Caches/ms-playwright` no macOS, `%LOCALAPPDATA%\ms-playwright` no
 * Windows), que existe nesta máquina porque aqui se desenvolve — e não existe
 * em nenhuma outra. Sem embarcar, o app instalado abriria normalmente e só
 * quebraria na primeira emissão de PDF.
 *
 * A pasta é resolvida a partir do executável que o Playwright de fato usa, e
 * não por nome fixo: `chromium-1228` hoje, outro número na próxima atualização.
 */
function embarcarChromium() {
  const require = createRequire(import.meta.url);
  const { chromium } = require("playwright");
  const executavel = chromium.executablePath();

  // .../ms-playwright/chromium-1234/chrome-mac-arm64/...  → sobe até a pasta da versão
  // ...\ms-playwright\chromium-1234\chrome-win\chrome.exe → o mesmo no Windows
  const partes = executavel.split(path.sep);
  const indice = partes.findIndex((p) => /^chromium(_headless_shell)?-\d+$/.test(p));
  if (indice < 0) {
    console.error(`Não reconheci a pasta do Chromium em: ${executavel}`);
    console.error("Rode `npx playwright install chromium` e tente de novo.");
    process.exit(1);
  }
  const cache = partes.slice(0, indice).join(path.sep);
  const versao = partes[indice].split("-")[1];

  // **Ambas as variantes, e não só a que `executablePath()` aponta.**
  //
  // Essa distinção custou um empacotamento inteiro. `executablePath()` devolve
  // o Chromium completo, mas `chromium.launch({ headless: true })` — o padrão,
  // e o que os 14 geradores usam — executa o `chromium_headless_shell`. Embarcar
  // só o primeiro produz um app que abre, navega, e falha na emissão com
  // "Executable doesn't exist".
  //
  // A imagem de produção tem as duas, porque `npx playwright install chromium`
  // instala as duas. O app carrega o mesmo conjunto para não haver diferença de
  // renderização entre o PDF gerado aqui e o gerado na nuvem.
  //
  // **Só a versão em uso, e não tudo que o cache guarda.** O Playwright não
  // remove a versão antiga ao atualizar: esta máquina tem `chromium-1228` e
  // `chromium-1234` lado a lado, e varrer a pasta por padrão embarcaria as
  // quatro pastas — meio giga de Chromium obsoleto que o app nunca abriria.
  // O número sai do executável que o Playwright instalado escolhe, então
  // acompanha a atualização sozinho.
  const variantes = [`chromium-${versao}`, `chromium_headless_shell-${versao}`];
  const ausentes = variantes.filter((nome) => !fs.existsSync(path.join(cache, nome)));
  if (ausentes.length > 0) {
    console.error(`Faltam no cache do Playwright (${cache}): ${ausentes.join(", ")}`);
    console.error("Rode `npx playwright install chromium` e tente de novo.");
    process.exit(1);
  }

  const jaEmbarcadas = fs.existsSync(CHROMIUM_ESTAGIO) ? fs.readdirSync(CHROMIUM_ESTAGIO) : [];
  if (variantes.every((v) => jaEmbarcadas.includes(v)) && jaEmbarcadas.length === variantes.length) {
    console.log(`  Chromium já embarcado: ${variantes.join(", ")}`);
    return;
  }

  // Estágio antigo sai inteiro: versão obsoleta acumulada dobraria o pacote.
  fs.rmSync(CHROMIUM_ESTAGIO, { recursive: true, force: true });
  fs.mkdirSync(CHROMIUM_ESTAGIO, { recursive: true });
  for (const variante of variantes) copiar(path.join(cache, variante), path.join(CHROMIUM_ESTAGIO, variante));
  console.log(`  Chromium embarcado: ${variantes.join(", ")} (${tamanhoLegivel(CHROMIUM_ESTAGIO)})`);
}

exigirStandalone();
console.log("Preparando o servidor para o app desktop:");

copiar(path.join(RAIZ, "public"), path.join(STANDALONE, "public"));
console.log("  public/ copiado");

copiar(path.join(RAIZ, ".next", "static"), path.join(STANDALONE, ".next", "static"));
console.log("  .next/static copiado");

completar();
enxugar();
embarcarChromium();

console.log(`\nPronto. Servidor: ${tamanhoLegivel(STANDALONE)}`);
