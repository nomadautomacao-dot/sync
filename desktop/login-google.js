/**
 * Quais endereços podem abrir como janela dentro do app.
 *
 * Existe por causa de uma regra que é boa e atrapalha aqui: no app desktop toda
 * janela nova vai para o navegador do sistema, para que clicar no portal do
 * FNDE não sequestre a tela. O "Entrar com Google" é a exceção — o
 * `signInWithPopup` do Firebase abre uma janela e conversa com ela por
 * `postMessage` quando o login termina. Mandada para o Safari, essa conversa
 * nunca volta: a pessoa entra, vê a página de sucesso no navegador, e o app
 * fica parado esperando para sempre.
 *
 * A lista é de **hosts exatos**, e a comparação é sobre o `hostname` já
 * interpretado pelo `URL`. Comparar por `includes` seria o furo clássico:
 * `accounts.google.com.exemplo-malicioso.com` passaria, e o que teríamos aberto
 * dentro do app é uma tela pedindo a senha do Google da pessoa.
 */

/** O domínio do Firebase Auth deste projeto, onde mora o `/__/auth/handler`. */
const HOSTS_PERMITIDOS = new Set([
  "accounts.google.com",
  "globalconsultorias.firebaseapp.com",
]);

/**
 * @param {string} url
 * @returns {boolean}
 */
function ehJanelaDeLogin(url) {
  let alvo;
  try {
    alvo = new URL(url);
  } catch {
    // URL que nem se interpreta não é login: vai para o caminho externo, que é
    // o comportamento seguro por omissão.
    return false;
  }

  // Só HTTPS. Um `http://accounts.google.com` seria interceptável na rede da
  // prefeitura, que é exatamente onde este app roda.
  if (alvo.protocol !== "https:") return false;

  return HOSTS_PERMITIDOS.has(alvo.hostname);
}

module.exports = { ehJanelaDeLogin, HOSTS_PERMITIDOS };
