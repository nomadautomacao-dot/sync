import fs from "fs";
import path from "path";

/**
 * Diretório dos assets de contrato (Anexos_DOCX, Anexos_TXT, Habilitacao_PRIME).
 *
 * Esse material vive fora do repositório — são dezenas de MB de certidões que
 * vencem e são substituídas, sem valor em histórico de git. O caminho vem de
 * CONTRATOS_ASSETS_DIR; o default preserva o layout antigo (./contratos) para
 * quem ainda não configurou.
 *
 * Ver docs/superpowers/specs/2026-07-22-reorganizacao-estrutura-design.md
 */
export function contratosAssetsDir(): string {
  const configured = process.env.CONTRATOS_ASSETS_DIR?.trim();
  return configured
    ? path.resolve(configured)
    : path.join(process.cwd(), "contratos");
}

/* `requireContratosAsset()` saiu daqui em 2026-08-20. Era o único caminho até
   os templates, e resolvia **só** dentro de CONTRATOS_ASSETS_DIR — a pasta que
   existe apenas na máquina de quem desenvolve. A mensagem de erro dele mandava
   apontar a variável para a pasta certa, conselho que não vale no Cloud Run
   nem dentro de um `.app` instalado, onde não há pasta nenhuma para apontar.
   Quem procura templates hoje chama `templatesDeContrato()`. */

/**
 * A pasta versionada dos templates, dentro do repositório.
 *
 * `process.cwd()` é a raiz em todos os lugares onde o servidor roda — no
 * `npm run dev` e nos testes é o repositório, no contêiner é `/app`, no app
 * desktop é a pasta do standalone. Mesmo contrato de `lerJsonDeDados()`.
 */
function templatesVersionados(): string {
  return path.join(process.cwd(), "assets", "contratos", "Anexos_DOCX");
}

/**
 * Onde estão os templates DOCX do kit de contratação direta.
 *
 * ## Por que não é só `requireContratosAsset("Anexos_DOCX")`
 *
 * Porque `CONTRATOS_ASSETS_DIR` aponta para `../Sync-Arquivos/`, que existe
 * **só na máquina de quem desenvolve**. Em 2026-08-20 o kit falhava com
 * "Falha ao gerar o kit de contratos" no app desktop instalado, e a causa era
 * essa: o servidor empacotado nem recebe a variável (ela não está na lista
 * branca de `desktop/ambiente.js`), então procurava os templates em
 * `.../Global Sync.app/Contents/Resources/servidor/contratos/Anexos_DOCX`, que
 * nunca existiu. No Cloud Run era o mesmo — nenhum `COPY` levava a pasta.
 *
 * Certidão vence e é substituída; template de peça processual é produto, muda
 * de ano em ano e tem 1,9 MB. O primeiro continua fora do git, o segundo
 * passou a viajar dentro dele.
 *
 * A ordem de busca mantém a pasta externa na frente: quem estiver montando
 * modelos novos em `Sync-Arquivos/` continua vendo o efeito sem copiar nada.
 * O corolário é que as duas cópias podem divergir — ao aprovar um template
 * novo, copie-o para `assets/contratos/Anexos_DOCX/`, senão o kit sai diferente
 * aqui e no campo.
 */
export function templatesDeContrato(): string {
  const externo = path.join(contratosAssetsDir(), "Anexos_DOCX");
  if (fs.existsSync(externo)) return externo;

  const versionado = templatesVersionados();
  if (fs.existsSync(versionado)) return versionado;

  throw new Error(
    `Templates do kit não encontrados. Procurados em ${externo} e em ` +
      `${versionado}. A cópia versionada é a que viaja para a nuvem e para o ` +
      `app desktop — se ela sumiu, reponha-a a partir de ` +
      `assets/contratos/Anexos_DOCX no repositório.`,
  );
}

