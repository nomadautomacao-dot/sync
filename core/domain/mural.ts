/**
 * O mural da equipe.
 *
 * ## Por que não é a linha do tempo de uma cidade
 *
 * A linha do tempo responde "o que aconteceu **neste município**" e por isso
 * cada registro é filho de uma cidade. Boa parte da conversa de uma equipe não
 * tem município: "alguém tem o modelo novo de ofício?", "vou estar fora na
 * quinta", "olhem este anexo antes da reunião". Forçar essas mensagens a
 * escolher uma cidade faria a linha do tempo de algum município virar depósito
 * de assunto que não é dele.
 *
 * O vínculo com cidade existe e é **opcional**: quando há, o post aponta para
 * ela e vira atalho nos dois sentidos.
 *
 * ## Por que não é chat
 *
 * Chat é bom para o agora e péssimo para o depois: quem entra na segunda-feira
 * não lê sexta inteira para achar a decisão. O mural é uma lista de assuntos com
 * resposta embaixo — cada um se lê inteiro, fora de ordem, meses depois. É o que
 * uma equipe distribuída em campo precisa reler; não é o que ela precisa digitar
 * rápido.
 */

export type TipoDePost = "recado" | "pergunta" | "arquivo";

export const TIPO_DE_POST_LABELS: Record<TipoDePost, string> = {
  recado: "Recado",
  pergunta: "Pergunta",
  arquivo: "Arquivo",
};

export interface AnexoDoPost {
  titulo: string;
  url: string;
  documentoId?: string;
}

export interface PostDoMural {
  id: string;
  tipo: TipoDePost;
  texto: string;
  /** Município a que o assunto se refere, quando houver. */
  cityId?: string;
  cityName?: string;
  anexo?: AnexoDoPost;
  autorUid: string;
  autorNome: string;
  criadoEm: string;
  atualizadoEm?: string;
  /** Contagem no próprio documento: a lista não abre a subcoleção. */
  respostas?: number;
  /** Pergunta encerrada por quem perguntou, ou por quem administra. */
  resolvidoEm?: string;
  resolvidoPor?: string;
}

export interface EntradaDePost {
  tipo: TipoDePost;
  texto: string;
  cityId?: string;
  cityName?: string;
  anexo?: AnexoDoPost;
}

export interface AutorDoPost {
  uid: string;
  nome: string;
}

/**
 * Pergunta aberta é a única coisa do mural que cobra alguém.
 *
 * Recado não fica "pendente" — ele foi dado. Por isso só `pergunta` participa
 * desta conta: uma caixa que acusa tudo o que não foi respondido acusaria
 * também "bom dia", e uma lista de pendências que mistura as duas coisas
 * deixa de ser lida.
 */
export function estaEmAberto(post: PostDoMural): boolean {
  return post.tipo === "pergunta" && !post.resolvidoEm;
}

/**
 * Quem pode encerrar uma pergunta: quem perguntou, e quem administra.
 *
 * Não é quem respondeu — a resposta certa quem reconhece é quem tinha a
 * dúvida. Deixar qualquer um encerrar transformaria o marcador em opinião
 * alheia sobre o assunto de outra pessoa.
 */
export function podeResolver(
  post: PostDoMural,
  uid: string,
  ehAdmin: boolean,
): boolean {
  return post.tipo === "pergunta" && (post.autorUid === uid || ehAdmin);
}

/** Só o autor edita o próprio texto; nem admin reescreve fala alheia. */
export function podeEditarPost(post: PostDoMural, uid: string): boolean {
  return post.autorUid === uid;
}

export interface MuralRepartido {
  /** Perguntas sem resposta aceita — o que a equipe deve a alguém. */
  emAberto: PostDoMural[];
  /** O resto, do mais recente ao mais antigo. */
  conversa: PostDoMural[];
}

/**
 * Perguntas em aberto sobem; o resto fica em ordem cronológica invertida.
 *
 * As perguntas em aberto saem também da lista de baixo — repetir o mesmo post
 * em dois blocos faz a pessoa responder duas vezes ou achar que há dois
 * assuntos.
 */
export function repartirMural(posts: readonly PostDoMural[]): MuralRepartido {
  const emAberto: PostDoMural[] = [];
  const conversa: PostDoMural[] = [];

  for (const post of posts) {
    (estaEmAberto(post) ? emAberto : conversa).push(post);
  }

  const maisNovoPrimeiro = (a: PostDoMural, b: PostDoMural) =>
    b.criadoEm.localeCompare(a.criadoEm);

  // Pergunta antiga sem resposta é a mais constrangedora: ela vem primeiro.
  emAberto.sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
  conversa.sort(maisNovoPrimeiro);

  return { emAberto, conversa };
}

export function novoPost(
  entrada: EntradaDePost,
  autor: AutorDoPost,
  agora: Date,
): Omit<PostDoMural, "id"> {
  return {
    tipo: entrada.tipo,
    texto: entrada.texto.trim(),
    ...(entrada.cityId ? { cityId: entrada.cityId } : {}),
    ...(entrada.cityName ? { cityName: entrada.cityName } : {}),
    ...(entrada.anexo ? { anexo: entrada.anexo } : {}),
    autorUid: autor.uid,
    autorNome: autor.nome,
    criadoEm: agora.toISOString(),
    respostas: 0,
  };
}
