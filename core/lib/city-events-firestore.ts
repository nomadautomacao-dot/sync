/**
 * A linha do tempo de uma cidade, no Firestore.
 *
 * Subcoleção de `cities/{cityId}`, e não coleção raiz: "tudo desta cidade" vira
 * uma leitura só, e a regra de segurança não precisa de índice composto para
 * separar município de município.
 *
 * O `groupId` viaja dentro de cada documento mesmo sendo dedutível do pai. É a
 * convenção do resto da base (`profitSnapshots`, `collaborators`) e existe por
 * uma razão de custo: a alternativa é a regra fazer `get()` no documento da
 * cidade a cada leitura, e isso é uma leitura cobrada por evento exibido.
 */

import {
  addDoc,
  collection,
  doc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";

import type {
  AnexoDoEvento,
  Autor,
  Comentario,
  EntradaDeEvento,
  EstadoDoEvento,
  EventoDaCidade,
  TipoDeEvento,
} from "@/core/domain/cidade-eventos";
import { novoEvento } from "@/core/domain/cidade-eventos";

const CIDADES = "cities";
const EVENTOS = "eventos";
const COMENTARIOS = "comentarios";

function caminhoDosEventos(db: Firestore, cityId: string) {
  return collection(db, CIDADES, cityId, EVENTOS);
}

function caminhoDosComentarios(db: Firestore, cityId: string, eventoId: string) {
  return collection(db, CIDADES, cityId, EVENTOS, eventoId, COMENTARIOS);
}

function texto(valor: unknown): string | undefined {
  return typeof valor === "string" && valor.trim() ? valor : undefined;
}

export function eventoDoDoc(id: string, dados: Record<string, unknown>): EventoDaCidade {
  return {
    id,
    tipo: (texto(dados.tipo) ?? "nota") as TipoDeEvento,
    titulo: texto(dados.titulo) ?? "(sem título)",
    quando: texto(dados.quando) ?? texto(dados.criadoEm) ?? "",
    estado: (texto(dados.estado) ?? "realizado") as EstadoDoEvento,
    relato: texto(dados.relato),
    participantes: texto(dados.participantes),
    autorUid: texto(dados.autorUid) ?? "",
    autorNome: texto(dados.autorNome) ?? "—",
    criadoEm: texto(dados.criadoEm) ?? "",
    atualizadoEm: texto(dados.atualizadoEm),
    comentarios: typeof dados.comentarios === "number" ? dados.comentarios : 0,
    anexo: anexoDoDoc(dados.anexo),
  };
}

/** Anexo sem título ou sem URL não é anexo: vira ausência, não link quebrado. */
function anexoDoDoc(valor: unknown): AnexoDoEvento | undefined {
  if (!valor || typeof valor !== "object") return undefined;
  const bruto = valor as Record<string, unknown>;
  const titulo = texto(bruto.titulo);
  const url = texto(bruto.url);
  if (!titulo || !url) return undefined;

  return {
    titulo,
    url,
    documentoId: texto(bruto.documentoId),
    relatorioTitulo: texto(bruto.relatorioTitulo),
  };
}

export async function listCityEvents(
  db: Firestore,
  groupId: string,
  cityId: string,
): Promise<EventoDaCidade[]> {
  const consulta = query(
    caminhoDosEventos(db, cityId),
    where("groupId", "==", groupId),
    orderBy("quando", "desc"),
  );
  const snap = await getDocs(consulta);
  return snap.docs.map((d) => eventoDoDoc(d.id, d.data()));
}

/**
 * Registra o acontecimento **e** carimba a cidade como movimentada.
 *
 * O `lastActivityAt` da cidade é o que a carteira mostra na coluna "última
 * atividade" — a que responde "qual município está parado há três semanas". Se
 * só o pipeline o atualizasse, como era antes, uma cidade com reunião ontem e
 * estágio intocado há um mês apareceria como abandonada, e a coluna passaria a
 * mentir justamente sobre as cidades em que a equipe mais trabalha.
 *
 * Lote para que as duas escritas andem juntas: evento gravado sem o carimbo
 * deixaria a lista desatualizada sem nada indicando.
 */
export async function createCityEvent(
  db: Firestore,
  groupId: string,
  cityId: string,
  entrada: EntradaDeEvento,
  autor: Autor,
): Promise<EventoDaCidade> {
  const documento = { ...novoEvento(entrada, autor, new Date()), groupId };
  const ref = doc(caminhoDosEventos(db, cityId));

  const lote = writeBatch(db);
  lote.set(ref, documento);
  lote.update(doc(db, CIDADES, cityId), { lastActivityAt: documento.criadoEm });
  await lote.commit();

  return { id: ref.id, ...documento };
}

/**
 * Anota na linha do tempo um arquivo que entrou na cidade.
 *
 * Chamada depois do upload, e **não** dentro dele: o arquivo já subiu para o
 * Storage e o documento já existe quando esta função roda. Se ela falhar, o
 * documento continua lá e íntegro — só não aparece no fluxo. É o desequilíbrio
 * aceitável nesta direção; o contrário (evento apontando para arquivo que não
 * subiu) seria um link quebrado no meio do histórico.
 *
 * Quem chama trata a falha como aviso, não como erro do upload.
 */
export async function registrarArquivoNaLinhaDoTempo(
  db: Firestore,
  groupId: string,
  cityId: string,
  arquivo: {
    titulo: string;
    url: string;
    documentoId?: string;
    relatorioTitulo?: string;
    descricao?: string;
  },
  autor: Autor,
): Promise<void> {
  const anexo = {
    titulo: arquivo.titulo,
    url: arquivo.url,
    ...(arquivo.documentoId ? { documentoId: arquivo.documentoId } : {}),
    ...(arquivo.relatorioTitulo ? { relatorioTitulo: arquivo.relatorioTitulo } : {}),
  };

  await createCityEvent(
    db,
    groupId,
    cityId,
    {
      tipo: "documento",
      // O título diz o que a pessoa fez, não o nome do arquivo: quem lê a linha
      // do tempo quer saber que houve uma análise, e só depois qual arquivo é.
      titulo: arquivo.relatorioTitulo
        ? `Análise anexada a "${arquivo.relatorioTitulo}"`
        : `Documento anexado: ${arquivo.titulo}`,
      quando: new Date().toISOString(),
      relato: arquivo.descricao,
      anexo,
    },
    autor,
  );
}

/** O que uma edição pode tocar. Autoria e data de criação não estão aqui. */
export interface EdicaoDeEvento {
  titulo?: string;
  quando?: string;
  participantes?: string | null;
  relato?: string | null;
  estado?: EstadoDoEvento;
}

export async function updateCityEvent(
  db: Firestore,
  cityId: string,
  eventoId: string,
  edicao: EdicaoDeEvento,
): Promise<void> {
  const corpo: Record<string, unknown> = { atualizadoEm: new Date().toISOString() };

  if (edicao.titulo !== undefined) corpo.titulo = edicao.titulo.trim();
  if (edicao.quando !== undefined) corpo.quando = edicao.quando;
  if (edicao.estado !== undefined) corpo.estado = edicao.estado;

  // Campo apagado vira `null`: o Firestore recusa `undefined`, e string vazia
  // entraria como se fosse conteúdo.
  for (const campo of ["participantes", "relato"] as const) {
    if (edicao[campo] === undefined) continue;
    const limpo = (edicao[campo] ?? "").trim();
    corpo[campo] = limpo === "" ? null : limpo;
  }

  await updateDoc(doc(db, CIDADES, cityId, EVENTOS, eventoId), corpo);
}

// ── Comentários ──────────────────────────────────────────────────────────

export function comentarioDoDoc(id: string, dados: Record<string, unknown>): Comentario {
  return {
    id,
    texto: texto(dados.texto) ?? "",
    autorUid: texto(dados.autorUid) ?? "",
    autorNome: texto(dados.autorNome) ?? "—",
    criadoEm: texto(dados.criadoEm) ?? "",
  };
}

/**
 * O `groupId` no filtro não é redundância defensiva: é obrigatório.
 *
 * A regra de leitura exige `resource.data.groupId == myGroupId()`, e numa
 * consulta o Firestore avalia a **consulta**, não cada documento devolvido. Sem
 * o `where` correspondente ele não consegue provar que o resultado inteiro
 * satisfaz a regra e recusa tudo com "missing or insufficient permissions" —
 * um erro que parece de autenticação e é de consulta mal montada.
 */
export async function listComentarios(
  db: Firestore,
  groupId: string,
  cityId: string,
  eventoId: string,
): Promise<Comentario[]> {
  const snap = await getDocs(
    query(
      caminhoDosComentarios(db, cityId, eventoId),
      where("groupId", "==", groupId),
      orderBy("criadoEm", "asc"),
    ),
  );
  return snap.docs.map((d) => comentarioDoDoc(d.id, d.data()));
}

/**
 * Comenta e adianta o contador do evento.
 *
 * O contador existe para a lista mostrar "3 comentários" sem abrir três
 * subcoleções — com vinte eventos na tela, seriam vinte consultas para exibir
 * um número. `increment` resolve no servidor, então dois comentários
 * simultâneos não se sobrescrevem.
 */
export async function addComentario(
  db: Firestore,
  groupId: string,
  cityId: string,
  eventoId: string,
  textoDoComentario: string,
  autor: Autor,
): Promise<void> {
  await addDoc(caminhoDosComentarios(db, cityId, eventoId), {
    groupId,
    texto: textoDoComentario.trim(),
    autorUid: autor.uid,
    autorNome: autor.nome,
    criadoEm: new Date().toISOString(),
    gravadoEm: serverTimestamp(),
  });

  await updateDoc(doc(db, CIDADES, cityId, EVENTOS, eventoId), {
    comentarios: increment(1),
  });
}
