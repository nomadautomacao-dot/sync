/**
 * Global Sync — processo principal do app desktop.
 *
 * ## O que este app é
 *
 * Uma janela sobre o **mesmo servidor** que roda no Cloud Run. Não há segunda
 * implementação da interface nem da API: `next.config.ts` já emite
 * `output: "standalone"`, e o que muda é apenas quem hospeda o processo.
 *
 * ## Por que ele existe
 *
 * Porque a máquina do consultor emite um relatório melhor que o datacenter.
 * Medição de 2026-07-31, mesmo município, mesmo código: **19 fontes vivas
 * localmente contra 17 em produção**. O Portal da Transparência devolve
 * 502/504 para o Cloud Run e responde a uma conexão comum; some com isso o
 * teto de 900s por requisição e o cold start de quem abre o app na frente do
 * secretário.
 *
 * ## O que ele não faz
 *
 * Não guarda credencial dentro de si — ver `ambiente.js`. Não escuta na rede:
 * o servidor sobe em `127.0.0.1` numa porta efêmera, então nem a rede da
 * prefeitura enxerga.
 */

const { app, BrowserWindow, shell, dialog, nativeImage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const { montarAmbiente, caminhoCredenciais, CREDENCIAIS } = require("./ambiente");
const { iniciarServidor, encerrarServidor } = require("./servidor");
const { montarMenu } = require("./menu");

// Precisa vir antes de qualquer `getPath("userData")`: é o nome que decide a
// pasta em Application Support, e trocá-lo depois deixaria credenciais órfãs
// numa pasta antiga.
app.setName("Global Sync");

const EMPACOTADO = app.isPackaged;
const RAIZ_REPO = path.join(__dirname, "..");

/**
 * Onde o servidor mora nas duas situações. Empacotado ele fica em
 * `Resources/servidor`, fora do `app.asar` — o `server.js` do Next abre
 * arquivos por caminho real (`public/global-sync-icon.png` entra em todo
 * rodapé de dossiê), e caminho dentro de asar não é caminho real.
 */
const RAIZ_SERVIDOR = EMPACOTADO
  ? path.join(process.resourcesPath, "servidor")
  : path.join(RAIZ_REPO, ".next", "standalone");

/**
 * A marca nova. Sai de dentro do servidor nos dois casos: o `desktop:preparar`
 * copia `public/` para junto do standalone, então o caminho é o mesmo em
 * desenvolvimento e empacotado — e é o mesmo arquivo que assina o rodapé de
 * todos os dossiês.
 */
const ICONE = path.join(RAIZ_SERVIDOR, "public", "global-sync-icon.png");

let janela = null;
let servidor = null;
let arquivoRegistro = null;

/** Onde os PDFs caem. Documentos, não Downloads: relatório é entrega, não sobra. */
function pastaRelatorios() {
  const pasta = path.join(app.getPath("documents"), "Global Sync");
  fs.mkdirSync(pasta, { recursive: true });
  return pasta;
}

function registrar(linha) {
  if (!arquivoRegistro) return;
  try {
    fs.appendFileSync(arquivoRegistro, `${linha}\n`);
  } catch {
    // Registro que falha não pode derrubar o app.
  }
}

/**
 * Tela de erro. Um app que não sobe precisa dizer *o que fazer*, não só que
 * falhou — quem abre isto está numa reunião, não num terminal.
 */
function mostrarAviso(titulo, corpo) {
  const html = `
    <meta charset="utf-8">
    <title>${titulo}</title>
    <style>
      body { margin:0; padding:48px 44px; font:15px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
             color:#3B3F4A; background:linear-gradient(140deg,#F0EEF5,#E9E6F0 60%,#ECEAF1); }
      h1 { font-size:19px; color:#16181D; margin:0 0 14px; letter-spacing:-.01em; }
      code { font:13px ui-monospace,SFMono-Regular,"Cascadia Mono",Consolas,monospace; background:rgba(255,255,255,.85);
             border:1px solid rgba(255,255,255,.95); border-radius:8px; padding:2px 7px; }
      .caixa { background:rgba(255,255,255,.85); border:1px solid rgba(255,255,255,.95);
               border-radius:16px; padding:26px 28px; box-shadow:0 8px 28px rgba(22,24,29,.08); }
      p { margin:0 0 12px; } p:last-child { margin:0; }
      ul { margin:8px 0 0; padding-left:20px; } li { margin-bottom:7px; }
    </style>
    <div class="caixa"><h1>${titulo}</h1>${corpo}</div>`;

  const aviso = new BrowserWindow({
    width: 660,
    height: 460,
    title: "Global Sync",
    backgroundColor: "#EDEBF3",
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  aviso.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return aviso;
}

/**
 * Cria o arquivo de credenciais vazio, comentado, e abre no editor padrão.
 * Escrever o gabarito é melhor que documentar o formato: o `.env.local` tem
 * uma service account de mais de 2 mil caracteres com `\n` escapados dentro,
 * e "cole o JSON aqui" é onde isso costuma dar errado.
 */
function abrirCredenciais() {
  const arquivo = caminhoCredenciais({
    empacotado: EMPACOTADO,
    pastaUsuario: app.getPath("userData"),
    raizRepo: RAIZ_REPO,
  });

  if (!fs.existsSync(arquivo)) {
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    const gabarito = [
      "# Credenciais do Global Sync.",
      "#",
      "# Este arquivo fica FORA do aplicativo de propósito: atualizar uma chave",
      "# não exige reinstalar, e o instalador não carrega segredo de ninguém.",
      "#",
      "# Uma por linha, sem quebrar: o JSON da service account vai inteiro numa",
      "# linha só, com os \\n da chave privada escapados como já estão.",
      "",
      ...CREDENCIAIS.map(({ nome, obrigatoria, explicacao }) =>
        `# ${obrigatoria ? "OBRIGATÓRIA" : "opcional"} — ${explicacao}\n${nome}=\n`,
      ),
    ].join("\n");
    fs.writeFileSync(arquivo, gabarito, { mode: 0o600 });
  }

  shell.openPath(arquivo);
}

function criarJanela(porta) {
  janela = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    title: "Global Sync",
    // O fundo do design é o gradiente lavanda. Sem isto, a janela pisca branco
    // entre abrir e o React montar.
    backgroundColor: "#EDEBF3",
    show: false,
    icon: fs.existsSync(ICONE) ? nativeImage.createFromPath(ICONE) : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // Liga o leitor de PDF do Chromium. Sem isto o visualizador interno
      // (`core/components/visualizador-pdf.tsx`) carrega um quadro em branco no
      // app empacotado, embora funcione no navegador — a diferença é só esta
      // opção, que o Electron entrega desligada.
      plugins: true,
    },
  });

  janela.once("ready-to-show", () => janela.show());
  janela.on("closed", () => {
    janela = null;
  });

  // Link externo abre no navegador do sistema. Sem isto, clicar numa fonte
  // (portal do FNDE, painel do INEP) sequestraria a janela do app, e não há
  // botão "voltar" visível para desfazer.
  janela.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  janela.webContents.on("will-navigate", (evento, url) => {
    if (!url.startsWith(`http://127.0.0.1:${porta}`)) {
      evento.preventDefault();
      shell.openExternal(url);
    }
  });

  // PDF gerado vai direto para a pasta de relatórios, sem caixa de diálogo.
  // A tela já nomeia o arquivo pelo município; perguntar "onde salvar?" a cada
  // emissão é atrito numa rotina que emite oito dossiês seguidos.
  janela.webContents.session.on("will-download", (_evento, item) => {
    const destino = path.join(pastaRelatorios(), item.getFilename());
    item.setSavePath(destino);
    item.once("done", (_e, estado) => {
      if (estado === "completed") shell.showItemInFolder(destino);
      else registrar(`download não concluído: ${item.getFilename()} (${estado})`);
    });
  });

  janela.loadURL(`http://127.0.0.1:${porta}/entrar`);
}

async function subir() {
  arquivoRegistro = path.join(app.getPath("userData"), "servidor.log");
  fs.mkdirSync(path.dirname(arquivoRegistro), { recursive: true });
  // Trunca a cada abertura: interessa o que aconteceu nesta sessão, e um log
  // que só cresce vira um arquivo de centenas de MB numa máquina de campo.
  fs.writeFileSync(arquivoRegistro, `— sessão iniciada —\n`);

  if (!fs.existsSync(path.join(RAIZ_SERVIDOR, "server.js"))) {
    mostrarAviso(
      "O servidor não está construído",
      `<p>Não encontrei <code>server.js</code> em:</p><p><code>${RAIZ_SERVIDOR}</code></p>
       <p>Em desenvolvimento, construa antes de abrir o app:</p>
       <p><code>npm run desktop:preparar</code></p>`,
    );
    return;
  }

  const { env, arquivo, faltando, bloqueado } = montarAmbiente({
    empacotado: EMPACOTADO,
    pastaUsuario: app.getPath("userData"),
    raizRepo: RAIZ_REPO,
  });

  // O Chromium do Playwright viaja dentro do pacote. Sem apontar o caminho, o
  // Playwright procuraria no cache do usuário (`~/Library/Caches/ms-playwright`),
  // que existe nesta máquina porque aqui se desenvolve — e não existiria em
  // nenhuma outra. Seria o defeito que só aparece no computador do colega.
  if (EMPACOTADO) env.PLAYWRIGHT_BROWSERS_PATH = path.join(process.resourcesPath, "chromium");
  env.SYNC_DESKTOP = "1";

  if (bloqueado) {
    const itens = faltando
      .map((c) => `<li><code>${c.nome}</code> — ${c.obrigatoria ? "<b>obrigatória</b>" : "opcional"}: ${c.explicacao}</li>`)
      .join("");
    const aviso = mostrarAviso(
      "Faltam credenciais",
      `<p>Preencha o arquivo abaixo e abra o app de novo:</p><p><code>${arquivo}</code></p>
       <ul>${itens}</ul>
       <p style="margin-top:14px">O menu <b>${process.platform === "darwin" ? "Global Sync" : "Arquivo"} → Credenciais…</b> abre esse arquivo, criando o gabarito se ainda não existir.</p>`,
    );
    abrirCredenciais();
    aviso.focus();
    return;
  }

  for (const c of faltando) registrar(`credencial opcional ausente: ${c.nome} — ${c.explicacao}`);

  try {
    const iniciado = await iniciarServidor({ raizServidor: RAIZ_SERVIDOR, env, aoRegistrar: registrar });
    servidor = iniciado.processo;
    criarJanela(iniciado.porta);
  } catch (erro) {
    // Também no arquivo, e não só na tela: a tela some quando o usuário fecha a
    // janela, e o que sobra para diagnosticar à distância é o registro.
    registrar(`falha ao subir: ${erro instanceof Error ? erro.message : String(erro)}`);
    mostrarAviso(
      "O servidor não subiu",
      `<p>${erro instanceof Error ? erro.message : String(erro)}</p>
       <p>O registro desta sessão está em:</p><p><code>${arquivoRegistro}</code></p>`,
    );
  }
}

// Duas instâncias disputariam a mesma pasta de relatórios e dobrariam o
// consumo de memória do Chromium. A segunda apenas traz a primeira à frente.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (janela) {
      if (janela.isMinimized()) janela.restore();
      janela.focus();
    }
  });

  app.whenReady().then(() => {
    montarMenu({
      aoAbrirPastaRelatorios: () => shell.openPath(pastaRelatorios()),
      aoAbrirCredenciais: abrirCredenciais,
      aoVerRegistro: () => arquivoRegistro && shell.openPath(arquivoRegistro),
    });
    subir();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) subir();
    });
  });

  // No macOS o comportamento nativo é o app continuar vivo sem janela. Aqui
  // não: manter o servidor Next e um Chromium de reserva na memória por um
  // dock icon que ninguém vai clicar de novo é caro numa máquina de campo.
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => encerrarServidor(servidor));
}

process.on("exit", () => encerrarServidor(servidor));
