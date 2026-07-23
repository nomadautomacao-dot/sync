import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { centsSubtract } from "./money";

interface RegistrarProfitSnapshotInput {
  cityId: string;
  year: number;
  month: number;
  recognizedRevenueCents: number;
  directCostCents: number;
  implementationCostAllocatedCents: number;
  taxesCents: number;
  notes?: string;
}

function isNonNegativeInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

export const registrarProfitSnapshot = onCall<RegistrarProfitSnapshotInput>(
  async (request) => {
    const auth = request.auth;
    if (!auth) {
      throw new HttpsError("unauthenticated", "Login necessario.");
    }
    const groupRole = auth.token.groupRole as string | undefined;
    if (groupRole !== "owner" && groupRole !== "admin") {
      throw new HttpsError("permission-denied", "So owner/admin registram lucro.");
    }
    const groupId = auth.token.groupId as string | undefined;
    if (!groupId) {
      throw new HttpsError("failed-precondition", "Usuario sem groupId nas claims.");
    }

    const d = request.data;
    if (!d?.cityId || typeof d.cityId !== "string") {
      throw new HttpsError("invalid-argument", "cityId obrigatorio.");
    }
    if (!Number.isInteger(d.year) || !Number.isInteger(d.month) || d.month < 1 || d.month > 12) {
      throw new HttpsError("invalid-argument", "year/month invalidos.");
    }
    for (const field of [
      "recognizedRevenueCents",
      "directCostCents",
      "implementationCostAllocatedCents",
      "taxesCents",
    ] as const) {
      if (!isNonNegativeInt(d[field])) {
        throw new HttpsError("invalid-argument", `${field} deve ser inteiro >= 0 (centavos).`);
      }
    }

    const db = admin.firestore();
    const cityRef = db.collection("cities").doc(d.cityId);
    const citySnap = await cityRef.get();
    if (!citySnap.exists) {
      throw new HttpsError("not-found", "Cidade nao encontrada.");
    }
    if (citySnap.data()?.groupId !== groupId) {
      throw new HttpsError("permission-denied", "Cidade de outro grupo.");
    }

    const profitBaseCents = centsSubtract(
      d.recognizedRevenueCents,
      d.directCostCents,
      d.implementationCostAllocatedCents,
      d.taxesCents,
    );

    const competencia = `${d.year}-${String(d.month).padStart(2, "0")}`;
    const snapshotRef = cityRef.collection("profitSnapshots").doc(competencia);
    await snapshotRef.set({
      groupId,
      cityId: d.cityId,
      year: d.year,
      month: d.month,
      recognizedRevenueCents: d.recognizedRevenueCents,
      directCostCents: d.directCostCents,
      implementationCostAllocatedCents: d.implementationCostAllocatedCents,
      taxesCents: d.taxesCents,
      profitBaseCents,
      notes: d.notes ?? null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return { cityId: d.cityId, competencia, profitBaseCents };
  },
);
