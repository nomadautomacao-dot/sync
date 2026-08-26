/**
 * O cronograma de implantação de uma cidade, no Firestore.
 *
 * Subcoleção `cities/{cityId}/etapas`, irmã de `eventos` e pela mesma razão: a
 * regra de segurança fica presa ao município e "tudo desta cidade" é uma
 * leitura só. O `groupId` viaja dentro de cada documento, como no resto da base.
 */

import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";

import type { Autor } from "@/core/domain/cidade-eventos";
import { novoEvento } from "@/core/domain/cidade-eventos";
import {
  montarCronogramaDoModelo,
  type EstadoDaEtapa,
  type EtapaDoCronograma,
} from "@/core/domain/cronograma";
import { notificar } from "@/core/lib/notifications-firestore";

const CIDADES = "cities";
const ETAPAS = "etapas";
const EVENTOS = "eventos";

function caminhoDasEtapas(db: Firestore, cityId: string) {
  return collection(db, CIDADES, cityId, ETAPAS);
}

function texto(valor: unknown): string | undefined {
  return typeof valor === "string" && valor.trim() ? valor : undefined;
}

export function etapaDoDoc(id: string, dados: Record<string, unknown>): EtapaDoCronograma {
  return {
    id,
    ordem: typeof dados.ordem === "number" ? dados.ordem : 0,
    nome: texto(dados.nome) ?? "(sem nome)",
    descricao: texto(dados.descricao),
    prazo: texto(dados.prazo) ?? "",
    estado: (texto(dados.estado) ?? "pendente") as EstadoDaEtapa,
    responsavelId: texto(dados.responsavelId),
    responsavelNome: texto(dados.responsavelNome),
    concluidaEm: texto(dados.concluidaEm),
    concluidaPor: texto(dados.concluidaPor),
    modeloKey: texto(dados.modeloKey),
    criadoEm: texto(dados.criadoEm) ?? "",
    atualizadoEm: texto(dados.atualizadoEm),
  };
}

export async function listEtapas(
  db: Firestore,
  groupId: string,
  cityId: string,
): Promise<EtapaDoCronograma[]> {
  const snap = await getDocs(
    query(caminhoDasEtapas(db, cityId), where("groupId", "==", groupId), orderBy("ordem", "asc")),
  );
  return snap.docs.map((d) => etapaDoDoc(d.id, d.data()));
}

/**
 * Semeia o cronograma a partir do modelo, num lote só.
 *
 * Lote e não oito escritas soltas: metade de um cronograma no banco é pior que
 * nenhum — a tela mostraria um processo truncado como se fosse o processo, e
 * quem visse não teria como saber que faltou.
 */
export async function criarCronogramaDoModelo(
  db: Firestore,
  groupId: string,
  cityId: string,
  inicio: string,
): Promise<void> {
  const lote = writeBatch(db);
  for (const etapa of montarCronogramaDoModelo(inicio, new Date())) {
    lote.set(doc(caminhoDasEtapas(db, cityId)), { ...etapa, groupId });
  }
  await lote.commit();
}

export interface EntradaDeEtapa {
  nome: string;
  prazo: string;
  descricao?: string;
  ordem: number;
}

export async function criarEtapaAvulsa(
  db: Firestore,
  groupId: string,
  cityId: string,
  entrada: EntradaDeEtapa,
): Promise<void> {
  const descricao = entrada.descricao?.trim();
  const lote = writeBatch(db);
  lote.set(doc(caminhoDasEtapas(db, cityId)), {
    groupId,
    ordem: entrada.ordem,
    nome: entrada.nome.trim(),
    prazo: entrada.prazo,
    estado: "pendente",
    criadoEm: new Date().toISOString(),
    ...(descricao ? { descricao } : {}),
  });
  await lote.commit();
}

export interface EdicaoDeEtapa {
  nome?: string;
  prazo?: string;
  descricao?: string | null;
  estado?: EstadoDaEtapa;
  /** Atribuir/trocar o responsável; `null` desatribui. */
  responsavelId?: string | null;
  responsavelNome?: string | null;
}

/**
 * A edição é também o gatilho de "etapa atribuída" (roadmap multiusuario,
 * fase 2): quando o responsável ganha valor — ou troca — e não é quem editou,
 * a pessoa recebe uma notificação. Hoje nenhuma tela atribui responsável (a
 * lista de usuários do grupo só existe para admin, em `/api/acessos`), então o
 * aviso dispara pelas escritas que vierem com a atribuição — a fase 3 usa
 * este mesmo ponto. `aviso` é opcional justamente para as edições de prazo e
 * texto não pagarem o preço de carregar grupo e autor.
 */
export async function atualizarEtapa(
  db: Firestore,
  cityId: string,
  etapaId: string,
  edicao: EdicaoDeEtapa,
  aviso?: { groupId: string; editor: Autor; nomeDaEtapa: string },
): Promise<void> {
  const corpo: Record<string, unknown> = { atualizadoEm: new Date().toISOString() };
  if (edicao.nome !== undefined) corpo.nome = edicao.nome.trim();
  if (edicao.prazo !== undefined) corpo.prazo = edicao.prazo;
  if (edicao.estado !== undefined) corpo.estado = edicao.estado;
  if (edicao.descricao !== undefined) {
    const limpo = (edicao.descricao ?? "").trim();
    corpo.descricao = limpo === "" ? null : limpo;
  }
  if (edicao.responsavelId !== undefined) {
    corpo.responsavelId = edicao.responsavelId;
    corpo.responsavelNome = edicao.responsavelId ? edicao.responsavelNome ?? null : null;
  }

  const lote = writeBatch(db);
  lote.update(doc(db, CIDADES, cityId, ETAPAS, etapaId), corpo);
  await lote.commit();

  if (aviso && edicao.responsavelId && edicao.responsavelId !== aviso.editor.uid) {
    await notificar(
      db,
      aviso.groupId,
      {
        destinatarioUid: edicao.responsavelId,
        tipo: "etapa_atribuida",
        titulo: `Etapa atribuída a você: ${aviso.nomeDaEtapa}`,
        link: `/cidades/${cityId}`,
      },
      aviso.editor,
    );
  }
}

/**
 * Grava a ordem nova das etapas depois de um arrasto, num lote só.
 *
 * Lote pela mesma razão da semeadura: metade de uma reordenação gravada
 * embaralharia o cronograma em vez de ordená-lo, e quem visse não saberia que
 * faltou metade.
 */
export async function salvarOrdemDasEtapas(
  db: Firestore,
  cityId: string,
  ordens: readonly { id: string; ordem: number }[],
): Promise<void> {
  const atualizadoEm = new Date().toISOString();
  const lote = writeBatch(db);
  for (const { id, ordem } of ordens) {
    lote.update(doc(db, CIDADES, cityId, ETAPAS, id), { ordem, atualizadoEm });
  }
  await lote.commit();
}

/**
 * Conclui a etapa **e** anota isso na linha do tempo, atomicamente.
 *
 * As duas escritas vão no mesmo lote de propósito. Soltas, a segunda podia
 * falhar e deixar uma etapa concluída que a linha do tempo não conhece — e a
 * linha do tempo é onde a equipe vai olhar para saber o que andou. Ficaria
 * faltando justamente o que aconteceu de mais importante, sem nada indicando a
 * falta.
 *
 * É por isso que `etapa` é um tipo de evento que ninguém escolhe no formulário:
 * ele nasce daqui, de um fato do cronograma, e não da digitação de alguém.
 */
export async function concluirEtapa(
  db: Firestore,
  groupId: string,
  cityId: string,
  etapa: EtapaDoCronograma,
  autor: Autor,
): Promise<void> {
  const agora = new Date();
  const lote = writeBatch(db);

  lote.update(doc(db, CIDADES, cityId, ETAPAS, etapa.id), {
    estado: "concluida",
    concluidaEm: agora.toISOString(),
    concluidaPor: autor.nome,
    atualizadoEm: agora.toISOString(),
  });

  const evento = novoEvento(
    {
      tipo: "etapa",
      titulo: `Etapa concluída: ${etapa.nome}`,
      quando: agora.toISOString(),
      relato: etapa.descricao,
    },
    autor,
    agora,
  );
  lote.set(doc(collection(db, CIDADES, cityId, EVENTOS)), { ...evento, groupId });

  await lote.commit();
}

/**
 * Desfaz a conclusão.
 *
 * O evento que a conclusão criou **fica**. Apagar seria reescrever o que a
 * equipe já leu, e `delete` é `false` na regra dos eventos justamente por isso:
 * a etapa voltar a pendente é um fato novo, não o desaparecimento do anterior.
 */
export async function reabrirEtapa(
  db: Firestore,
  cityId: string,
  etapaId: string,
): Promise<void> {
  const lote = writeBatch(db);
  lote.update(doc(db, CIDADES, cityId, ETAPAS, etapaId), {
    estado: "em_andamento",
    concluidaEm: null,
    concluidaPor: null,
    atualizadoEm: new Date().toISOString(),
  });
  await lote.commit();
}
