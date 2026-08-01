/**
 * Ponte entre a janela e o processo principal — deliberadamente quase vazia.
 *
 * A interface é a mesma que roda no navegador contra o Cloud Run. Se ela
 * passasse a depender de alguma API exclusiva do Electron, existiriam duas
 * versões da tela para manter, e a da nuvem quebraria em silêncio. Então o
 * único fato exposto é *que* estamos no desktop, para o dia em que uma tela
 * quiser dizer "salvo em Documentos" em vez de "baixado".
 *
 * `contextIsolation` fica ligado e `nodeIntegration` desligado: a janela
 * carrega HTML de um servidor local, mas esse servidor renderiza dado vindo de
 * uma dúzia de APIs públicas. Nome de escola com aspas já é entrada de terceiro.
 */

const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("syncDesktop", {
  presente: true,
  versao: process.env.SYNC_DESKTOP_VERSAO || "",
});
