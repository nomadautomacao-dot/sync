import { stagePastelTone, type CityAccount } from '@/core/lib/city-types';

export function daysIdle(city: CityAccount): number | null {
  if (!city.lastActivityAt) return null;
  const last = new Date(city.lastActivityAt);
  if (isNaN(last.getTime())) return null;
  return Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24));
}

export function daysToDue(city: CityAccount): number | null {
  if (!city.nextStepDueDate) return null;
  const due = new Date(city.nextStepDueDate);
  if (isNaN(due.getTime())) return null;
  return Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export type CardAlert = 'none' | 'idle' | 'due';
export function cardAlert(city: CityAccount): CardAlert {
  const idle = daysIdle(city);
  if (idle !== null && idle > 7) return 'idle';
  const due = daysToDue(city);
  if (due !== null && due <= 7) return 'due';
  return 'none';
}

export function isHot(city: CityAccount): boolean {
  return city.probability >= 60;
}

export type StageSignal = 'neutral' | 'hot' | 'alert';
export function stageSignal(cities: CityAccount[]): StageSignal {
  if (cities.some(c => isHot(c))) return 'hot';
  if (cities.some(c => cardAlert(c) !== 'none')) return 'alert';
  return 'neutral';
}

export function signalColor(signal: StageSignal): string {
  switch (signal) {
    case 'hot': return '#F5A3B5';
    case 'alert': return 'var(--color-warning)';
    case 'neutral': return 'var(--color-dim)';
  }
}

/**
 * Mantido como reexport para não mudar os pontos de uso do pipeline. A tabela de
 * cores mora em `city-types` porque a bancada de módulos também a consome — duas
 * cópias divergiriam na primeira mudança do design system.
 */
export const stagePastelColor = stagePastelTone;

export function initials(name: string | undefined): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function nextStepLine(city: CityAccount): string | null {
  const desc = city.nextStepDescription;
  const raw = city.nextStepDueDate;
  const due = raw ? new Date(raw) : null;
  const validDue = due && !isNaN(due.getTime()) ? due : null;
  
  if (!desc && !validDue) return null;
  
  const datePart = validDue
    ? validDue.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    : null;
  
  if (!desc) return `prazo · ${datePart}`;
  if (!datePart) return desc;
  return `${desc} · ${datePart}`;
}
