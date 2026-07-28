export type CollaboratorType =
  | 'socio_executivo'
  | 'consultor_parceiro'
  | 'articulador_politico'
  | 'equipe_interna'
  | 'suporte_tecnico';

export type PartnershipStatus = 'ativo' | 'inativo' | 'pendente' | 'pausado';

export type LinkFilter = 'todos' | 'parceiros' | 'internos';

export interface CollaboratorItem {
  id: string;
  fullName: string;
  shortName?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  state?: string;
  collaboratorType: CollaboratorType | string;
  primaryRole: string;
  partnershipStatus: PartnershipStatus | string;
  defaultCommissionPercent: number;
  lastActivityDate?: string;
  createdAt?: string;
  sourcedCitiesCount: number;
  commissionPaidYtd: number;
  commissionForecastYtd: number;
  profitAccruedYtd: number;
  companyOrOrganization?: string;
  pixKey?: string;
  bankAccountInfo?: string;
}

export function isInternalCollaborator(type: string): boolean {
  const lower = type.toLowerCase();
  return (
    lower.includes('intern') ||
    lower.includes('socio') ||
    lower.includes('suporte') ||
    lower.includes('executivo')
  );
}

export function collaboratorLinkCategory(type: string): 'Interno' | 'Parceiro' {
  return isInternalCollaborator(type) ? 'Interno' : 'Parceiro';
}

export function statusTone(status: string): { bg: string; fg: string } {
  const s = status.toLowerCase();
  if (s.includes('inativ') || s.includes('encerrad') || s.includes('desligad')) {
    return { bg: 'bg-surface-subtle', fg: 'text-muted' };
  }
  if (s.includes('ativ')) {
    return { bg: 'bg-success-light', fg: 'text-success-dark' };
  }
  if (s.includes('pend') || s.includes('pausad')) {
    return { bg: 'bg-warning-light', fg: 'text-warning-dark' };
  }
  return { bg: 'bg-surface-subtle', fg: 'text-body' };
}

export function collaboratorInitials(name: string): string {
  if (!name) return '??';
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatCompactCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000000) {
    return `R$ ${(value / 1000000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`;
  }
  if (abs >= 1000) {
    return `R$ ${(value / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}K`;
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}
