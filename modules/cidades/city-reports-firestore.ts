"use client";

import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import {
  CITY_REPORT_TYPES,
  type CityReport,
  type CityReportSnapshot,
  type CityReportType,
  type CreateCityReportInput,
  type GeneratedReportArchive,
  type GeneratedReportBundle,
} from "./reports-types";

const COLLECTION = "cityReports";

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

function reportFromSnapshot(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): CityReport {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    groupId: stringValue(data.groupId),
    cityId: stringValue(data.cityId),
    cityName: stringValue(data.cityName),
    cityUf: stringValue(data.cityUf),
    codigoIbge: stringValue(data.codigoIbge),
    type: stringValue(data.type) as CityReportType,
    title: stringValue(data.title),
    exercise: Number(data.exercise) || new Date().getFullYear(),
    status: "ready",
    snapshot:
      data.snapshot && typeof data.snapshot === "object"
        ? (data.snapshot as CityReportSnapshot)
        : undefined,
    generationId: optionalString(data.generationId),
    snapshotBytes: Number(data.snapshotBytes) || undefined,
    documentId: optionalString(data.documentId),
    downloadUrl: optionalString(data.downloadUrl),
    fileName: optionalString(data.fileName),
    generatedBy: stringValue(data.generatedBy),
    generatedByName: stringValue(data.generatedByName),
    generatedAt: timestampToIso(data.generatedAt),
  };
}

function serializedSnapshot(
  snapshot?: CityReportSnapshot,
): { value: CityReportSnapshot | null; bytes: number } {
  if (!snapshot) return { value: null, bytes: 0 };
  const json = JSON.stringify(snapshot);
  return {
    value: JSON.parse(json) as CityReportSnapshot,
    bytes: new TextEncoder().encode(json).byteLength,
  };
}

export async function listCityReports(
  db: Firestore,
  groupId: string,
  cityId?: string,
): Promise<CityReport[]> {
  const snapshot = await getDocs(
    query(collection(db, COLLECTION), where("groupId", "==", groupId)),
  );
  return snapshot.docs
    .map(reportFromSnapshot)
    .filter((report) => !cityId || report.cityId === cityId)
    .sort((a, b) =>
      (b.generatedAt ?? "").localeCompare(a.generatedAt ?? ""),
    );
}

export async function createCityReport(
  db: Firestore,
  input: CreateCityReportInput,
): Promise<CityReport> {
  const snapshot = serializedSnapshot(input.snapshot);
  const payload = {
    ...input,
    status: "ready" as const,
    snapshot: snapshot.value,
    snapshotBytes: snapshot.bytes,
    generationId: input.generationId,
    documentId: input.documentId || null,
    downloadUrl: input.downloadUrl || null,
    fileName: input.fileName || null,
    generatedAt: serverTimestamp(),
  };
  const created = await addDoc(collection(db, COLLECTION), payload);
  return {
    id: created.id,
    ...input,
    status: "ready",
    snapshot: input.snapshot,
    snapshotBytes: snapshot.bytes,
    generatedAt: new Date().toISOString(),
  };
}

function recordOrUndefined(candidate: unknown): Record<string, unknown> | undefined {
  return candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? (candidate as Record<string, unknown>)
    : undefined;
}

export function generatedReportBundleFromUnknown(
  value: unknown,
): GeneratedReportBundle | null {
  const root = recordOrUndefined(value);
  const archive = recordOrUndefined(root?.archive);
  const municipality = recordOrUndefined(archive?.municipality);
  const data = recordOrUndefined(archive?.data);
  const primary = recordOrUndefined(data?.primary);
  if (
    root?.schemaVersion !== 1 ||
    typeof root.fileName !== "string" ||
    root.mimeType !== "application/pdf" ||
    typeof root.pdfBase64 !== "string" ||
    !root.pdfBase64 ||
    archive?.schemaVersion !== 1 ||
    typeof archive.generationId !== "string" ||
    !archive.generationId ||
    !CITY_REPORT_TYPES.includes(archive.reportType as CityReportType) ||
    typeof archive.generatedAt !== "string" ||
    typeof archive.exercise !== "number" ||
    typeof municipality?.name !== "string" ||
    typeof municipality.uf !== "string" ||
    typeof municipality.codigoIbge !== "string" ||
    !primary
  ) {
    return null;
  }
  return value as GeneratedReportBundle;
}

export function cityReportSnapshotFromUnknown(
  value: unknown,
): CityReportSnapshot | undefined {
  if (!value || typeof value !== "object") return undefined;
  const received = value as Record<string, unknown>;
  const archive =
    received.schemaVersion === 1 &&
    typeof received.generationId === "string" &&
    recordOrUndefined(received.data)
      ? (received as unknown as GeneratedReportArchive)
      : undefined;
  const archiveData = recordOrUndefined(archive?.data);
  const root = recordOrUndefined(archiveData?.primary) ?? received;
  const isEnvelope =
    Boolean(recordOrUndefined(root.relatorio)) ||
    Boolean(recordOrUndefined(root.payload));
  const explicitPayload = recordOrUndefined(root.payload);
  const report =
    recordOrUndefined(root.relatorio) ??
    recordOrUndefined(explicitPayload?.relatorio_fundeb) ??
    recordOrUndefined(root.relatorio_fundeb) ??
    root;
  const payload = explicitPayload ?? (
    root.dados_basicos || root.relatorio_dirigido_base
      ? root
      : undefined
  );
  const payloadWithoutDuplicatedReport = payload
    ? Object.fromEntries(
        Object.entries(payload).filter(([key]) => key !== "relatorio_fundeb"),
      )
    : undefined;
  const objectFromReport = (field: string) =>
    recordOrUndefined(report[field]);
  const opportunities = Array.isArray(root.oportunidades)
    ? root.oportunidades
    : Array.isArray(payload?.oportunidades)
      ? payload.oportunidades
      : undefined;
  const municipalityData = isEnvelope
    ? recordOrUndefined(root.municipio)
    : undefined;
  const additionalData = isEnvelope
    ? Object.fromEntries(
        Object.entries(root).filter(
          ([key]) =>
            !["relatorio", "payload", "oportunidades", "municipio"].includes(
              key,
            ),
        ),
      )
    : undefined;

  return {
    schemaVersion: archive ? 3 : 2,
    generation: archive
      ? {
          schemaVersion: archive.schemaVersion,
          generationId: archive.generationId,
          reportType: archive.reportType,
          generatedAt: archive.generatedAt,
          exercise: archive.exercise,
          municipality: archive.municipality,
        }
      : undefined,
    generationContext: archiveData
      ? recordOrUndefined(archiveData.context)
      : undefined,
    identificacao: objectFromReport("identificacao"),
    projecao: objectFromReport("projecao"),
    projecaoRecuperavel: objectFromReport("projecaoRecuperavel"),
    censoEscolar: objectFromReport("censoEscolar"),
    perfilComercial: objectFromReport("perfilComercial"),
    reportData: report,
    sourcePayload: payloadWithoutDuplicatedReport,
    opportunities,
    municipalityData,
    additionalData:
      additionalData && Object.keys(additionalData).length > 0
        ? additionalData
        : undefined,
  };
}
