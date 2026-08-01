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
 * Empacotado, num arquivo fora do pacote:
 *
 *     ~/Library/Application Support/Global Sync/credenciais.env
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
  const arquivo = caminhoCredenciais(opcoes);
  const doArquivo = lerArquivoEnv(arquivo);

  // A lista branca. `process.env` entra depois do arquivo para permitir
  // sobrescrever pontualmente numa sessão de terminal, sem editar o arquivo.
  const env = {
    // O servidor standalone é uma build de produção; rodá-lo com
    // NODE_ENV=development faria o Next procurar artefatos que não existem no
    // pacote. O `.env.local` diz "development" porque serve ao `next dev`.
    NODE_ENV: "production",
    // Sem isto o Next escuta em 0.0.0.0 e o servidor fica exposto à rede
    // local — numa prefeitura, isso é a rede inteira da prefeitura.
    HOSTNAME: "127.0.0.1",
    PATH: process.env.PATH || "",
    HOME: process.env.HOME || "",
    TMPDIR: process.env.TMPDIR || "/tmp",
    LANG: process.env.LANG || "pt_BR.UTF-8",
  };

  for (const { nome } of CREDENCIAIS) {
    const valor = process.env[nome] || doArquivo[nome];
    if (valor) env[nome] = valor;
  }

  const faltando = CREDENCIAIS.filter(({ nome }) => !env[nome]);
  const bloqueado = faltando.some((c) => c.obrigatoria);

  return { env, arquivo, faltando, bloqueado };
}

module.exports = { montarAmbiente, caminhoCredenciais, lerArquivoEnv, CREDENCIAIS };
