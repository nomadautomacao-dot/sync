/**
 * As notificações, no Firestore.
 *
 * Coleção raiz `notifications` — como o mural, e pela mesma razão: o aviso
 * frequentemente não é de uma cidade ("pergunta no mural", "emissão concluída"),
 * e pendurá-lo numa subcoleção faria o inbox abrir uma consulta por município.
 *
 * O estado de leitura das notificações **de grupo** mora fora da coleção, em
 * `workspace_settings/{groupId}/leituras/{uid}` — um carimbo por pessoa. O porquê
 * está em `core/domain/notificacoes.ts`: um documento compartilhado não pode
 * carregar o `lida` de cada uma.
 */

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";

import type {
  AutorDaNotificacao,
  EntradaDeNotificacao,
  Notificacao,
  TipoDeNotificacao,
} from "@/core/domain/notificacoes";
import { TIPOS_DE_NOTIFICACAO, novaNotificacao } from "@/core/domain/notificacoes";

const NOTIFICACOES = "notifications";
const AJUSTES = "workspace_settings";
const LEITURAS = "leituras";

/** O inbox não é histórico: passou de trinta, as mais velhas esperam no lugar. */
const TETO_DE_NOTIFICACOES = 30;

function texto(valor: unknown): string | undefined {
  return typeof valor === "string" && valor.trim() ? valor : undefined;
}

export function notificacaoDoDoc(id: string, dados: Record<string, unknown>): Notificacao {
  const tipo = texto(dados.tipo);
  return {
    id,
    groupId: texto(dados.groupId) ?? "",
    destinatarioUid: texto(dados.destinatarioUid) ?? null,
    tipo: (TIPOS_DE_NOTIFICACAO.includes(tipo as TipoDeNotificacao)
      ? tipo
      : "pergunta_mural") as TipoDeNotificacao,
    titulo: texto(dados.titulo) ?? "(sem título)",
    resumo: texto(dados.resumo),
    link: texto(dados.link),
    lida: dados.lida === true,
    criadoEm: texto(dados.criadoEm) ?? "",
    origemUid: texto(dados.origemUid),
    origemNome: texto(dados.origemNome),
  };
}

/**
 * Grava o aviso. Quem chama de um gatilho deve preferir `notificar` — notificação
 * é efeito colateral, e falhar nela não pode derrubar a ação principal (o post
 * já foi publicado quando o aviso da pergunta falha, por exemplo).
 */
export async function criarNotificacao(
  db: Firestore,
  groupId: string,
  entrada: EntradaDeNotificacao,
  origem: AutorDaNotificacao,
): Promise<void> {
  await addDoc(collection(db, NOTIFICACOES), {
    ...novaNotificacao(entrada, origem, new Date()),
    groupId,
  });
}

/** `criarNotificacao` sem a falha: aviso perdido vira log, nunca erro na tela. */
export async function notificar(
  db: Firestore,
  groupId: string,
  entrada: EntradaDeNotificacao,
  origem: AutorDaNotificacao,
): Promise<void> {
  try {
    await criarNotificacao(db, groupId, entrada, origem);
  } catch (erro) {
    console.warn("Não foi possível gravar a notificação:", erro);
  }
}

/**
 * As minhas: as dirigidas a mim e as do grupo inteiro.
 *
 * O `where` em `destinatarioUid` não é zelo, é exigência: as rules só liberam
 * documento cujo destinatário é a pessoa ou ninguém, e numa consulta o Firestore
 * avalia a **consulta** contra a regra — sem o filtro ele não consegue provar
 * que o resultado inteiro é legível e recusa tudo.
 */
export async function listarNotificacoes(
  db: Firestore,
  groupId: string,
  uid: string,
): Promise<Notificacao[]> {
  const snap = await getDocs(
    query(
      collection(db, NOTIFICACOES),
      where("groupId", "==", groupId),
      where("destinatarioUid", "in", [uid, null]),
      orderBy("criadoEm", "desc"),
      limit(TETO_DE_NOTIFICACOES),
    ),
  );
  return snap.docs.map((d) => notificacaoDoDoc(d.id, d.data()));
}

/** O carimbo de leitura das notificações de grupo. `null` = nunca marcou. */
export async function lerUltimaLeitura(
  db: Firestore,
  groupId: string,
  uid: string,
): Promise<string | null> {
  const snap = await getDoc(doc(db, AJUSTES, groupId, LEITURAS, uid));
  return texto(snap.data()?.ultimaLeituraEm) ?? null;
}

/**
 * Marca como lida a notificação **pessoal**.
 *
 * A de grupo não tem o que marcar no documento — ela sai do badge quando a
 * pessoa usa "marcar todas", que move o carimbo de leitura. Clicar numa de
 * grupo só navega.
 */
export async function marcarComoLida(db: Firestore, notificacaoId: string): Promise<void> {
  await updateDoc(doc(db, NOTIFICACOES, notificacaoId), { lida: true });
}

/**
 * Zera o badge: as pessoais ganham `lida` e o carimbo anda para agora.
 *
 * Lote para que as duas coisas andem juntas — carimbo novo sem as pessoais
 * marcadas deixaria o badge contando aviso que a tela acabou de dizer que foi
 * lido.
 */
export async function marcarTodasComoLidas(
  db: Firestore,
  groupId: string,
  uid: string,
  pessoaisPendentes: readonly Notificacao[],
  agora: Date,
): Promise<void> {
  const lote = writeBatch(db);
  for (const n of pessoaisPendentes) {
    lote.update(doc(db, NOTIFICACOES, n.id), { lida: true });
  }
  lote.set(doc(db, AJUSTES, groupId, LEITURAS, uid), {
    ultimaLeituraEm: agora.toISOString(),
  });
  await lote.commit();
}
