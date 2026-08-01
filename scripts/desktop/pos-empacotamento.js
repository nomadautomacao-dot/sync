/**
 * Coloca o servidor e o Chromium dentro do `.app`, depois que o
 * electron-builder monta o executável e **antes** de ele fechar o DMG.
 *
 * ## Por que não `extraResources`
 *
 * Era a forma declarativa e óbvia, e ela não funciona para este conteúdo: o
 * `extraResources` do electron-builder **descarta `node_modules` e diretórios
 * que começam com ponto**. O servidor precisa exatamente dos dois — as
 * dependências do Next e a pasta `.next`. O resultado é um pacote que abre,
 * navega, e morre na primeira emissão com "Cannot find package
 * 'playwright-<hash>'".
 *
 * `filter: ["**\/*"]` não desfaz: a exclusão não é um filtro de glob que se
 * possa sobrescrever. Três empacotamentos foram gastos nessa tentativa.
 *
 * Aqui a cópia é `fs.cpSync` — sem semântica de glob, sem exclusão implícita, e
 * o que entra é exatamente o que se mandou entrar.
 *
 * ## Onde isto se encaixa
 *
 * `afterPack` roda com o `.app` já montado e o DMG ainda por fazer, que é a
 * única janela em que dá para acrescentar conteúdo e ainda vê-lo no instalador.
 */

const fs = require("node:fs");
const path = require("node:path");

/** Onde ficam os recursos do app em cada plataforma. */
function pastaRecursos(contexto) {
  if (contexto.packager.platform.name === "mac") {
    return path.join(
      contexto.appOutDir,
      `${contexto.packager.appInfo.productFilename}.app`,
      "Contents",
      "Resources",
    );
  }
  return path.join(contexto.appOutDir, "resources");
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

module.exports = async function posEmpacotamento(contexto) {
  const raiz = path.join(__dirname, "..", "..");
  const recursos = pastaRecursos(contexto);

  const partes = [
    { origem: path.join(raiz, ".next", "standalone"), destino: path.join(recursos, "servidor") },
    { origem: path.join(raiz, "desktop", ".chromium"), destino: path.join(recursos, "chromium") },
  ];

  for (const { origem, destino } of partes) {
    if (!fs.existsSync(origem)) {
      throw new Error(`${origem} não existe. Rode \`npm run desktop:preparar\` antes de empacotar.`);
    }
    fs.rmSync(destino, { recursive: true, force: true });
    fs.cpSync(origem, destino, { recursive: true, verbatimSymlinks: true });
    console.log(`  • embutido       ${path.basename(destino)}=${tamanhoLegivel(destino)}`);
  }

  // Conferência dentro do próprio empacotamento: um pacote sem estes dois abre
  // normalmente e só falha na emissão, longe daqui. Falhar agora é mais barato.
  const servidor = path.join(recursos, "servidor");
  for (const exigido of ["node_modules", ".next", "server.js", "public"]) {
    if (!fs.existsSync(path.join(servidor, exigido))) {
      throw new Error(`o servidor foi copiado sem \`${exigido}\` — o pacote não funcionaria.`);
    }
  }
};
