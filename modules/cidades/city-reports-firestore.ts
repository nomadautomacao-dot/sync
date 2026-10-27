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

export async function serializedSnapshot(
  snapshot?: CityReportSnapshot,
): Promise<{ value: CityReportSnapshot | null; bytes: number }> {
  if (!snapshot) return { value: null, bytes: 0 };
  const json = JSON.stringify(snapshot);
  const originalBytes = new TextEncoder().encode(json).byteLength;
  if(originalBytes>800_000) {
    const JSZip=(await import('jszip')).default;
    const zip=new JSZip();zip.file('snapshot.json',json);
    const data=await zip.generateAsync({type:'base64',compression:'DEFLATE',compressionOptions:{level:6}});
    const value:CityReportSnapshot={schemaVersion:snapshot.schemaVersion,generation:snapshot.generation,identificacao:snapshot.identificacao,compressedSnapshot:{format:'zip-base64',data,originalBytes}};
    const bytes=new TextEncoder().encode(JSON.stringify(value)).byteLength;
    if(bytes>=900_000)throw new Error('Base excede o limite de arquivamento mesmo após compressão sem perdas. Exporte os dados antes de continuar.');
    return {value,bytes};
  }
  return {
    value: JSON.parse(json) as CityReportSnapshot,
    bytes: new TextEncoder().encode(json).byteLength,
  };
}

export async function restoreCityReportSnapshot(snapshot: CityReportSnapshot): Promise<CityReportSnapshot> {
  const compressed=snapshot.compressedSnapshot;
  if(!compressed)return snapshot;
  if(compressed.format!=='zip-base64'||compressed.originalBytes>50*1024*1024)throw new Error('Formato ou tamanho de snapshot inválido.');
  const JSZip=(await import('jszip')).default;
  const zip=await JSZip.loadAsync(compressed.data,{base64:true,checkCRC32:true});
  const file=zip.file('snapshot.json');if(!file)throw new Error('Arquivo do snapshot ausente.');
  const json=await file.async('string');
  if(new TextEncoder().encode(json).byteLength!==compressed.originalBytes)throw new Error('Integridade do snapshot inválida.');
  const value=JSON.parse(json) as CityReportSnapshot;
  if(value.compressedSnapshot)throw new Error('Snapshot aninhado inválido.');
  return value;
}

export async function listCityReports(
  db: Firestore,
  groupId: string,
  cityId?: string,
): Promise<CityReport[]> {
  const snapshot = await getDocs(
    query(collection(db, COLLECTION), where("groupId", "==", groupId)),
  );
  const reports = snapshot.docs
    .map(reportFromSnapshot)
    .filter((report) => !cityId || report.cityId === cityId)
    .sort((a, b) =>
      (b.generatedAt ?? "").localeCompare(a.generatedAt ?? ""),
    );
  return Promise.all(reports.map(async report=>({...report,snapshot:report.snapshot?await restoreCityReportSnapshot(report.snapshot):undefined})));
}

export async function createCityReport(
  db: Firestore,
  input: CreateCityReportInput,
): Promise<CityReport> {
  const snapshot = await serializedSnapshot(input.snapshot);
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
