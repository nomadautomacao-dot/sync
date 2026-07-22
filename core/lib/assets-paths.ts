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

/**
 * Resolve um subdiretório dos assets de contrato, falhando com uma mensagem que
 * nomeia a variável de ambiente em vez de deixar estourar um ENOENT opaco lá na
 * frente.
 */
export function requireContratosAsset(...segments: string[]): string {
  const base = contratosAssetsDir();
  const target = path.join(base, ...segments);

  if (!fs.existsSync(target)) {
    throw new Error(
      `Asset de contrato não encontrado: ${target}. ` +
        `Defina CONTRATOS_ASSETS_DIR apontando para a pasta que contém ` +
        `Anexos_DOCX, Anexos_TXT e Habilitacao_PRIME ` +
        `(atual: ${process.env.CONTRATOS_ASSETS_DIR ?? "não definida, usando ./contratos"}).`,
    );
  }

  return target;
}

