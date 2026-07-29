"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
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
      createdAt: new Date().toISOString(),
    };
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
