import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import { computeAccruals, CommissionRuleData, ProfitSnapshotData } from "./fecharCompetencia.core";

/**
 * Recomputa em memoria o mes corrente para todas as cidades com snapshot
 * lancado e compara com o gravado em commissionAccruals. Ataca o risco
 * central da secao "Blindagem do calculo de comissao": numero errado
 * silencioso. So loga (Cloud Logging); nao corrige sozinha.
 */
export const conferirCompetencia = onSchedule("every day 03:00", async () => {
  const db = admin.firestore();
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const competencia = `${year}-${String(month).padStart(2, "0")}`;

  const citiesSnap = await db.collection("cities").where("deletedAt", "==", null).get();

  for (const cityDoc of citiesSnap.docs) {
    const cityId = cityDoc.id;
    const groupId = cityDoc.data().groupId as string;
    const snapshotSnap = await cityDoc.ref.collection("profitSnapshots").doc(competencia).get();
    if (!snapshotSnap.exists) continue;

    const snapshot = snapshotSnap.data() as ProfitSnapshotData;
    const rulesSnap = await db
      .collection("commissionRules")
      .where("groupId", "==", groupId)
      .where("cityId", "==", cityId)
      .where("isActive", "==", true)
      .get();
    const rules: CommissionRuleData[] = rulesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CommissionRuleData, "id">) }));

    const expected = computeAccruals(cityId, year, month, snapshot, rules);
    for (const exp of expected) {
      const storedSnap = await db.collection("commissionAccruals").doc(exp.id).get();
      const storedAmount = storedSnap.data()?.accruedAmountCents as number | undefined;
      if (storedAmount !== exp.accruedAmountCents) {
        logger.error("Divergencia de comissao detectada", {
          accrualId: exp.id, cityId, competencia,
          esperado: exp.accruedAmountCents, gravado: storedAmount ?? null,
        });
      }
    }
  }
});
