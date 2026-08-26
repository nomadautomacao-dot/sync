/**
 * Os documentos de habilitação da empresa, no Firestore + Storage.
 *
 * Coleção `empresaDocumentos`, separada de `cityDocuments` porque não há
 * cidade dona: o contrato social da Global é o mesmo em Ituberá e em
 * Miradouro. Guardá-los aqui, e não numa pasta do computador, é o que permite
 * o kit sair igual na nuvem, no desktop e na máquina de qualquer pessoa da
 * equipe — e é o que torna possível registrar validade.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
  type FirebaseStorage,
} from "firebase/storage";

import type {
  CategoriaHabilitacao,
  DocumentoDaHabilitacao,
} from "@/core/domain/habilitacao";

import { validateCityDocumentFile } from "./documentos-firestore";

const COLLECTION = "empresaDocumentos";

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}

function opcional(valor: unknown): string | undefined {
  const limpo = texto(valor).trim();
  return limpo || undefined;
}

function dataIso(valor: unknown): string | undefined {
  if (
    valor &&
    typeof valor === "object" &&
    "toDate" in valor &&
    typeof valor.toDate === "function"
  ) {
    return valor.toDate().toISOString();
  }
  return opcional(valor);
}

function documentoDoSnapshot(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): DocumentoDaHabilitacao {
  const dados = snapshot.data();
  return {
    id: snapshot.id,
    categoria: texto(dados.categoria) as CategoriaHabilitacao,
    titulo: texto(dados.titulo),
    validade: opcional(dados.validade),
    fileName: texto(dados.fileName),
    fileSize: Number(dados.fileSize) || 0,
    mimeType: texto(dados.mimeType) || "application/octet-stream",
    storagePath: texto(dados.storagePath),
    downloadUrl: texto(dados.downloadUrl),
    observacao: opcional(dados.observacao),
    criadoEm: dataIso(dados.criadoEm),
    criadoPorNome: opcional(dados.criadoPorNome),
  };
}

export async function listDocumentosDaHabilitacao(
  db: Firestore,
  groupId: string,
): Promise<DocumentoDaHabilitacao[]> {
  const snapshot = await getDocs(
    query(collection(db, COLLECTION), where("groupId", "==", groupId)),
  );
  /* Ordenação no cliente: são algumas dezenas de documentos, e `where` +
     `orderBy` em campos diferentes exigiria índice composto. Categoria e
     título, para a lista sair na ordem das pastas do kit. */
  return snapshot.docs
    .map(documentoDoSnapshot)
    .sort(
      (a, b) =>
        a.categoria.localeCompare(b.categoria) ||
        a.titulo.localeCompare(b.titulo, "pt-BR"),
    );
}

export interface EntradaDeHabilitacao {
  groupId: string;
  categoria: CategoriaHabilitacao;
  titulo: string;
  validade?: string;
  observacao?: string;
  criadoPor: string;
  criadoPorNome: string;
}

function nomeSeguro(fileName: string): string {
  const extensao = fileName.split(".").pop()?.toLowerCase() ?? "bin";
  const base = fileName
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "documento"}.${extensao}`;
}

export async function uploadDocumentoDaHabilitacao(
  db: Firestore,
  storage: FirebaseStorage,
  file: File,
  entrada: EntradaDeHabilitacao,
): Promise<DocumentoDaHabilitacao> {
  const erro = validateCityDocumentFile(file);
  if (erro) throw new Error(erro);

  const objeto = `${Date.now()}-${crypto.randomUUID()}-${nomeSeguro(file.name)}`;
  const storagePath = `empresa-documentos/${entrada.groupId}/${entrada.categoria}/${objeto}`;
  const storageRef = ref(storage, storagePath);
  const mimeType = file.type || "application/octet-stream";

  await uploadBytes(storageRef, file, { contentType: mimeType });

  try {
    const downloadUrl = await getDownloadURL(storageRef);
    // `undefined` o Firestore recusa; ausência vira `null`.
    const payload = {
      groupId: entrada.groupId,
      categoria: entrada.categoria,
      titulo: entrada.titulo.trim(),
      validade: entrada.validade || null,
      observacao: entrada.observacao?.trim() || null,
      criadoPor: entrada.criadoPor,
      criadoPorNome: entrada.criadoPorNome,
      fileName: file.name,
      fileSize: file.size,
      mimeType,
      storagePath,
      downloadUrl,
      criadoEm: serverTimestamp(),
    };
    const criado = await addDoc(collection(db, COLLECTION), payload);
    return {
      id: criado.id,
      categoria: entrada.categoria,
      titulo: payload.titulo,
      validade: payload.validade ?? undefined,
      observacao: payload.observacao ?? undefined,
      fileName: payload.fileName,
      fileSize: payload.fileSize,
      mimeType,
      storagePath,
      downloadUrl,
      criadoEm: new Date().toISOString(),
      criadoPorNome: entrada.criadoPorNome,
    };
  } catch (error) {
    // O arquivo já subiu; sem o documento no Firestore ele seria lixo invisível.
    await deleteObject(storageRef).catch(() => undefined);
    throw error;
  }
}

/** Renovar a certidão sem trocar o arquivo: só a data e o rótulo mudam. */
export async function atualizarDocumentoDaHabilitacao(
  db: Firestore,
  documentoId: string,
  edicao: { titulo?: string; validade?: string | null; observacao?: string | null },
): Promise<void> {
  const corpo: Record<string, unknown> = {};
  if (edicao.titulo !== undefined) corpo.titulo = edicao.titulo.trim();
  if (edicao.validade !== undefined) corpo.validade = edicao.validade || null;
  if (edicao.observacao !== undefined) {
    corpo.observacao = edicao.observacao?.trim() || null;
  }
  await updateDoc(doc(db, COLLECTION, documentoId), corpo);
}

/**
 * Apaga documento e arquivo. Aqui a exclusão existe de verdade — ao contrário
 * de contrato ou evento, certidão vencida substituída não é história que
 * alguém queira reler; é papel velho que só atrapalha na hora de montar o kit.
 */
export async function excluirDocumentoDaHabilitacao(
  db: Firestore,
  storage: FirebaseStorage,
  documento: DocumentoDaHabilitacao,
): Promise<void> {
  if (documento.storagePath) {
    await deleteObject(ref(storage, documento.storagePath)).catch((erro) => {
      if (
        !erro ||
        typeof erro !== "object" ||
        !("code" in erro) ||
        erro.code !== "storage/object-not-found"
      ) {
        throw erro;
      }
    });
  }
  await deleteDoc(doc(db, COLLECTION, documento.id));
}
