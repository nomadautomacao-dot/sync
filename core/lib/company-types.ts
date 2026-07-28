export type CompanyStatus = 'ativo' | 'inativo' | 'pendente';

export interface CompanyEmployee {
  id: string;
  name: string;
  role: string;
  email: string;
  status: string;
}

export interface CompanyItem {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  status: CompanyStatus | string;
  activeModules: string[];
  employeeCount: number;
  createdAt?: string;
  responsavelNome?: string;
  responsavelEmail?: string;
  uf?: string;
  cidade?: string;
}

export function cleanCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, '');
}

export function formatCnpj(cnpj: string): string {
  const digits = cleanCnpj(cnpj);
  if (digits.length !== 14) return cnpj;
  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
}

export function companyStatusTone(status: string): { bg: string; fg: string } {
  const s = status.toLowerCase();
  if (s.includes('inativ')) {
    return { bg: 'bg-surface-subtle', fg: 'text-muted' };
  }
  if (s.includes('ativ')) {
    return { bg: 'bg-success-light', fg: 'text-success-dark' };
  }
  if (s.includes('pend')) {
    return { bg: 'bg-warning-light', fg: 'text-warning-dark' };
  }
  return { bg: 'bg-surface-subtle', fg: 'text-body' };
}

export function companyInitials(name: string): string {
  if (!name) return '??';
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
