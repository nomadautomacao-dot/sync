/**
 * Versões de um documento da cidade.
 *
 * ## O documento é o assunto, não o arquivo
 *
 * "Certificado da capacitação" é uma coisa só na pasta, mesmo depois de a
 * secretaria pedir três correções. Trocar o arquivo não cria um documento novo:
 * cria uma **versão**. Por isso a pasta continua com uma linha por assunto, e
 * não com quatro linhas quase iguais que obrigam a ler a data para saber qual
 * vale.
 *
 * ## Nada se perde, e isso é o ponto
 *
 * A versão anterior continua no Storage, com a URL viva. Não há sobrescrita: o
 * arquivo novo vai para um caminho novo, e o antigo desce para o histórico.
 * Substituir nunca apaga.
 *
 * O motivo é o uso: a peça vai para processo administrativo. Descobrir em
 * novembro que a versão protocolada em outubro era a anterior, e não ter mais
 * a anterior, é o tipo de perda que nenhum log conserta.
 *
 * ## Por que a lista mora dentro do documento
 *
 * Uma subcoleção seria mais escalável e cobraria uma leitura por documento só
 * para desenhar o rótulo "v3" na pasta — e a pasta abre inteira de uma vez.
 * Cada versão ocupa poucas centenas de bytes contra o teto de 1 MB do
 * documento: cabem milhares, e o caso real é meia dúzia.
 */

export interface VersaoDoDocumento {
  /** Sempre ≥ 1. A 1 é o arquivo original. */
  versao: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  downloadUrl: string;
  /** ISO. Quando esta versão foi enviada. */
  criadoEm: string;
  autorUid: string;
  autorNome: string;
  /** Por que trocou. Texto livre, opcional. */
  nota?: string;
}

/**
 * O que um documento carrega além dos campos da versão atual.
 *
 * Os campos de arquivo do topo (`fileName`, `storagePath`, …) são **sempre** a
 * versão vigente — quem só quer baixar o documento não precisa saber que
 * versões existem, e nenhuma tela antiga quebrou ao ganhar histórico.
 */
export interface ComVersoes {
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  downloadUrl: string;
  createdAt?: string;
  createdBy: string;
  createdByName: string;
  /** Número da versão vigente. Ausente em documento anterior a este campo: é 1. */
  versao?: number;
  /** As anteriores. Ausente enquanto ninguém substituiu nada. */
  versoesAnteriores?: VersaoDoDocumento[];
}

/**
 * Em que versão está o documento.
 *
 * Documento gravado antes deste campo existir não tem `versao`, e é a 1 — não
 * `undefined` nem 0. Sem esta normalização, a pasta mostraria "v" vazio em
 * todo arquivo antigo, que é a maioria deles no dia do deploy.
 */
export function versaoAtual(documento: ComVersoes): number {
  return documento.versao ?? 1;
}

export function temHistorico(documento: ComVersoes): boolean {
  return (documento.versoesAnteriores?.length ?? 0) > 0;
}

/**
 * Todas as versões, da mais nova para a mais antiga, com a atual à frente.
 *
 * A atual é montada a partir dos campos do topo em vez de ser duplicada no
 * array: duplicar significaria dois lugares para atualizar e um deles ficando
 * para trás — e o que ficasse para trás é justamente o que a pessoa baixa.
 */
export function historicoDoDocumento(documento: ComVersoes): VersaoDoDocumento[] {
  const atual: VersaoDoDocumento = {
    versao: versaoAtual(documento),
    fileName: documento.fileName,
    fileSize: documento.fileSize,
    mimeType: documento.mimeType,
    storagePath: documento.storagePath,
    downloadUrl: documento.downloadUrl,
    criadoEm: documento.createdAt ?? "",
    autorUid: documento.createdBy,
    autorNome: documento.createdByName,
  };

  const anteriores = [...(documento.versoesAnteriores ?? [])].sort(
    (a, b) => b.versao - a.versao,
  );

  return [atual, ...anteriores];
}

export interface ArquivoNovo {
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  downloadUrl: string;
  nota?: string;
}

export interface AutorDaVersao {
  uid: string;
  nome: string;
}

/**
 * O patch que promove um arquivo novo a versão vigente.
 *
 * Devolve só o que muda, para o chamador aplicar num `update` — a alternativa
 * seria reescrever o documento inteiro e arriscar apagar campo que outra tela
 * acabou de gravar.
 *
 * A versão que sai do topo **desce inteira** para o histórico, com o autor e a
 * data que ela tinha. Carimbar o autor da substituição na versão antiga
 * reescreveria a história: quem subiu a v1 continua sendo quem subiu a v1.
 */
export function promoverNovaVersao(
  documento: ComVersoes,
  arquivo: ArquivoNovo,
  autor: AutorDaVersao,
  agora: Date,
): {
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  downloadUrl: string;
  versao: number;
  versoesAnteriores: VersaoDoDocumento[];
} {
  const nota = arquivo.nota?.trim();
  const substituida: VersaoDoDocumento = {
    versao: versaoAtual(documento),
    fileName: documento.fileName,
    fileSize: documento.fileSize,
    mimeType: documento.mimeType,
    storagePath: documento.storagePath,
    downloadUrl: documento.downloadUrl,
    criadoEm: documento.createdAt ?? agora.toISOString(),
    autorUid: documento.createdBy,
    autorNome: documento.createdByName,
    // A nota explica por que a **nova** entrou, então ela fica na que sai: é
    // ali que a pessoa vai ler "substituída porque o nome estava errado".
    ...(nota ? { nota } : {}),
  };

  return {
    fileName: arquivo.fileName,
    fileSize: arquivo.fileSize,
    mimeType: arquivo.mimeType,
    storagePath: arquivo.storagePath,
    downloadUrl: arquivo.downloadUrl,
    versao: versaoAtual(documento) + 1,
    versoesAnteriores: [...(documento.versoesAnteriores ?? []), substituida],
  };
}

/**
 * O caminho novo não pode ser o mesmo do antigo.
 *
 * `uploadBytes` sobrescreve em silêncio quando o caminho colide, e sobrescrever
 * é exatamente o que este módulo existe para impedir: o histórico apontaria
 * para um objeto que já é a versão nova, e a v1 estaria perdida com a tela
 * jurando que ela está lá. O caminho carrega timestamp e UUID, então colidir é
 * praticamente impossível — e "praticamente" não é o critério para uma perda
 * silenciosa e irreversível.
 */
export function caminhoColide(documento: ComVersoes, storagePathNovo: string): boolean {
  if (documento.storagePath === storagePathNovo) return true;
  return (documento.versoesAnteriores ?? []).some((v) => v.storagePath === storagePathNovo);
}
