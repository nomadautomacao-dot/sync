export interface User {
  id: string;
  name: string;
  email: string;
  groupId: string;
  groupRole: string;
  image?: string;
}

export interface Company {
  id: string;
  name: string;
  tradingName: string;
  cnpj: string;
  logo?: string;
  color?: string;
  city: string;
  state: string;
  email: string;
  phone: string;
  status: string;
  segment?: string;
  enabledModules: string[];
  groupId: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  createdAt: string;
}

export const moduleCatalog = [
  { key: 'consultoria', label: 'Consultoria', description: 'Projetos, entregas, contratos e pareceres.', color: '#3b82f6', icon: 'briefcase-outline' as const },
  { key: 'fundeb', label: 'Consultoria FUNDEB', description: 'Municipios, indicadores, projecao de faturamento.', color: '#22c55e', icon: 'school-outline' as const },
  { key: 'levantamento-fundeb', label: 'Levantamento FUNDEB', description: 'Diagnostico municipal com base oficial, relatorio dirigido com IA.', color: '#6366f1', icon: 'file-document-outline' as const },
  { key: 'contrato-fundeb', label: 'Contrato FUNDEB', description: 'Geracao automatica de contratos FUNDEB.', color: '#3b82f6', icon: 'file-sign' as const },
  { key: 'case-de-sucesso', label: 'Case de Sucesso', description: 'Analise dinamica da evolucao do FUNDEB.', color: '#f59e0b', icon: 'trophy-outline' as const },
  { key: 'propostas', label: 'Propostas Comerciais', description: 'Criacao e padronizacao de propostas.', color: '#22c55e', icon: 'receipt-text-outline' as const },
  { key: 'terceirizacao', label: 'Terceirizacao', description: 'Contratos, alocacoes e custos operacionais.', color: '#f59e0b', icon: 'account-group-outline' as const },
  { key: 'formacao', label: 'Formacao', description: 'Treinamentos, certificados e presencas.', color: '#a855f7', icon: 'ribbon-outline' as const },
  { key: 'atas-registro-preco', label: 'Atas de Registro de Preco', description: 'Saldos, adesoes e vigencias.', color: '#6366f1', icon: 'clipboard-list-outline' as const },
  { key: 'tecnologia', label: 'Tecnologia', description: 'Inventario, suporte e projetos internos.', color: '#a0a4ab', icon: 'chip' as const },
];

export interface CollaboratorListItem {
  id: string;
  fullName: string;
  state?: string;
  collaboratorType: string;
  primaryRole: string;
  partnershipStatus: string;
  defaultCommissionPercent: number;
  metrics: {
    municipalitiesCount: number;
    fidelizedCount: number;
    profitYtd: number;
  };
}

export interface ExecutiveDashboardData {
  year: number;
  kpis: {
    citiesWorked: number;
    citiesActive: number;
    citiesInImplementation: number;
    citiesFidelized: number;
    activeCollaborators: number;
    grossRevenueYtd: number;
    profitBaseYtd: number;
    averageProfitPerCity: number;
    commissionForecastYtd: number;
    nextYearForecast: number;
  };
  monthlyTrend: Array<{ month: number; revenue: number; profit: number; commission: number }>;
  pipelineByStage: Array<{ stage: string; count: number; weightedProfit: number }>;
  topCollaborators: Array<{ id: string; fullName: string; cities: number; fidelizedCities: number; profitYtd: number }>;
  municipalities: Array<{ id: string; municipalityName: string; state: string; stage: string; estimatedAnnualRevenue: number; estimatedAnnualProfit: number; probability: number; collaboratorName?: string }>;
  alerts: string[];
}
