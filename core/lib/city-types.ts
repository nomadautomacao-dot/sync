export type StageKey =
  | 'mapping'
  | 'first_contact'
  | 'technical_diagnostic'
  | 'proposal_presented'
  | 'contractual'
  | 'institutional_validation'
  | 'negotiation'
  | 'verbal_approval'
  | 'implementation'
  | 'assisted_operation'
  | 'fidelized'
  | 'paused'
  | 'lost';

export interface CityAccount {
  id: string;
  name: string;
  uf: string;
  codigoIbge: string;
  status: string;
  stage: StageKey;
  collaboratorId?: string;
  collaboratorName?: string;
  estimatedAnnualRevenue: number; // in REAIS (converted from Firestore cents)
  probability: number; // 0-100
  nextStepDescription?: string;
  nextStepDueDate?: string;
  lastActivityAt?: string;
}

export const STAGE_KEYS: StageKey[] = [
  'mapping',
  'first_contact',
  'technical_diagnostic',
  'proposal_presented',
  'contractual',
  'institutional_validation',
  'negotiation',
  'verbal_approval',
  'implementation',
  'assisted_operation',
  'fidelized',
  'paused',
  'lost',
];

export const STAGE_LABELS: Record<StageKey, string> = {
  mapping: 'Mapeamento',
  first_contact: '1º Contato',
  technical_diagnostic: 'Diag. Técnico',
  proposal_presented: 'Proposta Apres.',
  contractual: 'Contratual',
  institutional_validation: 'Validação Inst.',
  negotiation: 'Negociação',
  verbal_approval: 'Aprov. Verbal',
  implementation: 'Implantação',
  assisted_operation: 'Op. Assistida',
  fidelized: 'Fidelizada',
  paused: 'Pausado',
  lost: 'Perdido',
};

export const BOARD_STAGES: StageKey[] = [
  'mapping',
  'first_contact',
  'technical_diagnostic',
  'proposal_presented',
  'contractual',
];

export const INDEX_STAGES: StageKey[] = [
  'institutional_validation',
  'negotiation',
  'verbal_approval',
  'implementation',
  'assisted_operation',
  'fidelized',
  'paused',
  'lost',
];

export function stageProbability(stage: StageKey): number {
  switch (stage) {
    case 'mapping': return 10;
    case 'first_contact': return 20;
    case 'technical_diagnostic': return 30;
    case 'proposal_presented': return 40;
    case 'contractual': return 50;
    case 'institutional_validation': return 55;
    case 'negotiation': return 60;
    case 'verbal_approval': return 70;
    case 'implementation': return 80;
    case 'assisted_operation': return 90;
    case 'fidelized': return 100;
    case 'paused': return 5;
    case 'lost': return 0;
    default: return 0;
  }
}

export function stageChipTone(stage: StageKey): { bg: string; fg: string } {
  switch (stage) {
    case 'mapping':
    case 'first_contact':
      return { bg: 'bg-surface-subtle', fg: 'text-muted' };
    case 'technical_diagnostic':
    case 'proposal_presented':
    case 'contractual':
      return { bg: 'bg-primary-light', fg: 'text-primary-strong' };
    case 'institutional_validation':
      return { bg: 'bg-primary-light', fg: 'text-primary-dim' };
    case 'negotiation':
    case 'verbal_approval':
      return { bg: 'bg-warning-light', fg: 'text-warning-dark' };
    case 'implementation':
    case 'assisted_operation':
    case 'fidelized':
      return { bg: 'bg-success-light', fg: 'text-success-dark' };
    case 'paused':
      return { bg: 'bg-surface-subtle', fg: 'text-dim' };
    case 'lost':
      return { bg: 'bg-error-light', fg: 'text-error-dark' };
    default:
      return { bg: 'bg-surface-subtle', fg: 'text-muted' };
  }
}

export interface StagePastelTone {
  /** Fundo do chip. */
  bg: string;
  /** Ponto colorido à esquerda do rótulo. */
  dot: string;
  /** Cor do rótulo. */
  text: string;
}

/**
 * Chip de estágio nas famílias pastel do Console Soft.
 *
 * Os treze estágios se agrupam nas cinco famílias que o `DESIGN.md` define para
 * o pipeline — contrato (rosa), proposta (amarelo), estudo (verde) e contato
 * (azul) —, com pausado e perdido fora da escala por não serem progresso.
 */
export function stagePastelTone(stage: string): StagePastelTone {
  switch (stage) {
    case 'contractual':
    case 'implementation':
    case 'assisted_operation':
    case 'fidelized':
      return { bg: '#FBE0E7', dot: '#F5A3B5', text: '#16181D' };
    case 'proposal_presented':
    case 'negotiation':
    case 'verbal_approval':
      return { bg: '#FBF0D9', dot: '#F7C77E', text: '#16181D' };
    case 'technical_diagnostic':
    case 'institutional_validation':
      return { bg: '#DFF2E7', dot: '#8FD3B6', text: '#16181D' };
    case 'mapping':
    case 'first_contact':
      return { bg: '#E2EDFA', dot: '#93B8F2', text: '#16181D' };
    case 'lost':
      return { bg: '#FFE5E5', dot: '#E5484D', text: '#991B1B' };
    case 'paused':
    default:
      return { bg: '#F2F1F7', dot: '#A2A6B2', text: '#5A5E6A' };
  }
}

export function centsToReais(cents: number): number {
  return cents / 100;
}

export function reaisToCents(reais: number): number {
  return Math.round(reais * 100);
}

export function formatCurrency(reais: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(reais);
}

export function formatCurrencyCompact(reais: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 2 }).format(reais);
}

export interface Matriculas {
  total: number;
  creche: number;
  preEscola: number;
  anosIniciais: number;
  anosFinais: number;
  eja: number;
  especial: number;
  integral: number;
}

export interface FundebDiagnostico {
  cityId: string;
  exercicio: number;
  
  gestor: string;
  partido: string;
  populacao: number;
  areaKm2: number;
  pibPerCapita: number;
  escolarizacao614: number;
  
  receitaFundeb2026: number;
  estimativa2027: number;
  ganhoPotencial: number;
  ganhoPotencialPct: number;
  camadaRecuperavel: number;
  
  vaafAtual: number;
  vaafProjetado: number;
  vaatAtual: number;
  vaatProjetado: number;
  vaarAtual: number;
  vaarProjetado: number;
  
  habilitacaoVaat: boolean;
  indiceEficienciaArrecadatoria: number;
  fundebPerCapita: number;
  fatorAjusteRegional: number;
  
  matriculas: Matriculas;
  coberturaIntegralPct: number;
  recursoRealPorAluno: number;
  
  idebAnosIniciais?: number;
  idebAnosFinais?: number;
  metaIdebAnosIniciais?: number;
  metaIdebAnosFinais?: number;
  
  simecObras: number;
  pddeEscolas: number;
  sigarpwebStatus?: string;
  
  despesaEducacao: number;
  vinculacaoMde: number;
  
  alertasTecnicos: string[];
  proximosPassos: string[];
}
