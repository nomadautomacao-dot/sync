/**
 * As notificações do grupo.
 *
 * ## Um documento por aviso, não um por pessoa
 *
 * Não existe coleção de usuários no Firestore — as pessoas vivem no Firebase
 * Auth e a sessão vem das custom claims. Fan-out (um documento por destinatária)
 * exigiria saber a lista de uids do grupo no momento da escrita, e ela só é
 * conhecida pelo Admin SDK. Por isso o aviso para "todo mundo" é **um** documento
 * com `destinatarioUid: null`, lido por todas as pessoas do grupo; o aviso para
 * alguém específico carrega o uid dela.
 *
 * ## O que é "lida" quando o documento é de todo mundo
 *
 * O campo `lida` vale só para notificação pessoal: um único documento não pode
 * carregar o estado de leitura de cada pessoa do grupo. Para as de grupo, lida
 * é uma comparação: `criadoEm` contra o carimbo `ultimaLeituraEm` que cada
 * pessoa grava para si em `workspace_settings/{groupId}/leituras/{uid}`. "Marcar
 * todas como lidas" é gravar esse carimbo — não há update em lote em documento
 * dos outros, e as rules não precisam abrir exceção para isso.
 */

export type TipoDeNotificacao =
  | "pergunta_mural"
  | "comentario_evento"
  | "etapa_atribuida"
  | "emissao_concluida"
  | "emissao_erro";

export const TIPOS_DE_NOTIFICACAO: readonly TipoDeNotificacao[] = [
  "pergunta_mural",
  "comentario_evento",
  "etapa_atribuida",
  "emissao_concluida",
  "emissao_erro",
];

export interface Notificacao {
  id: string;
  groupId: string;
  /** uid da destinatária, ou `null` quando o aviso é para o grupo inteiro. */
  destinatarioUid: string | null;
  tipo: TipoDeNotificacao;
  titulo: string;
  resumo?: string;
  /** Rota interna para onde o clique navega (`/caixa`, `/cidades/{id}`…). */
  link?: string;
  /** Só com significado em notificação pessoal — ver o topo do arquivo. */
  lida: boolean;
  criadoEm: string;
  /** Quem fez a ação que gerou o aviso (quem perguntou, quem comentou…). */
  origemUid?: string;
  origemNome?: string;
}

export interface EntradaDeNotificacao {
  destinatarioUid: string | null;
  tipo: TipoDeNotificacao;
  titulo: string;
  resumo?: string;
  link?: string;
}

export interface AutorDaNotificacao {
  uid: string;
  nome: string;
}

/** O documento novo: nasce não lida, com o carimbo de agora e a origem. */
export function novaNotificacao(
  entrada: EntradaDeNotificacao,
  origem: AutorDaNotificacao,
  agora: Date,
): Omit<Notificacao, "id" | "groupId"> {
  return {
    destinatarioUid: entrada.destinatarioUid,
    tipo: entrada.tipo,
    titulo: entrada.titulo.trim(),
    ...(entrada.resumo?.trim() ? { resumo: entrada.resumo.trim() } : {}),
    ...(entrada.link?.trim() ? { link: entrada.link.trim() } : {}),
    lida: false,
    criadoEm: agora.toISOString(),
    origemUid: origem.uid,
    origemNome: origem.nome,
  };
}

/**
 * A pessoa vê as notificações do grupo inteiro e as dirigidas a ela — o resto
 * (avisos para colegas) nem sai da consulta, porque as rules já filtram.
 */
export function visivelPara(notificacao: Notificacao, uid: string): boolean {
  return notificacao.destinatarioUid === null || notificacao.destinatarioUid === uid;
}

/**
 * Pessoal lê o próprio campo `lida`; a de grupo compara com o carimbo.
 *
 * Carimbo ausente (`null`) quer dizer "nunca marcou nada como lido" — e tudo
 * conta como não lido, inclusive a primeira pergunta do mural.
 */
export function estaLida(
  notificacao: Notificacao,
  uid: string,
  ultimaLeituraEm: string | null,
): boolean {
  if (!visivelPara(notificacao, uid)) return true;
  if (notificacao.destinatarioUid !== null) return notificacao.lida;
  return ultimaLeituraEm !== null && notificacao.criadoEm <= ultimaLeituraEm;
}

/** As que ainda contam no badge, na ordem em que vieram. */
export function naoLidas(
  notificacoes: readonly Notificacao[],
  uid: string,
  ultimaLeituraEm: string | null,
): Notificacao[] {
  return notificacoes.filter((n) => !estaLida(n, uid, ultimaLeituraEm));
}
