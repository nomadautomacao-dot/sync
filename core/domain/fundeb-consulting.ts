import { z } from "zod";

const fundebCommissionBaseSchema = z.enum(["profit", "revenue"]);

export const fundebConsultingProjectCreateSchema = z.object({
  municipalityAccountId: z.string().trim().min(1, "Municipio obrigatorio"),
  collaboratorId: z.string().trim().min(1, "Colaborador obrigatorio"),
  serviceLabel: z.string().trim().min(3, "Servico obrigatorio").default("Consultoria FUNDEB"),
  baseYear: z.coerce.number().int().min(2024).max(2100),
  commissionBase: fundebCommissionBaseSchema.default("profit"),
  commissionPercent: z.coerce.number().min(0).max(100),
  projectedMonthlyRevenue: z.coerce.number().nonnegative(),
  projectedMonthlyCost: z.coerce.number().nonnegative().default(0),
  projectedMonths: z.coerce.number().int().min(1).max(12).default(12),
  expectedStartDate: z.string().trim().optional(),
  sourceLabel: z.string().trim().optional(),
  projectionNotes: z.string().trim().optional(),
});

interface FundebConsultingOption {
  id: string;
  label: string;
  helper?: string;
}

export interface FundebConsultingProjectItem {
  id: string;
  municipalityName: string;
  state: string;
  collaboratorName: string;
  collaboratorRole: string;
  baseYear: number;
  serviceLabel: string;
  commissionBase: z.infer<typeof fundebCommissionBaseSchema>;
  commissionPercent: number;
  projectedMonthlyRevenue: number;
  projectedMonthlyCost: number;
  projectedMonthlyProfit: number;
  projectedMonths: number;
  projectedAnnualRevenue: number;
  projectedAnnualProfit: number;
  projectedCommissionAmount: number;
  expectedStartDate?: string;
  sourceLabel?: string;
  projectionNotes?: string;
  status: string;
  createdAt: string;
}

export interface FundebConsultingWorkspaceData {
  year: number;
  summary: {
    projectCount: number;
    municipalitiesCount: number;
    collaboratorsCount: number;
    projectedAnnualRevenue: number;
    projectedAnnualProfit: number;
    projectedCommissionAmount: number;
  };
  municipalities: FundebConsultingOption[];
  collaborators: FundebConsultingOption[];
  projects: FundebConsultingProjectItem[];
}
