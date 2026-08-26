/**
 * O mural da equipe, no Firestore.
 *
 * Coleção raiz `mural`, e não subcoleção de cidade: o assunto do mural
 * frequentemente **não tem** município, e pendurá-lo num faria a linha do tempo
 * daquele município virar depósito de conversa alheia. O vínculo com cidade é
 * um campo opcional.
 *
 * As respostas ficam em `mural/{id}/respostas`, com o mesmo formato dos
 * comentários da linha do tempo.
 */

import {
  addDoc,
  collection,
  doc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore";

import type {
  AnexoDoPost,
  AutorDoPost,
  EntradaDePost,
  PostDoMural,
  TipoDePost,
} from "@/core/domain/mural";
import { novoPost } from "@/core/domain/mural";

const MURAL = "mural";
const RESPOSTAS = "respostas";

/**
 * Teto de leitura.
 *
 * O mural cresce para sempre e ninguém rola dois anos de conversa. Sem o
 * limite, a tela ficaria mais lenta a cada semana até alguém reclamar — e o
 * conserto seria o mesmo, feito com pressa.
 */
const TETO_DE_POSTS = 200;

function texto(valor: unknown): string | undefined {
  return typeof valor === "string" && valor.trim() ? valor : undefined;
}

function anexoDoDoc(valor: unknown): AnexoDoPost | undefined {
  if (!valor || typeof valor !== "object") return undefined;
  const bruto = valor as Record<string, unknown>;
  const titulo = texto(bruto.titulo);
  const url = texto(bruto.url);
  // Anexo sem título ou sem URL é link quebrado; vira ausência.
  if (!titulo || !url) return undefined;
  return { titulo, url, documentoId: texto(bruto.documentoId) };
}

export function postDoDoc(id: string, dados: Record<string, unknown>): PostDoMural {
  return {
    id,
    tipo: (texto(dados.tipo) ?? "recado") as TipoDePost,
    texto: texto(dados.texto) ?? "",
    cityId: texto(dados.cityId),
    cityName: texto(dados.cityName),
    anexo: anexoDoDoc(dados.anexo),
    autorUid: texto(dados.autorUid) ?? "",
    autorNome: texto(dados.autorNome) ?? "—",
    criadoEm: texto(dados.criadoEm) ?? "",
    atualizadoEm: texto(dados.atualizadoEm),
    respostas: typeof dados.respostas === "number" ? dados.respostas : 0,
    resolvidoEm: texto(dados.resolvidoEm),
    resolvidoPor: texto(dados.resolvidoPor),
  };
}

export async function listarMural(
  db: Firestore,
  groupId: string,
): Promise<PostDoMural[]> {
  const snap = await getDocs(
    query(
      collection(db, MURAL),
      where("groupId", "==", groupId),
      orderBy("criadoEm", "desc"),
      limit(TETO_DE_POSTS),
    ),
  );
  return snap.docs.map((d) => postDoDoc(d.id, d.data()));
}

export async function publicarNoMural(
  db: Firestore,
  groupId: string,
  entrada: EntradaDePost,
  autor: AutorDoPost,
): Promise<PostDoMural> {
  const documento = { ...novoPost(entrada, autor, new Date()), groupId };
  const ref = await addDoc(collection(db, MURAL), documento);
  return { id: ref.id, ...documento };
}

export async function editarPost(
  db: Firestore,
  postId: string,
  novoTexto: string,
): Promise<void> {
  await updateDoc(doc(db, MURAL, postId), {
    texto: novoTexto.trim(),
    atualizadoEm: new Date().toISOString(),
  });
}

/**
 * Encerra ou reabre uma pergunta.
 *
 * Reabrir grava `null`, e não apaga a chave: o Firestore recusa `undefined`, e
 * `null` é como o resto da base representa ausência.
 */
export async function marcarResolvido(
  db: Firestore,
  postId: string,
  autor: AutorDoPost | null,
): Promise<void> {
  await updateDoc(doc(db, MURAL, postId), {
    resolvidoEm: autor ? new Date().toISOString() : null,
    resolvidoPor: autor?.nome ?? null,
  });
}

// ── Respostas ────────────────────────────────────────────────────────────

export interface RespostaDoMural {
  id: string;
  texto: string;
  autorUid: string;
  autorNome: string;
  criadoEm: string;
}

export async function listarRespostas(
  db: Firestore,
  groupId: string,
  postId: string,
): Promise<RespostaDoMural[]> {
  /* O `groupId` no filtro é obrigatório, não zelo: numa consulta o Firestore
     avalia a **consulta** contra a regra, não cada documento devolvido. Sem o
     `where` correspondente ele recusa tudo com "missing or insufficient
     permissions" — erro que parece de autenticação e é de consulta. */
  const snap = await getDocs(
    query(
      collection(db, MURAL, postId, RESPOSTAS),
      where("groupId", "==", groupId),
      orderBy("criadoEm", "asc"),
    ),
  );
  return snap.docs.map((d) => {
    const dados = d.data();
    return {
      id: d.id,
      texto: texto(dados.texto) ?? "",
      autorUid: texto(dados.autorUid) ?? "",
      autorNome: texto(dados.autorNome) ?? "—",
      criadoEm: texto(dados.criadoEm) ?? "",
    };
  });
}

export async function responder(
  db: Firestore,
  groupId: string,
  postId: string,
  textoDaResposta: string,
  autor: AutorDoPost,
): Promise<void> {
  await addDoc(collection(db, MURAL, postId, RESPOSTAS), {
    groupId,
    texto: textoDaResposta.trim(),
    autorUid: autor.uid,
    autorNome: autor.nome,
    criadoEm: new Date().toISOString(),
  });

  // `increment` resolve no servidor: duas respostas simultâneas não se
  // sobrescrevem, como aconteceria com ler-somar-gravar.
  await updateDoc(doc(db, MURAL, postId), { respostas: increment(1) });
}
