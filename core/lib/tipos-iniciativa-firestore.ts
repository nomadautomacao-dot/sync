/**
 * Os tipos de projeto que a equipe criou, no Firestore.
 *
 * ## Por que coleção própria, e não `workspace_settings`
 *
 * Ali a escrita exige `isAdmin()`, e quem precisa de um tipo novo é justamente
 * quem está montando o projeto — a colaboradora na prefeitura, que não é
 * administradora. Um "+" que dá "permissão negada" para a pessoa a quem ele foi
 * feito é pior que não ter o "+".
 *
 * Aqui a régua é a área `cidades`, a mesma que já governa abrir projeto.
 *
 * ## Por que do grupo, e não da cidade
 *
 * "Formação continuada" criado em Juvenília serve em São Félix. Tipo por
 * município faria a mesma coisa nascer com nome diferente em cada uma, e a
 * pergunta que atravessa a carteira — *quantas capacitações fizemos este ano* —
 * deixaria de ter resposta.
 */

"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  type Firestore,
} from "firebase/firestore";

import {
  chaveDoTipo,
  type DefinicaoDeIniciativa,
} from "@/core/domain/cidade-iniciativas";

const COLECAO = "tiposDeIniciativa";

export interface TipoPersonalizado extends DefinicaoDeIniciativa {
  id: string;
}

export async function listTiposDeIniciativa(
  db: Firestore,
  groupId: string,
): Promise<TipoPersonalizado[]> {
  const snap = await getDocs(query(collection(db, COLECAO), where("groupId", "==", groupId)));
  return snap.docs
    .map((d) => {
      const dados = d.data();
      return {
        id: d.id,
        key: typeof dados.key === "string" ? dados.key : "",
        rotulo: typeof dados.rotulo === "string" ? dados.rotulo : "",
        temFormacao: dados.temFormacao === true,
      };
    })
    .filter((t) => t.key && t.rotulo)
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

/**
 * Cria o tipo, ou devolve o que já existe com a mesma chave.
 *
 * Idempotente de propósito: duas pessoas cadastrando "Formação continuada" ao
 * mesmo tempo em cidades diferentes produziriam dois tipos que a tela mostra
 * como iguais, e os projetos se dividiriam entre eles sem que ninguém
 * entendesse por quê.
 */
export async function criarTipoDeIniciativa(
  db: Firestore,
  groupId: string,
  rotulo: string,
  temFormacao: boolean,
  autor: { uid: string; nome: string },
): Promise<TipoPersonalizado> {
  const key = chaveDoTipo(rotulo);
  if (!key) throw new Error("Dê um nome ao tipo.");

  const existentes = await listTiposDeIniciativa(db, groupId);
  const jaExiste = existentes.find((t) => t.key === key);
  if (jaExiste) return jaExiste;

  const documento = {
    groupId,
    key,
    rotulo: rotulo.trim(),
    temFormacao,
    criadoEm: new Date().toISOString(),
    autorUid: autor.uid,
    autorNome: autor.nome,
  };
  const ref = await addDoc(collection(db, COLECAO), documento);
  return { id: ref.id, key, rotulo: documento.rotulo, temFormacao };
}

/**
 * Apaga um tipo criado pela equipe.
 *
 * Os projetos que o usavam **continuam de pé**: `definicaoDaIniciativa` devolve
 * uma definição neutra com a própria chave por rótulo, em vez de estourar. É a
 * escolha entre "o projeto antigo mostra um rótulo feio" e "a aba não abre" —
 * e a segunda não é uma opção numa tela que sustenta trabalho em campo.
 */
export async function apagarTipoDeIniciativa(db: Firestore, id: string): Promise<void> {
  await deleteDoc(doc(db, COLECAO, id));
}
