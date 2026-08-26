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

/** O que a ficha deixa editar — e nada além disso. */
export type CamposEditaveis = Pick<
  CollaboratorItem,
  | 'fullName'
  | 'email'
  | 'phone'
  | 'whatsapp'
  | 'state'
  | 'primaryRole'
  | 'collaboratorType'
  | 'partnershipStatus'
  | 'defaultCommissionPercent'
  | 'companyOrOrganization'
  | 'pixKey'
  | 'bankAccountInfo'
>;

const CAMPOS_DE_TEXTO = [
  'email',
  'phone',
  'whatsapp',
  'companyOrOrganization',
  'pixKey',
  'bankAccountInfo',
] as const;

/**
 * O corpo de uma edição, com só os campos que a pessoa preencheu na mão.
 *
 * Existe por duas razões que já morderiam se a tela mandasse o objeto inteiro:
 *
 * 1. **O Firestore recusa `undefined`.** Campo apagado no formulário chega como
 *    `""` ou `undefined`, e `setDoc` estoura em vez de gravar. Aqui vira `null`,
 *    que é como o resto da coleção representa ausência.
 * 2. **Números apurados não são do formulário.** `commissionPaidYtd`,
 *    `profitAccruedYtd` e `sourcedCitiesCount` vêm de contrato e comissão; se
 *    entrassem no `merge`, salvar um telefone zeraria o histórico financeiro da
 *    pessoa em silêncio. Eles não estão em `CamposEditaveis` de propósito.
 */
export function corpoDaEdicao(entrada: Partial<CamposEditaveis>): Record<string, unknown> {
  const corpo: Record<string, unknown> = {};

  if (entrada.fullName !== undefined) corpo.fullName = entrada.fullName.trim();
  if (entrada.state !== undefined) corpo.state = entrada.state.trim().toUpperCase();
  if (entrada.primaryRole !== undefined) corpo.primaryRole = entrada.primaryRole.trim();
  if (entrada.collaboratorType !== undefined) corpo.collaboratorType = entrada.collaboratorType;
  if (entrada.partnershipStatus !== undefined) corpo.partnershipStatus = entrada.partnershipStatus;
  if (entrada.defaultCommissionPercent !== undefined) {
    corpo.defaultCommissionPercent = entrada.defaultCommissionPercent;
  }

  for (const campo of CAMPOS_DE_TEXTO) {
    if (entrada[campo] === undefined) continue;
    const limpo = (entrada[campo] ?? '').trim();
    corpo[campo] = limpo === '' ? null : limpo;
  }

  return corpo;
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
  data: Partial<CamposEditaveis>
): Promise<void> {
  await setDoc(
    doc(db, COLLECTION, collaboratorId),
    { ...corpoDaEdicao(data), updatedAt: serverTimestamp() },
    { merge: true }
  );
}
