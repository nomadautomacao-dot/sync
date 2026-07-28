import { describe, it, expect } from 'vitest';
import {
  isInternalCollaborator,
  collaboratorLinkCategory,
  statusTone,
  collaboratorInitials,
  formatCompactCurrency,
} from './people-types';
import { formatCnpj, cleanCnpj, companyInitials } from './company-types';

describe('people-types helpers', () => {
  it('identifies internal vs partner collaborators', () => {
    expect(isInternalCollaborator('socio_executivo')).toBe(true);
    expect(isInternalCollaborator('equipe_interna')).toBe(true);
    expect(isInternalCollaborator('consultor_parceiro')).toBe(false);
    expect(collaboratorLinkCategory('consultor_parceiro')).toBe('Parceiro');
    expect(collaboratorLinkCategory('socio_executivo')).toBe('Interno');
  });

  it('formats initials correctly', () => {
    expect(collaboratorInitials('João Silva')).toBe('JS');
    expect(collaboratorInitials('Maria')).toBe('MA');
    expect(collaboratorInitials('')).toBe('??');
  });

  it('formats compact currency', () => {
    expect(formatCompactCurrency(1500000)).toContain('1,50M');
    expect(formatCompactCurrency(45000)).toContain('45,0K');
  });

  it('status tone mappings', () => {
    expect(statusTone('ativo').fg).toBe('text-success-dark');
    expect(statusTone('inativo').fg).toBe('text-muted');
  });
});

describe('company-types helpers', () => {
  it('cleans and formats CNPJ', () => {
    const raw = '12.345.678/0001-95';
    expect(cleanCnpj(raw)).toBe('12345678000195');
    expect(formatCnpj('12345678000195')).toBe('12.345.678/0001-95');
  });

  it('formats company initials', () => {
    expect(companyInitials('Empresa Alpha Ltda')).toBe('EL');
  });
});
