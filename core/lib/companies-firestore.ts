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
import type { CompanyItem } from './company-types';

const COLLECTION = 'companies';

export function companyFromDoc(
  id: string,
  data: Record<string, unknown>
): CompanyItem {
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
  const num = (v: unknown) => (typeof v === 'number' ? v : 0);
  const arr = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);

  return {
    id,
    cnpj: str(data.cnpj) ?? '',
    razaoSocial: str(data.razaoSocial) ?? str(data.name) ?? '',
    nomeFantasia: str(data.nomeFantasia) ?? str(data.tradeName) ?? '',
    status: str(data.status) ?? 'ativo',
    activeModules: arr(data.activeModules),
    employeeCount: num(data.employeeCount),
    createdAt: str(data.createdAt),
    responsavelNome: str(data.responsavelNome),
    responsavelEmail: str(data.responsavelEmail),
    uf: str(data.uf),
    cidade: str(data.cidade),
  };
}

export function companyDocFromInput(
  input: Partial<CompanyItem> & { cnpj: string; razaoSocial: string },
  groupId: string
): Record<string, unknown> {
  return {
    groupId,
    cnpj: input.cnpj,
    razaoSocial: input.razaoSocial,
    nomeFantasia: input.nomeFantasia ?? input.razaoSocial,
    status: input.status ?? 'ativo',
    activeModules: input.activeModules ?? ['pipeline', 'levantamento_fundeb'],
    employeeCount: input.employeeCount ?? 1,
    responsavelNome: input.responsavelNome ?? null,
    responsavelEmail: input.responsavelEmail ?? null,
    uf: input.uf ?? null,
    cidade: input.cidade ?? null,
    deletedAt: null,
  };
}

export async function listCompanies(
  db: Firestore,
  groupId: string,
  opts?: { search?: string; status?: string }
): Promise<CompanyItem[]> {
  const col = collection(db, COLLECTION);
  const q = query(col, where('groupId', '==', groupId), where('deletedAt', '==', null));
  const snap = await getDocs(q);

  const term = (opts?.search ?? '').trim().toLowerCase();
  const wantStatus = (opts?.status ?? '').trim().toLowerCase();

  return snap.docs
    .map((d) => companyFromDoc(d.id, d.data()))
    .filter((c) => {
      if (wantStatus && wantStatus !== 'todos' && c.status.toLowerCase() !== wantStatus) {
        return false;
      }
      if (term) {
        const hay = `${c.razaoSocial} ${c.nomeFantasia} ${c.cnpj} ${c.responsavelNome ?? ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
}

export async function createCompany(
  db: Firestore,
  groupId: string,
  input: Partial<CompanyItem> & { cnpj: string; razaoSocial: string }
): Promise<CompanyItem> {
  const col = collection(db, COLLECTION);
  const docData = companyDocFromInput(input, groupId);
  docData.createdAt = new Date().toISOString();
  docData.updatedAt = serverTimestamp();
  const ref = await addDoc(col, docData);
  return companyFromDoc(ref.id, docData);
}

export async function updateCompany(
  db: Firestore,
  companyId: string,
  data: Partial<CompanyItem>
): Promise<void> {
  await setDoc(
    doc(db, COLLECTION, companyId),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true }
  );
}
