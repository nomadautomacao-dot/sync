import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { computeAccruals, CommissionRuleData, ProfitSnapshotData } from "./fecharCompetencia.core";

interface FecharCompetenciaInput {
  cityId: string;
  year: number;
  month: number;
}

export const fecharCompetencia = onCall<FecharCompetenciaInput>(async (request) => {
  const auth = request.auth;
  if (!auth) throw new HttpsError("unauthenticated", "Login necessario.");
  const groupRole = auth.token.groupRole as string | undefined;
  if (groupRole !== "owner" && groupRole !== "admin") {
    throw new HttpsError("permission-denied", "So owner/admin fecham competencia.");
  }
  const groupId = auth.token.groupId as string | undefined;
  if (!groupId) throw new HttpsError("failed-precondition", "Usuario sem groupId nas claims.");

  const { cityId, year, month } = request.data;
  if (!cityId || !Number.isInteger(year) || !Number.isInteger(month)) {
    throw new HttpsError("invalid-argument", "cityId/year/month obrigatorios.");
  }

  const db = getFirestore();
  const cityRef = db.collection("cities").doc(cityId);
  const citySnap = await cityRef.get();
  if (!citySnap.exists || citySnap.data()?.groupId !== groupId) {
    throw new HttpsError("not-found", "Cidade nao encontrada neste grupo.");
  }

  const competencia = `${year}-${String(month).padStart(2, "0")}`;
  const snapshotSnap = await cityRef.collection("profitSnapshots").doc(competencia).get();
  if (!snapshotSnap.exists) {
    throw new HttpsError("failed-precondition", "Sem profitSnapshot para esta competencia — registre antes com registrarProfitSnapshot.");
  }
  const snapshot = snapshotSnap.data() as ProfitSnapshotData;

  const rulesSnap = await db
    .collection("commissionRules")
    .where("groupId", "==", groupId)
    .where("cityId", "==", cityId)
    .where("isActive", "==", true)
    .get();
  const rules: CommissionRuleData[] = rulesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CommissionRuleData, "id">) }));

  const accruals = computeAccruals(cityId, year, month, snapshot, rules);

  // Le o estado atual de cada accrual antes de recomputar — preserva o
  // createdAt original (e o status/payoutId ja atribuidos) em reprocessos
  // idempotentes; so grava createdAt novo na primeira vez que o accrual existe.
  const accrualRefs = accruals.map((accrual) => db.collection("commissionAccruals").doc(accrual.id));
  const existingSnaps = accrualRefs.length > 0 ? await db.getAll(...accrualRefs) : [];

  const batch = db.batch();
  accruals.forEach((accrual, i) => {
    const existing = existingSnaps[i];
    batch.set(accrualRefs[i], {
      ...accrual,
      groupId,
      status: existing?.exists ? (existing.data()!.status as string) : "calculated",
      payoutId: existing?.exists ? (existing.data()!.payoutId ?? null) : null,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: existing?.exists ? existing.data()!.createdAt : FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  await batch.commit();

  return { competencia, accrualsCount: accruals.length };
});
