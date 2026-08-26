/**
 * Os contatos de uma cidade, no Firestore.
 *
 * Subcoleção de `cities/{cityId}`, como os eventos: "tudo desta cidade" é uma
 * leitura só. O `groupId` viaja em cada documento pela mesma razão de lá — a
 * alternativa é a regra fazer `get()` no pai a cada leitura, cobrado por
 * contato exibido.
 *
 * A lista sai ordenada por nome **no cliente**, de propósito: `where` +
 * `orderBy` em campos diferentes exigiria índice composto, e uma prefeitura
 * tem uma dúzia de contatos — ordenar aqui é grátis e não cria dependência de
 * deploy de índice.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore";

import type {
  ContatoDaCidade,
  EntradaDeContato,
} from "@/core/domain/cidade-contatos";
import { novoContato } from "@/core/domain/cidade-contatos";

const CIDADES = "cities";
const CONTATOS = "contatos";

function caminhoDosContatos(db: Firestore, cityId: string) {
  return collection(db, CIDADES, cityId, CONTATOS);
}

function texto(valor: unknown): string | undefined {
  return typeof valor === "string" && valor.trim() ? valor : undefined;
}

export function contatoDoDoc(
  id: string,
  dados: Record<string, unknown>,
): ContatoDaCidade {
  return {
    id,
    nome: texto(dados.nome) ?? "(sem nome)",
    cargo: texto(dados.cargo),
    telefone: texto(dados.telefone),
    email: texto(dados.email),
    observacao: texto(dados.observacao),
    criadoEm: texto(dados.criadoEm) ?? "",
    atualizadoEm: texto(dados.atualizadoEm),
    criadoPorNome: texto(dados.criadoPorNome),
  };
}

/** O `where` de groupId é obrigatório: a regra de leitura o exige na consulta. */
export async function listCityContacts(
  db: Firestore,
  groupId: string,
  cityId: string,
): Promise<ContatoDaCidade[]> {
  const snap = await getDocs(
    query(caminhoDosContatos(db, cityId), where("groupId", "==", groupId)),
  );
  return snap.docs
    .map((d) => contatoDoDoc(d.id, d.data()))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function createCityContact(
  db: Firestore,
  groupId: string,
  cityId: string,
  entrada: EntradaDeContato,
  criadoPorNome?: string,
): Promise<ContatoDaCidade> {
  const documento = {
    ...novoContato(entrada, new Date(), criadoPorNome),
    groupId,
  };
  // `undefined` não entra no Firestore; os campos vazios saem do documento.
  const gravavel = Object.fromEntries(
    Object.entries(documento).filter(([, valor]) => valor !== undefined),
  );
  const ref = await addDoc(caminhoDosContatos(db, cityId), gravavel);
  return { id: ref.id, ...documento };
}

export async function updateCityContact(
  db: Firestore,
  cityId: string,
  contatoId: string,
  edicao: EntradaDeContato,
): Promise<void> {
  const corpo: Record<string, unknown> = {
    nome: edicao.nome.trim(),
    atualizadoEm: new Date().toISOString(),
  };
  // Campo apagado vira `null`: o Firestore recusa `undefined`, e string vazia
  // entraria como se fosse conteúdo.
  for (const campo of ["cargo", "telefone", "email", "observacao"] as const) {
    const limpo = (edicao[campo] ?? "").trim();
    corpo[campo] = limpo === "" ? null : limpo;
  }
  await updateDoc(doc(db, CIDADES, cityId, CONTATOS, contatoId), corpo);
}

/**
 * Apagar de verdade, sem soft delete: contato é diretório, não fato. O que
 * merece histórico — a reunião com o secretário — mora na linha do tempo.
 */
export async function deleteCityContact(
  db: Firestore,
  cityId: string,
  contatoId: string,
): Promise<void> {
  await deleteDoc(doc(db, CIDADES, cityId, CONTATOS, contatoId));
}
