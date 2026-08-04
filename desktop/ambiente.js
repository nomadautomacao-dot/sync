/**
 * De onde o app desktop tira as credenciais — e o que ele se recusa a herdar.
 *
 * ## Por que isto não lê o `.env` do repositório
 *
 * O `next build` copia todo `.env*` para dentro de `.next/standalone/`. Se o
 * empacotador levasse essa pasta como está, o `.app` distribuível sairia com
 * duas coisas dentro que não podem sair daqui:
 *
 * 1. **A service account do Firebase**, que é acesso administrativo ao
 *    Firestore. Um `.app` é um diretório: `unzip` e está lá.
 * 2. **`NODE_TLS_REJECT_UNAUTHORIZED=0`**, que o `.env` local define porque um
 *    dia foi preciso para o QEdu. Isso desliga a verificação de certificado do
 *    processo **inteiro** — todas as APIs de governo passariam a aceitar
 *    qualquer certificado. O código já resolve o caso do QEdu por chamada, e
 *    essa variável saiu do Cloud Run em 2026-07-31 pelo mesmo motivo.
 *
 * Então a regra aqui é a inversa da usual: o ambiente do servidor filho é
 * montado a partir do zero, e só entra o que está numa lista explícita.
 *
 * ## Onde ficam as credenciais na máquina
 *
 * Empacotado, num arquivo fora do pacote — o caminho vem do
 * `app.getPath("userData")`, que cada sistema resolve à sua maneira:
 *
 *     macOS    ~/Library/Application Support/Global Sync/credenciais.env
 *     Windows  %APPDATA%\Global Sync\credenciais.env
 *
 * Fica fora de propósito. Atualizar a chave não exige recompilar o app, e o
 * instalador que um dia for para a equipe de campo vai sem segredo nenhum
 * dentro — cada máquina põe o seu.
 *
 * Em desenvolvimento, cai no `.env.local` do repositório, que é o arquivo que
 * o `npm run dev` já usa. Assim não há dois lugares para manter.
 */

const fs = require("node:fs");
const path = require("node:path");

/**
 * O que o servidor precisa para funcionar. Ausência de obrigatória é erro que
 * aparece na tela; ausência de opcional degrada o relatório em silêncio — que
 * é exatamente o que aconteceu em produção quando o token do Portal da
 * Transparência faltava e os relatórios saíam sem convênios nem sanções.
 */
const CREDENCIAIS = [
  {
    nome: "FIREBASE_SERVICE_ACCOUNT",
    obrigatoria: true,
    explicacao: "verifica o login. Sem ela, toda rota responde 401.",
  },
  {
    nome: "PORTAL_TRANSPARENCIA_TOKEN",
    obrigatoria: false,
    explicacao: "convênios e sanções CEIS/CNEP. Sem ela, essas seções saem vazias.",
  },
  {
    nome: "QEDU_TOKEN",
    obrigatoria: false,
    explicacao: "indicadores QEdu.",
  },
  {
    nome: "OPENROUTER_API_KEY",
    obrigatoria: false,
    explicacao: "relatório dirigido com IA.",
  },
];

/**
 * Parser deliberadamente pequeno: `CHAVE=valor`, uma por linha, aspas nas
 * pontas removidas. Não expande `${}` nem interpreta escape — a service
 * account tem `\n` literais dentro da chave privada, e qualquer esperteza aqui
 * os quebraria. Foi o mesmo cuidado que o `scripts/deploy/aplicar-credenciais.sh`
 * teve de tomar.
 */
function lerArquivoEnv(arquivo) {
  if (!fs.existsSync(arquivo)) return {};
  const valores = {};
  for (const linha of fs.readFileSync(arquivo, "utf8").split(/\r?\n/)) {
    const corte = linha.indexOf("=");
    if (corte < 1 || linha.trimStart().startsWith("#")) continue;
    const chave = linha.slice(0, corte).trim();
    let valor = linha.slice(corte + 1).trim();
    if (valor.length >= 2 && valor[0] === valor[valor.length - 1] && (valor[0] === '"' || valor[0] === "'")) {
      valor = valor.slice(1, -1);
    }
    valores[chave] = valor;
  }
  return valores;
}

/**
 * O que o sistema operacional precisa ver no filho para o filho existir.
 *
 * A lista branca protege de vazar credencial herdada, e ela custou um app que
 * não abria no Windows: montado do zero com `PATH`, `HOME` e `TMPDIR`, o
 * servidor subia num Mac e morria aqui. `HOME` e `TMPDIR` não existem no
 * Windows — o par é `USERPROFILE` e `TEMP` —, e faltava o principal:
 * **sem `SystemRoot` o Chromium do Playwright não inicia**, porque é dele que
 * saem as DLLs de rede e de criptografia que o processo carrega antes do
 * primeiro `main()`. O sintoma seria o pior possível: app abre, navega, e a
 * emissão de PDF falha na máquina do consultor.
 *
 * Nada aqui é segredo — são caminhos de sistema que todo processo do Windows
 * enxerga. O que a lista continua barrando é o que interessa: `.env` do
 * repositório, service account, `NODE_TLS_REJECT_UNAUTHORIZED`.
 */
const VARIAVEIS_DO_SISTEMA = {
  win32: [
    "SystemRoot",
    "windir",
    "SystemDrive",
    "COMSPEC",
    "PATHEXT",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "HOMEDRIVE",
    "HOMEPATH",
    "APPDATA",
    "LOCALAPPDATA",
    "ProgramData",
    "ProgramFiles",
    "ProgramFiles(x86)",
    "NUMBER_OF_PROCESSORS",
    "PROCESSOR_ARCHITECTURE",
  ],
  darwin: ["HOME", "TMPDIR", "LANG"],
  linux: ["HOME", "TMPDIR", "LANG", "XDG_RUNTIME_DIR", "DISPLAY"],
};

/**
 * Copia do ambiente do processo só o que a plataforma pede, e só o que existe.
 *
 * @param {string} plataforma valor de `process.platform`
 * @param {Record<string, string | undefined>} ambiente normalmente `process.env`
 * @returns {Record<string, string>}
 */
function variaveisDoSistema(plataforma, ambiente) {
  const base = { PATH: ambiente.PATH || ambiente.Path || "" };
  for (const nome of VARIAVEIS_DO_SISTEMA[plataforma] ?? VARIAVEIS_DO_SISTEMA.linux) {
    const valor = ambiente[nome];
    if (valor) base[nome] = valor;
  }
  // Fora do Windows a ausência de TMPDIR é comum e o padrão é conhecido; no
  // Windows não há padrão equivalente, e inventar um daria erro pior que faltar.
  if (plataforma !== "win32" && !base.TMPDIR) base.TMPDIR = "/tmp";
  if (plataforma !== "win32" && !base.LANG) base.LANG = "pt_BR.UTF-8";
  return base;
}

/**
 * @param {{ empacotado: boolean, pastaUsuario: string, raizRepo: string }} opcoes
 */
function caminhoCredenciais({ empacotado, pastaUsuario, raizRepo }) {
  return empacotado
    ? path.join(pastaUsuario, "credenciais.env")
    : path.join(raizRepo, ".env.local");
}

/**
 * Monta o ambiente do servidor filho.
 *
 * @returns {{
 *   env: Record<string,string>,
 *   arquivo: string,
 *   faltando: typeof CREDENCIAIS,
 *   bloqueado: boolean,
 * }}
 */
function montarAmbiente(opcoes) {
  const { plataforma = process.platform, ambiente = process.env } = opcoes;
  const arquivo = caminhoCredenciais(opcoes);
  const doArquivo = lerArquivoEnv(arquivo);

  // A lista branca. `process.env` entra depois do arquivo para permitir
  // sobrescrever pontualmente numa sessão de terminal, sem editar o arquivo.
  const env = {
    ...variaveisDoSistema(plataforma, ambiente),
    // O servidor standalone é uma build de produção; rodá-lo com
    // NODE_ENV=development faria o Next procurar artefatos que não existem no
    // pacote. O `.env.local` diz "development" porque serve ao `next dev`.
    NODE_ENV: "production",
    // Sem isto o Next escuta em 0.0.0.0 e o servidor fica exposto à rede
    // local — numa prefeitura, isso é a rede inteira da prefeitura.
    HOSTNAME: "127.0.0.1",
  };

  for (const { nome } of CREDENCIAIS) {
    const valor = ambiente[nome] || doArquivo[nome];
    if (valor) env[nome] = valor;
  }

  const faltando = CREDENCIAIS.filter(({ nome }) => !env[nome]);
  const bloqueado = faltando.some((c) => c.obrigatoria);

  return { env, arquivo, faltando, bloqueado };
}

module.exports = {
  montarAmbiente,
  caminhoCredenciais,
  lerArquivoEnv,
  variaveisDoSistema,
  CREDENCIAIS,
};
