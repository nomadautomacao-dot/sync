import * as admin from "firebase-admin";
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

  const db = admin.firestore();
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

  const batch = db.batch();
  for (const accrual of accruals) {
    batch.set(db.collection("commissionAccruals").doc(accrual.id), {
      ...accrual,
      groupId,
      status: "calculated",
      payoutId: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  await batch.commit();

  return { competencia, accrualsCount: accruals.length };
});
