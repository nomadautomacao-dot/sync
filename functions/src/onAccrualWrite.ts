import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { computePayoutTotals, AccrualForTotals } from "./onAccrualWrite.core";

export const onAccrualWrite = onDocumentWritten("commissionAccruals/{id}", async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  const payoutId = (after?.payoutId ?? before?.payoutId) as string | undefined;
  if (!payoutId) return; // accrual sem payout associado ainda: nada a recalcular

  const db = getFirestore();
  const payoutRef = db.collection("commissionPayouts").doc(payoutId);

  await db.runTransaction(async (tx) => {
    const accrualsSnap = await tx.get(
      db.collection("commissionAccruals").where("payoutId", "==", payoutId),
    );
    const accruals: AccrualForTotals[] = accrualsSnap.docs.map((d) => ({
      accruedAmountCents: d.data().accruedAmountCents as number,
      status: d.data().status as string,
    }));
    const totals = computePayoutTotals(accruals);
    tx.set(payoutRef, {
      ...totals,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
});
