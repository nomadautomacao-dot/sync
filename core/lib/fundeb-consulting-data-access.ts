import { prisma } from "@/core/lib/prisma";
import type { FundebConsultingProjectItem, FundebConsultingWorkspaceData } from "@/core/domain/fundeb-consulting";

function toNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalString(value?: string | null) {
  const clean = value?.trim();
  return clean ? clean : undefined;
}

function toDateString(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : undefined;
}

function mapProject(project: {
  id: string;
  baseYear: number;
  serviceLabel: string;
  commissionBase: string;
  commissionPercent: unknown;
  projectedMonthlyRevenue: unknown;
  projectedMonthlyCost: unknown;
  projectedMonthlyProfit: unknown;
  projectedMonths: number;
  projectedAnnualRevenue: unknown;
  projectedAnnualProfit: unknown;
  projectedCommissionAmount: unknown;
  expectedStartDate: Date | null;
  sourceLabel: string | null;
  projectionNotes: string | null;
  status: string;
  createdAt: Date;
  municipalityAccount: { municipalityName: string; state: string };
  collaborator: { fullName: string; primaryRole: string };
}): FundebConsultingProjectItem {
  return {
    id: project.id,
    municipalityName: project.municipalityAccount.municipalityName,
    state: project.municipalityAccount.state,
    collaboratorName: project.collaborator.fullName,
    collaboratorRole: project.collaborator.primaryRole,
    baseYear: project.baseYear,
    serviceLabel: project.serviceLabel,
    commissionBase: project.commissionBase === "revenue" ? "revenue" : "profit",
    commissionPercent: toNumber(project.commissionPercent),
    projectedMonthlyRevenue: toNumber(project.projectedMonthlyRevenue),
    projectedMonthlyCost: toNumber(project.projectedMonthlyCost),
    projectedMonthlyProfit: toNumber(project.projectedMonthlyProfit),
    projectedMonths: project.projectedMonths,
    projectedAnnualRevenue: toNumber(project.projectedAnnualRevenue),
    projectedAnnualProfit: toNumber(project.projectedAnnualProfit),
    projectedCommissionAmount: toNumber(project.projectedCommissionAmount),
    expectedStartDate: toDateString(project.expectedStartDate),
    sourceLabel: optionalString(project.sourceLabel),
    projectionNotes: optionalString(project.projectionNotes),
    status: project.status,
    createdAt: project.createdAt.toISOString(),
  };
}

export async function getFundebConsultingWorkspace(groupId: string, year: number): Promise<FundebConsultingWorkspaceData> {
  const [projects, municipalities, collaborators] = await Promise.all([
    prisma.fundebConsultingProject.findMany({
      where: { groupId, baseYear: year },
      include: {
        municipalityAccount: true,
        collaborator: true,
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.municipalityAccount.findMany({
      where: { groupId },
      orderBy: [{ state: "asc" }, { municipalityName: "asc" }],
      select: {
        id: true,
        municipalityName: true,
        state: true,
        currentStage: true,
      },
    }),
    prisma.collaborator.findMany({
      where: {
        groupId,
        partnershipStatus: { in: ["active", "prospect", "paused"] },
      },
      orderBy: [{ fullName: "asc" }],
      select: {
        id: true,
        fullName: true,
        primaryRole: true,
        defaultCommissionPercent: true,
      },
    }),
  ]);

  const mappedProjects = projects.map(mapProject);

  return {
    year,
    summary: {
      projectCount: mappedProjects.length,
      municipalitiesCount: new Set(mappedProjects.map((item) => `${item.municipalityName}-${item.state}`)).size,
      collaboratorsCount: new Set(mappedProjects.map((item) => item.collaboratorName)).size,
      projectedAnnualRevenue: mappedProjects.reduce((sum, item) => sum + item.projectedAnnualRevenue, 0),
      projectedAnnualProfit: mappedProjects.reduce((sum, item) => sum + item.projectedAnnualProfit, 0),
      projectedCommissionAmount: mappedProjects.reduce((sum, item) => sum + item.projectedCommissionAmount, 0),
    },
    municipalities: municipalities.map((item) => ({
      id: item.id,
      label: `${item.municipalityName}/${item.state}`,
      helper: item.currentStage.replaceAll("_", " "),
    })),
    collaborators: collaborators.map((item) => ({
      id: item.id,
      label: item.fullName,
      helper: `${item.primaryRole} · ${toNumber(item.defaultCommissionPercent).toFixed(2)}% padrao`,
    })),
    projects: mappedProjects,
  };
}

export async function createFundebConsultingProject(
  groupId: string,
  actorUserId: string,
  input: {
    municipalityAccountId: string;
    collaboratorId: string;
    serviceLabel: string;
    baseYear: number;
    commissionBase: "profit" | "revenue";
    commissionPercent: number;
    projectedMonthlyRevenue: number;
    projectedMonthlyCost: number;
    projectedMonths: number;
    expectedStartDate?: string;
    sourceLabel?: string;
    projectionNotes?: string;
  },
) {
  const [municipality, collaborator] = await Promise.all([
    prisma.municipalityAccount.findFirst({
      where: { id: input.municipalityAccountId, groupId },
      select: { id: true },
    }),
    prisma.collaborator.findFirst({
      where: { id: input.collaboratorId, groupId },
      select: { id: true },
    }),
  ]);

  if (!municipality) {
    throw new Error("Municipio nao encontrado para o workspace atual.");
  }

  if (!collaborator) {
    throw new Error("Colaborador nao encontrado para o workspace atual.");
  }

  const monthlyRevenue = input.projectedMonthlyRevenue;
  const monthlyCost = input.projectedMonthlyCost;
  const monthlyProfit = Math.max(0, monthlyRevenue - monthlyCost);
  const annualRevenue = monthlyRevenue * input.projectedMonths;
  const annualProfit = monthlyProfit * input.projectedMonths;
  const commissionBaseAmount = input.commissionBase === "revenue" ? annualRevenue : annualProfit;
  const projectedCommissionAmount = commissionBaseAmount * (input.commissionPercent / 100);

  const project = await prisma.fundebConsultingProject.create({
    data: {
      groupId,
      municipalityAccountId: municipality.id,
      collaboratorId: collaborator.id,
      serviceLabel: input.serviceLabel.trim(),
      baseYear: input.baseYear,
      commissionBase: input.commissionBase,
      commissionPercent: input.commissionPercent,
      projectedMonthlyRevenue: monthlyRevenue,
      projectedMonthlyCost: monthlyCost,
      projectedMonthlyProfit: monthlyProfit,
      projectedMonths: input.projectedMonths,
      projectedAnnualRevenue: annualRevenue,
      projectedAnnualProfit: annualProfit,
      projectedCommissionAmount,
      expectedStartDate: input.expectedStartDate ? new Date(`${input.expectedStartDate}T00:00:00.000Z`) : undefined,
      sourceLabel: optionalString(input.sourceLabel),
      projectionNotes: optionalString(input.projectionNotes),
      status: "draft",
      createdByUserId: actorUserId,
    },
    include: {
      municipalityAccount: true,
      collaborator: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "fundeb-consulting-project.created",
      userId: actorUserId,
      targetId: project.id,
      metadata: {
        baseYear: project.baseYear,
        municipalityAccountId: project.municipalityAccountId,
        collaboratorId: project.collaboratorId,
      },
    },
  });

  return mapProject(project);
}
