import { accrue } from "./money";

export interface ProfitSnapshotData {
  profitBaseCents: number;
}

export interface CommissionRuleData {
  id: string;
  collaboratorId: string;
  baseType: string;
  percentBps: number | null;
  flatValueCents: number | null;
  isActive: boolean;
}

export interface AccrualToWrite {
  id: string;
  collaboratorId: string;
  commissionRuleId: string;
  cityId: string;
  year: number;
  month: number;
  profitBaseCents: number;
  appliedPercentBps: number | null;
  accruedAmountCents: number;
}

/** Competencia no formato usado no id do documento: "2026-07". */
function competenciaId(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Recomputa os accruals de uma competencia a partir do snapshot de lucro e
 * das regras ativas. Puro — sem I/O. `fecharCompetencia.ts` chama isto e so
 * depois grava no Firestore com set() (idempotente pelo id deterministico).
 */
export function computeAccruals(
  cityId: string,
  year: number,
  month: number,
  snapshot: ProfitSnapshotData,
  rules: CommissionRuleData[],
): AccrualToWrite[] {
  const out: AccrualToWrite[] = [];
  for (const rule of rules) {
    if (!rule.isActive) continue;

    let accruedAmountCents: number;
    let appliedPercentBps: number | null = null;

    if (rule.percentBps != null) {
      appliedPercentBps = rule.percentBps;
      accruedAmountCents = accrue(snapshot.profitBaseCents, rule.percentBps);
    } else if (rule.flatValueCents != null) {
      accruedAmountCents = rule.flatValueCents;
    } else {
      continue; // regra sem base de calculo: nada a acumular
    }

    out.push({
      id: `${rule.collaboratorId}_${cityId}_${competenciaId(year, month)}`,
      collaboratorId: rule.collaboratorId,
      commissionRuleId: rule.id,
      cityId,
      year,
      month,
      profitBaseCents: snapshot.profitBaseCents,
      appliedPercentBps,
      accruedAmountCents,
    });
  }
  return out;
}
