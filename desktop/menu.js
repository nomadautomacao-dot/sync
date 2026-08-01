/**
 * Menu nativo, em português.
 *
 * O menu padrão do Electron vem em inglês e cheio de item que não faz sentido
 * aqui (ferramentas de desenvolvedor à mostra, "Learn More" apontando para o
 * site do Electron). Numa reunião com secretaria, o menu é parte do produto.
 *
 * O que sobra é o que o consultor usa: recarregar quando uma fonte demora,
 * zoom para projetar numa TV de sala de reunião, e a pasta onde os PDFs caem.
 */

const { app, Menu, shell, dialog } = require("electron");

/**
 * @param {{
 *   aoAbrirPastaRelatorios: () => void,
 *   aoAbrirCredenciais: () => void,
 *   aoVerRegistro: () => void,
 * }} acoes
 */
function montarMenu(acoes) {
  const nome = app.getName();

  const modelo = [
    {
      label: nome,
      submenu: [
        {
          label: `Sobre o ${nome}`,
          click: () =>
            dialog.showMessageBox({
              type: "info",
              title: `Sobre o ${nome}`,
              message: `${nome} ${app.getVersion()}`,
              detail:
                "Console operacional de consultoria FUNDEB.\n\n" +
                "Os relatórios são gerados nesta máquina, não na nuvem: " +
                "as fontes públicas de governo respondem melhor a uma conexão " +
                "comum do que ao datacenter, e aqui não há limite de tempo por requisição.",
            }),
        },
        { type: "separator" },
        { label: "Credenciais…", click: acoes.aoAbrirCredenciais },
        { label: "Registro do servidor", click: acoes.aoVerRegistro },
        { type: "separator" },
        { role: "hide", label: `Ocultar ${nome}` },
        { role: "hideOthers", label: "Ocultar outros" },
        { role: "unhide", label: "Mostrar tudo" },
        { type: "separator" },
        { role: "quit", label: `Encerrar o ${nome}` },
      ],
    },
    {
      label: "Editar",
      submenu: [
        { role: "undo", label: "Desfazer" },
        { role: "redo", label: "Refazer" },
        { type: "separator" },
        { role: "cut", label: "Recortar" },
        { role: "copy", label: "Copiar" },
        { role: "paste", label: "Colar" },
        { role: "selectAll", label: "Selecionar tudo" },
      ],
    },
    {
      label: "Relatórios",
      submenu: [
        { label: "Abrir a pasta dos relatórios", accelerator: "CmdOrCtrl+Shift+O", click: acoes.aoAbrirPastaRelatorios },
      ],
    },
    {
      label: "Janela",
      submenu: [
        { role: "reload", label: "Recarregar" },
        { type: "separator" },
        { role: "resetZoom", label: "Tamanho normal" },
        { role: "zoomIn", label: "Aumentar" },
        { role: "zoomOut", label: "Diminuir" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Tela cheia" },
        { role: "minimize", label: "Minimizar" },
        // Ferramentas de desenvolvedor ficam sem rótulo no menu de propósito:
        // o atalho continua valendo para quem souber, sem ocupar espaço na
        // frente de um cliente.
        { role: "toggleDevTools", visible: false },
      ],
    },
    {
      label: "Ajuda",
      submenu: [
        {
          label: "Abrir a versão na nuvem",
          click: () => shell.openExternal("https://sync-app-n7cfomhaaq-uc.a.run.app"),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(modelo));
}

module.exports = { montarMenu };
