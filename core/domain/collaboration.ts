import { z } from "zod";

const collaboratorTypeSchema = z.enum([
  "internal_consultant",
  "external_partner",
  "municipal_articulator",
  "introducer",
  "strategic_advisor",
  "implementation_support",
  "executive_sponsor",
  "hybrid",
]);

const partnershipStatusSchema = z.enum([
  "prospect",
  "active",
  "paused",
  "blocked",
  "inactive",
]);

export const municipalityStageSchema = z.enum([
  "mapping",
  "first_contact",
  "institutional_validation",
  "technical_diagnosis",
  "proposal_presented",
  "negotiation",
  "verbally_approved",
  "contractual",
  "implementation",
  "assisted_operation",
  "fidelized",
  "paused",
  "lost",
]);

const commissionBaseTypeSchema = z.enum([
  "gross_revenue",
  "gross_margin",
  "recurring_profit_pre_commission",
  "operational_profit_pre_commission",
  "net_profit",
]);

const commissionTriggerTypeSchema = z.enum([
  "on_signature",
  "on_go_live",
  "on_fidelization",
  "monthly_recurring_after_fidelization",
  "milestone_based",
]);

export const collaboratorCreateSchema = z.object({
  fullName: z.string().trim().min(3, "Nome obrigatorio"),
  shortName: z.string().trim().optional(),
  email: z.union([z.email("Email invalido"), z.literal("")]).optional(),
  phone: z.string().trim().optional(),
  whatsapp: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().max(2, "UF invalida").transform((value) => value.toUpperCase()).optional(),
  companyOrOrganization: z.string().trim().optional(),
  title: z.string().trim().optional(),
  collaboratorType: collaboratorTypeSchema.default("external_partner"),
  primaryRole: z.string().trim().min(2, "Papel principal obrigatorio"),
  partnershipStatus: partnershipStatusSchema.default("active"),
  source: z.string().trim().optional(),
  referredBy: z.string().trim().optional(),
  primaryState: z.string().trim().max(2).transform((value) => value.toUpperCase()).optional(),
  primaryRegion: z.string().trim().optional(),
  defaultCommissionPercent: z.coerce.number().min(0).max(100).default(3),
  defaultProfitBaseType: commissionBaseTypeSchema.default("operational_profit_pre_commission"),
  defaultTriggerType: commissionTriggerTypeSchema.default("monthly_recurring_after_fidelization"),
  payoutCycle: z.string().trim().default("monthly"),
  payoutMethod: z.string().trim().default("transfer"),
  onboardingDate: z.iso.date().optional(),
  notes: z.string().trim().optional(),
});

export const collaboratorUpdateSchema = z.object({
  fullName: z.string().trim().min(3, "Nome obrigatorio").optional(),
  shortName: z.string().trim().nullable().optional(),
  email: z.union([z.email("Email invalido"), z.literal("")]).nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  whatsapp: z.string().trim().nullable().optional(),
  cpfOrDocument: z.string().trim().nullable().optional(),
  city: z.string().trim().nullable().optional(),
  state: z.string().trim().max(2, "UF invalida").transform((value) => value ? value.toUpperCase() : null).nullable().optional(),
  companyOrOrganization: z.string().trim().nullable().optional(),
  title: z.string().trim().nullable().optional(),
  collaboratorType: collaboratorTypeSchema.optional(),
  primaryRole: z.string().trim().min(2, "Papel principal obrigatorio").optional(),
  partnershipStatus: partnershipStatusSchema.optional(),
  trustLevel: z.coerce.number().int().min(1).max(5).nullable().optional(),
  averageInfluenceScore: z.coerce.number().int().min(1).max(10).nullable().optional(),
  defaultCommissionPercent: z.coerce.number().min(0).max(100).optional(),
  defaultProfitBaseType: commissionBaseTypeSchema.nullable().optional(),
  defaultTriggerType: commissionTriggerTypeSchema.nullable().optional(),
  payoutCycle: z.string().trim().nullable().optional(),
  payoutMethod: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  confidentialNotes: z.string().trim().nullable().optional(),
});

export const collaboratorDocumentCreateSchema = z.object({
  category: z.string().trim().min(1, "Categoria obrigatoria"),
  documentType: z.string().trim().min(1, "Tipo de documento obrigatorio"),
  name: z.string().trim().min(1, "Nome obrigatorio"),
  fileName: z.string().trim().min(1, "Nome do arquivo obrigatorio"),
  fileUrl: z.string().trim().url("URL invalida"),
  fileSize: z.coerce.number().int().nonnegative().optional(),
  mimeType: z.string().trim().optional(),
  issuedAt: z.preprocess((val) => val === "" ? undefined : val, z.iso.date().optional()),
  expiresAt: z.preprocess((val) => val === "" ? undefined : val, z.iso.date().optional()),
  notes: z.string().trim().optional(),
});


export const collaboratorQuerySchema = z.object({
  search: z.string().optional(),
  status: partnershipStatusSchema.optional(),
  type: collaboratorTypeSchema.optional(),
  year: z.coerce.number().int().min(2020).max(2100).optional(),
});

export const municipalityCreateSchema = z.object({
  municipalityName: z.string().trim().min(2, "Municipio obrigatorio"),
  state: z.string().trim().min(2).max(2).transform((value) => value.toUpperCase()),
  ibgeCode: z.string().trim().optional(),
  currentStage: municipalityStageSchema.default("mapping"),
  sourceType: z.string().trim().optional(),
  sourceDescription: z.string().trim().optional(),
  mayorName: z.string().trim().optional(),
  educationSecretaryName: z.string().trim().optional(),
  procurementLeadName: z.string().trim().optional(),
  estimatedAnnualRevenue: z.coerce.number().nonnegative().optional(),
  estimatedAnnualCost: z.coerce.number().nonnegative().optional(),
  expectedStartDate: z.iso.date().optional(),
  expectedFidelizationDate: z.iso.date().optional(),
  forecastProbability: z.coerce.number().min(0).max(1).optional(),
});

export interface CollaboratorListItem {
  id: string;
  fullName: string;
  shortName?: string;
  state?: string;
  collaboratorType: z.infer<typeof collaboratorTypeSchema>;
  primaryRole: string;
  partnershipStatus: z.infer<typeof partnershipStatusSchema>;
  defaultCommissionPercent: number;
  lastActivityDate?: string;
  createdAt: string;
  metrics: {
    municipalitiesCount: number;
    fidelizedCount: number;
    profitYtd: number;
    commissionForecastYtd: number;
    nextYearForecast: number;
  };
}

export interface CollaboratorDashboardCity {
  id: string;
  municipalityName: string;
  state: string;
  stage: z.infer<typeof municipalityStageSchema>;
  probability: number;
  estimatedAnnualRevenue: number;
  estimatedAnnualProfit: number;
  agreedCommissionPercent: number;
  commissionForecast: number;
  ownerName?: string;
  nextStep?: string;
  fidelityStatus?: string;
}

export interface CollaboratorDashboardData {
  collaborator: CollaboratorListItem & {
    email?: string;
    phone?: string;
    whatsapp?: string;
    companyOrOrganization?: string;
    payoutCycle?: string;
    payoutMethod?: string;
    notes?: string;
  };
  kpis: {
    associatedCities: number;
    sourcedCities: number;
    fidelizedCities: number;
    conversionRate: number;
    profitYtd: number;
    commissionForecastYtd: number;
    commissionPaidYtd: number;
    nextYearForecast: number;
  };
  monthlyTrend: Array<{
    month: number;
    profit: number;
    commissionForecast: number;
    commissionPaid: number;
  }>;
  cities: CollaboratorDashboardCity[];
  alerts: string[];
}

export interface ExecutiveDashboardData {
  year: number;
  kpis: {
    citiesWorked: number;
    citiesActive: number;
    citiesInImplementation: number;
    citiesFidelized: number;
    activeCollaborators: number;
    resultCollaborators: number;
    grossRevenueYtd: number;
    profitBaseYtd: number;
    averageProfitPerCity: number;
    commissionForecastYtd: number;
    nextYearForecast: number;
  };
  monthlyTrend: Array<{
    month: number;
    revenue: number;
    profit: number;
    commission: number;
  }>;
  pipelineByStage: Array<{
    stage: string;
    count: number;
    weightedProfit: number;
  }>;
  topCollaborators: Array<{
    id: string;
    fullName: string;
    cities: number;
    fidelizedCities: number;
    profitYtd: number;
    nextYearForecast: number;
  }>;
  municipalities: Array<{
    id: string;
    municipalityName: string;
    state: string;
    stage: string;
    estimatedAnnualRevenue: number;
    estimatedAnnualProfit: number;
    probability: number;
    collaboratorName?: string;
  }>;
  alerts: string[];
}
