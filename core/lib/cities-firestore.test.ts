import { describe, it, expect } from 'vitest';
import { centsToReais, reaisToCents, formatCurrency, stageProbability, STAGE_LABELS, BOARD_STAGES, INDEX_STAGES, STAGE_KEYS } from './city-types';
import { cityFromDoc, cityDocFromInput } from './cities-firestore';

describe('centsToReais / reaisToCents', () => {
  it('converts cents to reais', () => {
    expect(centsToReais(12345)).toBe(123.45);
    expect(centsToReais(0)).toBe(0);
    expect(centsToReais(1)).toBe(0.01);
  });
  it('converts reais to cents', () => {
    expect(reaisToCents(123.45)).toBe(12345);
    expect(reaisToCents(0)).toBe(0);
    expect(reaisToCents(0.01)).toBe(1);
  });
});

describe('cityFromDoc', () => {
  it('maps a complete Firestore doc to CityAccount', () => {
    const doc = {
      name: 'Acajutiba', uf: 'BA', codigoIbge: '2900108', region: 'Nordeste',
      status: 'ativo', stage: 'first_contact',
      collaboratorId: 'c1', collaboratorName: 'João Silva',
      estimatedAnnualRevenueCents: 7095852358,
      probability: 40,
      nextStepDescription: 'Agendar reunião', nextStepDueDate: '2026-08-01',
      lastActivityAt: '2026-07-20T10:00:00Z',
    };
    const result = cityFromDoc('abc123', doc);
    expect(result.id).toBe('abc123');
    expect(result.name).toBe('Acajutiba');
    expect(result.estimatedAnnualRevenue).toBe(70958523.58);
    expect(result.stage).toBe('first_contact');
    expect(result.region).toBe('Nordeste');
    expect(result.collaboratorName).toBe('João Silva');
  });

  it('uses defaults for missing fields', () => {
    const result = cityFromDoc('empty', {});
    expect(result.name).toBe('');
    expect(result.status).toBe('ativo');
    expect(result.stage).toBe('mapping');
    expect(result.estimatedAnnualRevenue).toBe(0);
    expect(result.probability).toBe(10);
  });
});

describe('cityDocFromInput', () => {
  it('converts revenue to cents and sets groupId', () => {
    const input = { name: 'Jequié', uf: 'BA', region: 'Nordeste', estimatedAnnualRevenue: 50000 };
    const doc = cityDocFromInput(input, 'group-abc');
    expect(doc.groupId).toBe('group-abc');
    expect(doc.estimatedAnnualRevenueCents).toBe(5000000);
    expect(doc.region).toBe('Nordeste');
    expect(doc.deletedAt).toBeNull();
  });

  it('never passes groupId or deletedAt from input', () => {
    const input = {
      name: 'X',
      uf: 'SP',
      groupId: 'hacker',
      deletedAt: 'now',
    } as unknown as Parameters<typeof cityDocFromInput>[0];
    const doc = cityDocFromInput(input, 'real-group');
    expect(doc.groupId).toBe('real-group');
    expect(doc.deletedAt).toBeNull();
  });
});

describe('stageProbability', () => {
  it('returns expected values', () => {
    expect(stageProbability('mapping')).toBe(10);
    expect(stageProbability('fidelized')).toBe(100);
    expect(stageProbability('lost')).toBe(0);
  });
});

describe('constants', () => {
  it('has 13 stages', () => {
    expect(STAGE_KEYS).toHaveLength(13);
  });
  it('BOARD + INDEX = all stages', () => {
    expect([...BOARD_STAGES, ...INDEX_STAGES]).toEqual([...STAGE_KEYS]);
  });
  it('all stages have labels', () => {
    for (const key of STAGE_KEYS) {
      expect(STAGE_LABELS[key]).toBeDefined();
    }
  });
});

describe('formatCurrency', () => {
  it('formats currency in pt-BR', () => {
    const result = formatCurrency(1234567.89);
    expect(result).toContain('1.234.567');
    expect(result).toContain('R$');
  });
});
