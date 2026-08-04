/**
 * Sobe e vigia o servidor Next dentro do app.
 *
 * ## O que é o "servidor" aqui
 *
 * É o mesmo `.next/standalone/server.js` que roda no contêiner do Cloud Run —
 * o `next.config.ts` já usa `output: "standalone"` desde antes deste app
 * existir. Não há segunda implementação: o desktop apenas hospeda, na máquina
 * do usuário, o processo que a nuvem hospeda lá.
 *
 * Foi essa a razão de fazer o app. Medido em 2026-07-31, o mesmo Raio-X saiu
 * com **19 fontes vivas** localmente e **17** em produção, porque o Portal da
 * Transparência devolve 502/504 para o Cloud Run e responde para uma conexão
 * comum. Rodar aqui não é conveniência; é o relatório mais completo.
 *
 * ## Por que porta efêmera e não uma fixa
 *
 * O `npm run dev` usa a 3100 e já colidiu com o app aberto — o usuário levou
 * `EADDRINUSE` justamente tentando gerar um relatório de teste. Um app que
 * escolhe porta fixa transforma "tenho dois Sync abertos" em erro obscuro.
 * Aqui o sistema operacional dá a porta e ninguém precisa saber qual é.
 */

const { utilityProcess } = require("electron");
const net = require("node:net");
const path = require("node:path");

/** Tempo que o servidor tem para responder antes de considerarmos que travou. */
const ESPERA_MAXIMA_MS = 90_000;
const INTERVALO_SONDA_MS = 500;

/**
 * Quanto cada sonda espera antes de desistir **daquela** tentativa.
 *
 * Já foram 2s, e 2s produziam um app que não abria no Windows. A primeira
 * requisição a `/api/health` custa 0,2s num servidor solto e passa de 2s aqui
 * dentro, porque ela concorre com o Electron abrindo a janela e com o Node
 * carregando 673 MB de módulo pela primeira vez. O registro instrumentado
 * mostrou o padrão exato:
 *
 *     [sonda] The operation was aborted due to timeout (+2012ms)
 *     [sonda] The operation was aborted due to timeout (+2009ms)
 *     [sonda] ok (+955ms)
 *
 * E o desperdício não para no relógio: a tentativa abortada não cancela o
 * trabalho do servidor, então sondar de novo a cada 250ms empilha requisições
 * que disputam a mesma CPU e deixam a resposta mais lenta ainda. Numa máquina
 * ocupada isso vira congestionamento que não sai sozinho — o app ficava os 60s
 * inteiros tentando e desistia com "o servidor não subiu", com o servidor no ar
 * o tempo todo.
 *
 * Uma sonda paciente resolve os dois: quem está subindo tem tempo de responder,
 * e quem morreu de verdade já foi detectado pelo evento `exit`, sem depender
 * deste relógio.
 */
const ESPERA_POR_SONDA_MS = 15_000;

/**
 * Pede uma porta livre ao sistema e devolve. Há uma janela de corrida entre
 * fechar aqui e o Next abrir lá; na prática é irrelevante numa máquina de
 * trabalho, e o alternativo — deixar o Next escolher — não serve porque ele
 * não informa de volta qual porta pegou.
 */
function portaLivre() {
  return new Promise((resolve, reject) => {
    const sonda = net.createServer();
    sonda.unref();
    sonda.on("error", reject);
    sonda.listen(0, "127.0.0.1", () => {
      const { port } = sonda.address();
      sonda.close(() => resolve(port));
    });
  });
}

/**
 * Devolve `null` quando o servidor respondeu, e o motivo da recusa quando não.
 *
 * O motivo importa. A primeira versão engolia a exceção — conexão recusada
 * enquanto o Next sobe é o caso normal, não erro — e com isso o único desfecho
 * possível de uma falha era "o servidor não respondeu em 60s", que não diz se
 * a porta estava fechada, se um proxy interceptou ou se a rota devolveu 500.
 */
async function motivoDeNaoResponder(porta) {
  try {
    const resposta = await fetch(`http://127.0.0.1:${porta}/api/health`, {
      signal: AbortSignal.timeout(ESPERA_POR_SONDA_MS),
    });
    return resposta.ok ? null : `/api/health respondeu ${resposta.status}`;
  } catch (erro) {
    return erro instanceof Error ? erro.message : String(erro);
  }
}

/**
 * @param {{ raizServidor: string, env: Record<string,string>, aoRegistrar?: (linha: string) => void }} opcoes
 * @returns {Promise<{ porta: number, processo: Electron.UtilityProcess }>}
 */
async function iniciarServidor({ raizServidor, env, aoRegistrar = () => {} }) {
  const porta = await portaLivre();
  const servidor = path.join(raizServidor, "server.js");

  // `utilityProcess`, e não `child_process.spawn`.
  //
  // A primeira versão fazia `spawn(process.execPath, [servidor])` com
  // `ELECTRON_RUN_AS_NODE=1` — o binário do Electron se comportando como node.
  // Funciona, e tem um efeito colateral visível: o macOS registra esse filho no
  // LaunchServices e **um segundo ícone aparece no Dock**, com o nome "Global
  // Sync" e a arte genérica de executável Unix. Do lado do usuário parece que o
  // app abriu duas vezes, uma delas quebrada.
  //
  // `utilityProcess` é a API do Electron para exatamente isto: filho Node, sem
  // registro no Dock, com o mesmo V8 da janela e sem runtime separado embarcado.
  const processo = utilityProcess.fork(servidor, [], {
    cwd: raizServidor,
    env: { ...env, PORT: String(porta) },
    stdio: "pipe",
    serviceName: "Servidor Global Sync",
  });

  // O servidor já escreve log estruturado (`core/lib/structured-log.ts`). Sem
  // encaminhar, ele se perderia: num app empacotado não há terminal olhando.
  const encaminhar = (fluxo) => {
    fluxo.setEncoding("utf8");
    let resto = "";
    fluxo.on("data", (pedaco) => {
      const linhas = (resto + pedaco).split("\n");
      resto = linhas.pop() ?? "";
      for (const linha of linhas) if (linha.trim()) aoRegistrar(linha);
    });
  };
  encaminhar(processo.stdout);
  encaminhar(processo.stderr);

  // `utilityProcess` não expõe `exitCode`/`signalCode` como um ChildProcess.
  // O estado fica aqui, e `encerrarServidor` o consulta pela marca no objeto.
  let morreu = null;
  processo.on("exit", (codigo) => {
    morreu = `o servidor encerrou antes de responder (código ${codigo}).`;
    processo.encerrado = true;
  });

  const limite = Date.now() + ESPERA_MAXIMA_MS;
  let ultimoMotivo = null;
  while (Date.now() < limite) {
    if (morreu) throw new Error(morreu);
    ultimoMotivo = await motivoDeNaoResponder(porta);
    if (ultimoMotivo === null) return { porta, processo };
    await new Promise((r) => setTimeout(r, INTERVALO_SONDA_MS));
  }

  processo.kill();
  throw new Error(
    `o servidor não respondeu em ${ESPERA_MAXIMA_MS / 1000}s na porta ${porta}` +
      `${ultimoMotivo ? ` — última tentativa: ${ultimoMotivo}` : ""}.`,
  );
}

/**
 * Encerra o filho de verdade.
 *
 * O `kill()` do `utilityProcess` pede saída graciosa, e graciosa nem sempre
 * acontece: a geração de PDF mantém um Chromium do Playwright aberto, e um
 * Chromium órfão continua segurando memória depois de a janela fechar. O
 * `SIGKILL` atrasado, pelo pid, é a rede de segurança — sem ele, fechar o app
 * no meio de um Raio-X deixaria processo pendurado.
 *
 * @param {Electron.UtilityProcess | null} processo
 */
function encerrarServidor(processo) {
  if (!processo || processo.encerrado) return;
  const pid = processo.pid;
  processo.kill();
  const carrasco = setTimeout(() => {
    if (processo.encerrado || !pid) return;
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Já morreu entre a checagem e o sinal — que é o desfecho desejado.
    }
  }, 3_000);
  carrasco.unref();
}

module.exports = { iniciarServidor, encerrarServidor, portaLivre };
