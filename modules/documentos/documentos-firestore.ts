"use client";

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

import {
  caminhoColide,
  promoverNovaVersao,
  type VersaoDoDocumento,
} from "@/core/domain/documento-versoes";
import type {
  CityDocument,
  CreateCityDocumentInput,
  DocumentCategory,
} from "./types";

const COLLECTION = "cityDocuments";
export const MAX_CITY_DOCUMENT_BYTES = 20 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "png",
  "jpg",
  "jpeg",
  "zip",
]);

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalString(value: unknown): string | undefined {
  const normalized = stringValue(value).trim();
  return normalized || undefined;
}

function timestampToIso(value: unknown): string | undefined {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate().toISOString();
  }
  return optionalString(value);
}

function documentFromSnapshot(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): CityDocument {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    groupId: stringValue(data.groupId),
    cityId: stringValue(data.cityId),
    cityName: stringValue(data.cityName),
    cityUf: stringValue(data.cityUf),
    category: stringValue(data.category) as DocumentCategory,
    title: stringValue(data.title),
    description: optionalString(data.description),
    fileName: stringValue(data.fileName),
    fileSize: Number(data.fileSize) || 0,
    mimeType: stringValue(data.mimeType) || "application/octet-stream",
    storagePath: stringValue(data.storagePath),
    downloadUrl: stringValue(data.downloadUrl),
    contractNumber: optionalString(data.contractNumber),
    signedAt: optionalString(data.signedAt),
    expiresAt: optionalString(data.expiresAt),
    createdBy: stringValue(data.createdBy),
    createdByName: stringValue(data.createdByName),
    createdAt: timestampToIso(data.createdAt),
    source: data.source === "generated" ? "generated" : "upload",
    relatorioId: optionalString(data.relatorioId),
    relatorioTitulo: optionalString(data.relatorioTitulo),
    iniciativaId: optionalString(data.iniciativaId),
    versao: typeof data.versao === "number" ? data.versao : undefined,
    versoesAnteriores: Array.isArray(data.versoesAnteriores)
      ? (data.versoesAnteriores as VersaoDoDocumento[])
      : undefined,
  };
}

export function validateCityDocumentFile(file: File): string | null {
  if (!file.size) return "O arquivo está vazio.";
  if (file.size > MAX_CITY_DOCUMENT_BYTES) {
    return "O arquivo excede o limite de 20 MB.";
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return "Formato não suportado. Use PDF, DOCX, XLSX, imagem ou ZIP.";
  }
  return null;
}

function safeFileName(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "bin";
  const base = fileName
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "documento"}.${extension}`;
}

function normalizedMimeType(file: File): string {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const byExtension: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    zip: "application/zip",
  };
  return byExtension[extension ?? ""] || file.type || "application/octet-stream";
}

export async function listCityDocuments(
  db: Firestore,
  groupId: string,
): Promise<CityDocument[]> {
  const snapshot = await getDocs(
    query(collection(db, COLLECTION), where("groupId", "==", groupId)),
  );

  return snapshot.docs
    .map(documentFromSnapshot)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export async function uploadCityDocument(
  db: Firestore,
  storage: FirebaseStorage,
  file: File,
  input: CreateCityDocumentInput,
): Promise<CityDocument> {
  const validationError = validateCityDocumentFile(file);
  if (validationError) throw new Error(validationError);

  const objectName = `${Date.now()}-${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const storagePath = `city-documents/${input.groupId}/${input.cityId}/${objectName}`;
  const storageRef = ref(storage, storagePath);
  const mimeType = normalizedMimeType(file);

  await uploadBytes(storageRef, file, {
    contentType: mimeType,
    customMetadata: {
      groupId: input.groupId,
      cityId: input.cityId,
      category: input.category,
    },
  });

  try {
    const downloadUrl = await getDownloadURL(storageRef);
    const payload = {
      ...input,
      source: input.source ?? "upload",
      description: input.description?.trim() || null,
      contractNumber: input.contractNumber?.trim() || null,
      signedAt: input.signedAt || null,
      expiresAt: input.expiresAt || null,
      // `...input` traria `undefined` nestes dois quando o documento for
      // avulso, e o Firestore recusa `undefined` — vira `null`, que é como o
      // resto da coleção representa ausência.
      relatorioId: input.relatorioId || null,
      relatorioTitulo: input.relatorioTitulo || null,
      iniciativaId: input.iniciativaId || null,
      title: input.title.trim(),
      fileName: file.name,
      fileSize: file.size,
      mimeType,
      storagePath,
      downloadUrl,
      createdAt: serverTimestamp(),
    };
    const created = await addDoc(collection(db, COLLECTION), payload);
    return {
      id: created.id,
      ...payload,
      description: payload.description ?? undefined,
      contractNumber: payload.contractNumber ?? undefined,
      signedAt: payload.signedAt ?? undefined,
      expiresAt: payload.expiresAt ?? undefined,
      relatorioId: payload.relatorioId ?? undefined,
      relatorioTitulo: payload.relatorioTitulo ?? undefined,
      iniciativaId: payload.iniciativaId ?? undefined,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    await deleteObject(storageRef).catch(() => undefined);
    throw error;
  }
}

/**
 * Troca o arquivo de um documento, guardando o anterior.
 *
 * O arquivo novo vai para um **caminho novo** no Storage e o antigo desce para
 * `versoesAnteriores` com a URL viva. Nada é sobrescrito e nada é removido:
 * "substituir" aqui significa "passar a apontar para outro", não "apagar".
 *
 * A peça vai para processo administrativo. Descobrir em novembro que a versão
 * protocolada em outubro era a anterior, e não ter mais a anterior, é uma perda
 * que nenhum log conserta — e é o caso que este caminho existe para evitar.
 *
 * Se a gravação no Firestore falhar, o objeto recém-subido é removido: sem
 * isso, cada tentativa frustrada deixaria um arquivo pago e órfão no bucket,
 * fora de qualquer documento e invisível na interface.
 */
export async function substituirArquivoDoDocumento(
  db: Firestore,
  storage: FirebaseStorage,
  file: File,
  documento: CityDocument,
  autor: { uid: string; nome: string; groupId: string },
  nota?: string,
): Promise<void> {
  const validationError = validateCityDocumentFile(file);
  if (validationError) throw new Error(validationError);

  const objectName = `${Date.now()}-${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const storagePath = `city-documents/${autor.groupId}/${documento.cityId}/${objectName}`;

  /* Cinto e suspensório: `uploadBytes` sobrescreve em silêncio se o caminho
     colidir, e a perda seria irreversível e invisível — o histórico apontaria
     para um objeto que já é a versão nova. O caminho tem timestamp e UUID, mas
     "praticamente impossível" não é o critério para uma perda silenciosa. */
  if (caminhoColide(documento, storagePath)) {
    throw new Error("Caminho de arquivo repetido. Tente novamente.");
  }

  const storageRef = ref(storage, storagePath);
  const mimeType = normalizedMimeType(file);
  await uploadBytes(storageRef, file, {
    contentType: mimeType,
    customMetadata: {
      groupId: autor.groupId,
      cityId: documento.cityId,
      category: documento.category,
    },
  });

  try {
    const downloadUrl = await getDownloadURL(storageRef);
    const patch = promoverNovaVersao(
      documento,
      {
        fileName: file.name,
        fileSize: file.size,
        mimeType,
        storagePath,
        downloadUrl,
        nota,
      },
      { uid: autor.uid, nome: autor.nome },
      new Date(),
    );
    await updateDoc(doc(db, COLLECTION, documento.id), patch);
  } catch (error) {
    await deleteObject(storageRef).catch(() => undefined);
    throw error;
  }
}

export async function deleteCityDocument(
  db: Firestore,
  storage: FirebaseStorage,
  document: CityDocument,
): Promise<void> {
  if (document.storagePath) {
    await deleteObject(ref(storage, document.storagePath)).catch((error) => {
      if (
        !error ||
        typeof error !== "object" ||
        !("code" in error) ||
        error.code !== "storage/object-not-found"
      ) {
        throw error;
      }
    });
  }
  await deleteDoc(doc(db, COLLECTION, document.id));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
