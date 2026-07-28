import {
  collection, query, where, getDocs, addDoc, doc, setDoc,
  serverTimestamp, type Firestore,
} from 'firebase/firestore';
import type { CityAccount } from './city-types';
import { centsToReais, reaisToCents } from './city-types';

const COLLECTION = 'cities';

// --- Mappers (exported for testing) ---

export function cityFromDoc(id: string, data: Record<string, unknown>): CityAccount {
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
  const num = (v: unknown) => (typeof v === 'number' ? v : 0);
  
  return {
    id,
    name: str(data.name) ?? '',
    uf: str(data.uf) ?? '',
    codigoIbge: str(data.codigoIbge) ?? '',
    status: str(data.status) ?? 'ativo',
    stage: (str(data.stage) ?? 'mapping') as CityAccount['stage'],
    collaboratorId: str(data.collaboratorId),
    collaboratorName: str(data.collaboratorName),
    estimatedAnnualRevenue: centsToReais(num(data.estimatedAnnualRevenueCents)),
    probability: typeof data.probability === 'number' ? data.probability : 10,
    nextStepDescription: str(data.nextStepDescription),
    nextStepDueDate: str(data.nextStepDueDate),
    lastActivityAt: str(data.lastActivityAt),
  };
}

export function cityDocFromInput(
  input: Partial<CityAccount> & { name: string; uf: string },
  groupId: string,
): Record<string, unknown> {
  return {
    groupId,
    name: input.name,
    uf: input.uf,
    codigoIbge: input.codigoIbge ?? '',
    status: input.status ?? 'ativo',
    stage: input.stage ?? 'mapping',
    collaboratorId: input.collaboratorId ?? null,
    collaboratorName: input.collaboratorName ?? null,
    estimatedAnnualRevenueCents: input.estimatedAnnualRevenue
      ? reaisToCents(input.estimatedAnnualRevenue)
      : 0,
    probability: input.probability ?? 10,
    nextStepDescription: input.nextStepDescription ?? null,
    nextStepDueDate: input.nextStepDueDate ?? null,
    lastActivityAt: input.lastActivityAt ?? null,
    deletedAt: null,
  };
}

// --- CRUD ---

export async function listCities(
  db: Firestore,
  groupId: string,
  opts?: { search?: string; stage?: string },
): Promise<CityAccount[]> {
  const col = collection(db, COLLECTION);
  const q = query(col, where('groupId', '==', groupId), where('deletedAt', '==', null));
  const snap = await getDocs(q);
  
  const term = (opts?.search ?? '').trim().toLowerCase();
  const wantStage = (opts?.stage ?? '').trim();
  
  return snap.docs
    .map(d => cityFromDoc(d.id, d.data()))
    .filter(c => {
      if (wantStage && c.stage !== wantStage) return false;
      if (term) {
        const hay = `${c.name} ${c.uf} ${c.codigoIbge}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
}

export async function createCity(
  db: Firestore,
  groupId: string,
  input: Partial<CityAccount> & { name: string; uf: string },
): Promise<CityAccount> {
  const col = collection(db, COLLECTION);
  const docData = cityDocFromInput(input, groupId);
  docData.createdAt = serverTimestamp();
  docData.updatedAt = serverTimestamp();
  const ref = await addDoc(col, docData);
  return cityFromDoc(ref.id, docData);
}

export async function updateCityStage(
  db: Firestore,
  cityId: string,
  stage: string,
): Promise<void> {
  await setDoc(
    doc(db, COLLECTION, cityId),
    { stage, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function updateCityPipeline(
  db: Firestore,
  cityId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
  for (const [key, value] of Object.entries(data)) {
    if (key === 'groupId' || key === 'deletedAt') continue;
    if (key === 'estimatedAnnualRevenue' && typeof value === 'number') {
      patch.estimatedAnnualRevenueCents = reaisToCents(value);
    } else if (key === 'currentStage') {
      patch.stage = value;
    } else {
      patch[key] = value;
    }
  }
  await setDoc(doc(db, COLLECTION, cityId), patch, { merge: true });
}
