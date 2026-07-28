import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  setDoc,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import type { CollaboratorItem } from './people-types';

const COLLECTION = 'collaborators';

export function collaboratorFromDoc(
  id: string,
  data: Record<string, unknown>
): CollaboratorItem {
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
  const num = (v: unknown) => (typeof v === 'number' ? v : 0);

  return {
    id,
    fullName: str(data.fullName) ?? str(data.name) ?? '',
    shortName: str(data.shortName),
    email: str(data.email),
    phone: str(data.phone),
    whatsapp: str(data.whatsapp),
    state: str(data.state) ?? str(data.uf) ?? 'DF',
    collaboratorType: str(data.collaboratorType) ?? 'consultor_parceiro',
    primaryRole: str(data.primaryRole) ?? 'Consultor Regional',
    partnershipStatus: str(data.partnershipStatus) ?? str(data.status) ?? 'ativo',
    defaultCommissionPercent: num(data.defaultCommissionPercent) || 10,
    lastActivityDate: str(data.lastActivityDate),
    createdAt: str(data.createdAt),
    sourcedCitiesCount: num(data.sourcedCitiesCount),
    commissionPaidYtd: num(data.commissionPaidYtd),
    commissionForecastYtd: num(data.commissionForecastYtd),
    profitAccruedYtd: num(data.profitAccruedYtd),
    companyOrOrganization: str(data.companyOrOrganization),
    pixKey: str(data.pixKey),
    bankAccountInfo: str(data.bankAccountInfo),
  };
}

export function collaboratorDocFromInput(
  input: Partial<CollaboratorItem> & { fullName: string },
  groupId: string
): Record<string, unknown> {
  return {
    groupId,
    fullName: input.fullName,
    shortName: input.shortName ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    whatsapp: input.whatsapp ?? null,
    state: input.state ?? 'DF',
    collaboratorType: input.collaboratorType ?? 'consultor_parceiro',
    primaryRole: input.primaryRole ?? 'Consultor Regional',
    partnershipStatus: input.partnershipStatus ?? 'ativo',
    defaultCommissionPercent: input.defaultCommissionPercent ?? 10,
    sourcedCitiesCount: input.sourcedCitiesCount ?? 0,
    commissionPaidYtd: input.commissionPaidYtd ?? 0,
    commissionForecastYtd: input.commissionForecastYtd ?? 0,
    profitAccruedYtd: input.profitAccruedYtd ?? 0,
    companyOrOrganization: input.companyOrOrganization ?? null,
    pixKey: input.pixKey ?? null,
    bankAccountInfo: input.bankAccountInfo ?? null,
    deletedAt: null,
  };
}

export async function listCollaborators(
  db: Firestore,
  groupId: string,
  opts?: { search?: string; linkFilter?: string }
): Promise<CollaboratorItem[]> {
  const col = collection(db, COLLECTION);
  const q = query(col, where('groupId', '==', groupId), where('deletedAt', '==', null));
  const snap = await getDocs(q);

  const term = (opts?.search ?? '').trim().toLowerCase();
  const filter = opts?.linkFilter ?? 'todos';

  return snap.docs
    .map((d) => collaboratorFromDoc(d.id, d.data()))
    .filter((c) => {
      if (filter === 'parceiros') {
        const isInt =
          c.collaboratorType.includes('interno') ||
          c.collaboratorType.includes('socio') ||
          c.collaboratorType.includes('executivo');
        if (isInt) return false;
      } else if (filter === 'internos') {
        const isInt =
          c.collaboratorType.includes('interno') ||
          c.collaboratorType.includes('socio') ||
          c.collaboratorType.includes('executivo');
        if (!isInt) return false;
      }

      if (term) {
        const hay = `${c.fullName} ${c.shortName ?? ''} ${c.primaryRole} ${c.state ?? ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
}

export async function createCollaborator(
  db: Firestore,
  groupId: string,
  input: Partial<CollaboratorItem> & { fullName: string }
): Promise<CollaboratorItem> {
  const col = collection(db, COLLECTION);
  const docData = collaboratorDocFromInput(input, groupId);
  docData.createdAt = new Date().toISOString();
  docData.updatedAt = serverTimestamp();
  const ref = await addDoc(col, docData);
  return collaboratorFromDoc(ref.id, docData);
}

export async function updateCollaborator(
  db: Firestore,
  collaboratorId: string,
  data: Partial<CollaboratorItem>
): Promise<void> {
  await setDoc(
    doc(db, COLLECTION, collaboratorId),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true }
  );
}
