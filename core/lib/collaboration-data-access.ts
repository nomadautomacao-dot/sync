import { prisma } from "@/core/lib/prisma";
import type {
  CollaboratorDashboardData,
  CollaboratorDashboardCity,
  CollaboratorListItem,
  ExecutiveDashboardData,
} from "@/core/domain/collaboration";

function optionalString(value?: string | null) {
  const clean = value?.trim();
  return clean ? clean : undefined;
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIsoDate(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : undefined;
}

function stageProbability(stage: string) {
  const table: Record<string, number> = {
    mapping: 0.05,
    first_contact: 0.1,
    institutional_validation: 0.2,
    technical_diagnosis: 0.35,
    proposal_presented: 0.5,
    negotiation: 0.65,
    verbally_approved: 0.8,
    contractual: 0.9,
    implementation: 0.95,
    assisted_operation: 0.98,
    fidelized: 1,
    paused: 0,
    lost: 0,
  };
  return table[stage] ?? 0;
}

function nextYearWeightedProfit(
  municipality: {
    currentStage: string;
    estimatedAnnualProfit: unknown;
    forecastProbability: unknown;
    expectedStartDate?: Date | null;
    forecasts?: Array<{ weightedProfit: unknown }>;
  },
  nextYear: number,
) {
  const forecastSum = municipality.forecasts?.reduce((sum, item) => sum + toNumber(item.weightedProfit), 0) ?? 0;
  if (forecastSum > 0) return forecastSum;

  const fullProfit = toNumber(municipality.estimatedAnnualProfit);
  const probability = toNumber(municipality.forecastProbability) || stageProbability(municipality.currentStage);
  const startYear = municipality.expectedStartDate?.getUTCFullYear();
  const startMonth = municipality.expectedStartDate?.getUTCMonth() ?? 0;

  let timingFactor = 1;
  if (startYear === nextYear) timingFactor = Math.max(0.1, (12 - startMonth) / 12);
  if (startYear && startYear > nextYear) timingFactor = 0;

  return fullProfit * probability * timingFactor;
}

function mapCollaboratorListItem(
  collaborator: {
    id: string;
    fullName: string;
    shortName: string | null;
    state: string | null;
    collaboratorType: string;
    primaryRole: string;
    partnershipStatus: string;
    defaultCommissionPercent: unknown;
    lastActivityDate: Date | null;
    createdAt: Date;
    participations: Array<{
      municipalityAccount: {
        id: string;
        currentStage: string;
        estimatedAnnualProfit: unknown;
        forecastProbability: unknown;
        expectedStartDate: Date | null;
        forecasts: Array<{ weightedProfit: unknown }>;
        profitSnapshots: Array<{ profitBase: unknown }>;
      };
    }>;
    commissionAccruals: Array<{ accruedAmount: unknown }>;
  },
  nextYear: number,
): CollaboratorListItem {
  const uniqueMunicipalities = new Map<string, typeof collaborator.participations[number]["municipalityAccount"]>();
  collaborator.participations.forEach((participation) => {
    uniqueMunicipalities.set(participation.municipalityAccount.id, participation.municipalityAccount);
  });

  const municipalities = [...uniqueMunicipalities.values()];
  const profitYtd = municipalities.reduce(
    (sum, municipality) =>
      sum + municipality.profitSnapshots.reduce((inner, snapshot) => inner + toNumber(snapshot.profitBase), 0),
    0,
  );
  const nextYearForecast = municipalities.reduce(
    (sum, municipality) => sum + nextYearWeightedProfit(municipality, nextYear),
    0,
  );

  return {
    id: collaborator.id,
    fullName: collaborator.fullName,
    shortName: optionalString(collaborator.shortName),
    state: optionalString(collaborator.state),
    collaboratorType: collaborator.collaboratorType as CollaboratorListItem["collaboratorType"],
    primaryRole: collaborator.primaryRole,
    partnershipStatus: collaborator.partnershipStatus as CollaboratorListItem["partnershipStatus"],
    defaultCommissionPercent: toNumber(collaborator.defaultCommissionPercent),
    lastActivityDate: toIsoDate(collaborator.lastActivityDate),
    createdAt: collaborator.createdAt.toISOString(),
    metrics: {
      municipalitiesCount: municipalities.length,
      fidelizedCount: municipalities.filter((item) => item.currentStage === "fidelized").length,
      profitYtd,
      commissionForecastYtd: collaborator.commissionAccruals.reduce((sum, item) => sum + toNumber(item.accruedAmount), 0),
      nextYearForecast,
    },
  };
}

export async function listCollaborators(groupId: string, filters?: { search?: string; status?: string; type?: string; year?: number }) {
  const year = filters?.year ?? new Date().getUTCFullYear();
  const nextYear = year + 1;

  const collaborators = await prisma.collaborator.findMany({
    where: {
      groupId,
      ...(filters?.status ? { partnershipStatus: filters.status as never } : {}),
      ...(filters?.type ? { collaboratorType: filters.type as never } : {}),
      ...(filters?.search
        ? {
            OR: [
              { fullName: { contains: filters.search, mode: "insensitive" } },
              { shortName: { contains: filters.search, mode: "insensitive" } },
              { email: { contains: filters.search, mode: "insensitive" } },
              { primaryRole: { contains: filters.search, mode: "insensitive" } },
              { state: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      participations: {
        include: {
          municipalityAccount: {
            include: {
              forecasts: { where: { year: nextYear } },
              profitSnapshots: { where: { year } },
            },
          },
        },
      },
      commissionAccruals: { where: { year } },
    },
    orderBy: { fullName: "asc" },
  });

  return collaborators.map((item) => mapCollaboratorListItem(item, nextYear));
}

export async function createCollaborator(
  groupId: string,
  actorUserId: string,
  input: {
    fullName: string;
    shortName?: string;
    email?: string;
    phone?: string;
    whatsapp?: string;
    city?: string;
    state?: string;
    companyOrOrganization?: string;
    title?: string;
    collaboratorType: string;
    primaryRole: string;
    partnershipStatus: string;
    source?: string;
    referredBy?: string;
    primaryState?: string;
    primaryRegion?: string;
    defaultCommissionPercent: number;
    defaultProfitBaseType: string;
    defaultTriggerType: string;
    payoutCycle: string;
    payoutMethod: string;
    onboardingDate?: string;
    notes?: string;
  },
) {
  const collaborator = await prisma.collaborator.create({
    data: {
      groupId,
      fullName: input.fullName.trim(),
      shortName: optionalString(input.shortName),
      email: optionalString(input.email)?.toLowerCase(),
      phone: optionalString(input.phone),
      whatsapp: optionalString(input.whatsapp),
      city: optionalString(input.city),
      state: optionalString(input.state)?.toUpperCase(),
      companyOrOrganization: optionalString(input.companyOrOrganization),
      title: optionalString(input.title),
      collaboratorType: input.collaboratorType as never,
      primaryRole: input.primaryRole.trim(),
      partnershipStatus: input.partnershipStatus as never,
      source: optionalString(input.source),
      referredBy: optionalString(input.referredBy),
      primaryState: optionalString(input.primaryState)?.toUpperCase(),
      primaryRegion: optionalString(input.primaryRegion),
      defaultCommissionPercent: input.defaultCommissionPercent,
      defaultProfitBaseType: input.defaultProfitBaseType as never,
      defaultTriggerType: input.defaultTriggerType as never,
      payoutCycle: input.payoutCycle,
      payoutMethod: input.payoutMethod,
      onboardingDate: input.onboardingDate ? new Date(`${input.onboardingDate}T00:00:00.000Z`) : undefined,
      notes: optionalString(input.notes),
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "collaborator.created",
      userId: actorUserId,
      targetId: collaborator.id,
      metadata: { fullName: collaborator.fullName, collaboratorType: collaborator.collaboratorType },
    },
  });

  return collaborator;
}

export async function listMunicipalities(groupId: string, filters?: { search?: string; stage?: string }) {
  return prisma.municipalityAccount.findMany({
    where: {
      groupId,
      ...(filters?.stage ? { currentStage: filters.stage as never } : {}),
      ...(filters?.search
        ? {
            OR: [
              { municipalityName: { contains: filters.search, mode: "insensitive" } },
              { state: { contains: filters.search, mode: "insensitive" } },
              { mayorName: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ state: "asc" }, { municipalityName: "asc" }],
  });
}

export async function createMunicipality(
  groupId: string,
  actorUserId: string,
  input: {
    municipalityName: string;
    state: string;
    ibgeCode?: string;
    currentStage: string;
    sourceType?: string;
    sourceDescription?: string;
    mayorName?: string;
    educationSecretaryName?: string;
    procurementLeadName?: string;
    estimatedAnnualRevenue?: number;
    estimatedAnnualCost?: number;
    expectedStartDate?: string;
    expectedFidelizationDate?: string;
    forecastProbability?: number;
  },
) {
  const estimatedAnnualRevenue = input.estimatedAnnualRevenue ?? 0;
  const estimatedAnnualCost = input.estimatedAnnualCost ?? 0;

  const municipality = await prisma.municipalityAccount.create({
    data: {
      groupId,
      municipalityName: input.municipalityName.trim(),
      state: input.state.trim().toUpperCase(),
      ibgeCode: optionalString(input.ibgeCode),
      currentStage: input.currentStage as never,
      sourceType: optionalString(input.sourceType),
      sourceDescription: optionalString(input.sourceDescription),
      mayorName: optionalString(input.mayorName),
      educationSecretaryName: optionalString(input.educationSecretaryName),
      procurementLeadName: optionalString(input.procurementLeadName),
      estimatedAnnualRevenue,
      estimatedAnnualCost,
      estimatedAnnualProfit: estimatedAnnualRevenue - estimatedAnnualCost,
      expectedStartDate: input.expectedStartDate ? new Date(`${input.expectedStartDate}T00:00:00.000Z`) : undefined,
      expectedFidelizationDate: input.expectedFidelizationDate ? new Date(`${input.expectedFidelizationDate}T00:00:00.000Z`) : undefined,
      forecastProbability: input.forecastProbability,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "municipality.created",
      userId: actorUserId,
      targetId: municipality.id,
      metadata: { municipalityName: municipality.municipalityName, state: municipality.state },
    },
  });

  return municipality;
}

export async function getCollaboratorDashboard(groupId: string, collaboratorId: string, year: number): Promise<CollaboratorDashboardData | null> {
  const nextYear = year + 1;
  const collaborator = await prisma.collaborator.findFirst({
    where: { id: collaboratorId, groupId },
    include: {
      participations: {
        include: {
          municipalityAccount: {
            include: {
              ownerUser: true,
              forecasts: { where: { year: nextYear } },
              profitSnapshots: { where: { year } },
              opportunities: { orderBy: { updatedAt: "desc" }, take: 1 },
              implementations: { orderBy: { updatedAt: "desc" }, take: 1 },
            },
          },
        },
      },
      commissionAccruals: { where: { year } },
      commissionPayouts: {
        where: {
          OR: [
            { periodStart: { gte: new Date(Date.UTC(year, 0, 1)) } },
            { periodEnd: { gte: new Date(Date.UTC(year, 0, 1)) } },
          ],
        },
      },
    },
  });

  if (!collaborator) return null;

  const listItem = mapCollaboratorListItem(collaborator, nextYear);
  const cities = collaborator.participations.map((participation): CollaboratorDashboardCity => {
    const account = participation.municipalityAccount;
    const latestOpportunity = account.opportunities[0];
    const implementation = account.implementations[0];
    const estimatedAnnualProfit = toNumber(account.estimatedAnnualProfit);
    const agreedPercent = toNumber(participation.agreedCommissionPercent) || toNumber(collaborator.defaultCommissionPercent);

    return {
      id: account.id,
      municipalityName: account.municipalityName,
      state: account.state,
      stage: account.currentStage as CollaboratorDashboardCity["stage"],
      probability: toNumber(account.forecastProbability) || stageProbability(account.currentStage),
      estimatedAnnualRevenue: toNumber(account.estimatedAnnualRevenue),
      estimatedAnnualProfit,
      agreedCommissionPercent: agreedPercent,
      commissionForecast: estimatedAnnualProfit * (agreedPercent / 100),
      ownerName: account.ownerUser?.name ?? undefined,
      nextStep: latestOpportunity?.nextStep ?? undefined,
      fidelityStatus: implementation?.fidelityStatus ?? undefined,
    };
  });

  const monthlyTrend = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const snapshots = collaborator.participations.flatMap((item) => item.municipalityAccount.profitSnapshots.filter((snapshot) => snapshot.month === month));
    const accruals = collaborator.commissionAccruals.filter((item) => item.month === month);
    return {
      month,
      profit: snapshots.reduce((sum, item) => sum + toNumber(item.profitBase), 0),
      commissionForecast: accruals.reduce((sum, item) => sum + toNumber(item.accruedAmount), 0),
      commissionPaid: accruals.filter((item) => item.status === "paid").reduce((sum, item) => sum + toNumber(item.accruedAmount), 0),
    };
  });

  const associatedCities = cities.length;
  const sourcedCities = collaborator.participations.filter((item) => item.isPrimarySource).length;
  const fidelizedCities = cities.filter((item) => item.stage === "fidelized").length;
  const commissionPaidYtd = collaborator.commissionPayouts.reduce((sum, item) => sum + toNumber(item.totalPaid), 0);
  const alerts = cities.flatMap((municipality) => {
    const items: string[] = [];
    if (!municipality.nextStep && municipality.stage !== "fidelized" && municipality.stage !== "lost") {
      items.push(`${municipality.municipalityName}/${municipality.state} esta sem proximo passo definido.`);
    }
    if (municipality.stage === "implementation" && municipality.fidelityStatus !== "approved") {
      items.push(`${municipality.municipalityName}/${municipality.state} esta em implantacao e ainda nao fidelizou.`);
    }
    return items;
  });

  return {
    collaborator: {
      ...listItem,
      email: optionalString(collaborator.email),
      phone: optionalString(collaborator.phone),
      whatsapp: optionalString(collaborator.whatsapp),
      companyOrOrganization: optionalString(collaborator.companyOrOrganization),
      payoutCycle: optionalString(collaborator.payoutCycle),
      payoutMethod: optionalString(collaborator.payoutMethod),
      notes: optionalString(collaborator.notes),
    },
    kpis: {
      associatedCities,
      sourcedCities,
      fidelizedCities,
      conversionRate: associatedCities > 0 ? fidelizedCities / associatedCities : 0,
      profitYtd: listItem.metrics.profitYtd,
      commissionForecastYtd: listItem.metrics.commissionForecastYtd,
      commissionPaidYtd,
      nextYearForecast: listItem.metrics.nextYearForecast,
    },
    monthlyTrend,
    cities,
    alerts: [...new Set(alerts)],
  };
}

export async function getExecutiveDashboard(groupId: string, year: number): Promise<ExecutiveDashboardData> {
  const nextYear = year + 1;
  const [municipalities, collaborators, accruals] = await Promise.all([
    prisma.municipalityAccount.findMany({
      where: { groupId },
      include: {
        ownerUser: true,
        participations: { include: { collaborator: true } },
        opportunities: true,
        implementations: true,
        profitSnapshots: { where: { year } },
        forecasts: { where: { year: nextYear } },
      },
      orderBy: [{ state: "asc" }, { municipalityName: "asc" }],
    }),
    prisma.collaborator.findMany({
      where: { groupId, partnershipStatus: "active" },
      include: {
        participations: {
          include: {
            municipalityAccount: {
              include: {
                forecasts: { where: { year: nextYear } },
                profitSnapshots: { where: { year } },
              },
            },
          },
        },
      },
    }),
    prisma.commissionAccrual.findMany({
      where: {
        year,
        collaborator: { groupId },
      },
    }),
  ]);

  const grossRevenueYtd = municipalities.reduce((sum, municipality) => sum + municipality.profitSnapshots.reduce((inner, snap) => inner + toNumber(snap.recognizedRevenue), 0), 0);
  const profitBaseYtd = municipalities.reduce((sum, municipality) => sum + municipality.profitSnapshots.reduce((inner, snap) => inner + toNumber(snap.profitBase), 0), 0);
  const commissionForecastYtd = accruals.reduce((sum, item) => sum + toNumber(item.accruedAmount), 0);
  const citiesActive = municipalities.filter((item) => item.currentStage === "assisted_operation" || item.currentStage === "fidelized").length;
  const citiesInImplementation = municipalities.filter((item) => item.currentStage === "implementation").length;
  const citiesFidelized = municipalities.filter((item) => item.currentStage === "fidelized").length;
  const resultCollaborators = collaborators.filter((item) => item.participations.length > 0).length;
  const nextYearForecast = municipalities.reduce((sum, item) => sum + nextYearWeightedProfit(item, nextYear), 0);

  const monthlyTrend = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const monthSnapshots = municipalities.flatMap((item) => item.profitSnapshots.filter((snapshot) => snapshot.month === month));
    const monthAccruals = accruals.filter((item) => item.month === month);
    return {
      month,
      revenue: monthSnapshots.reduce((sum, item) => sum + toNumber(item.recognizedRevenue), 0),
      profit: monthSnapshots.reduce((sum, item) => sum + toNumber(item.profitBase), 0),
      commission: monthAccruals.reduce((sum, item) => sum + toNumber(item.accruedAmount), 0),
    };
  });

  const pipelineStages = [
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
  ];

  const pipelineByStage = pipelineStages.map((stage) => {
    const inStage = municipalities.filter((item) => item.currentStage === stage);
    return {
      stage,
      count: inStage.length,
      weightedProfit: inStage.reduce((sum, municipality) => sum + toNumber(municipality.estimatedAnnualProfit) * (toNumber(municipality.forecastProbability) || stageProbability(municipality.currentStage)), 0),
    };
  });

  const topCollaborators = collaborators
    .map((item) => ({ ...mapCollaboratorListItem({ ...item, commissionAccruals: [] }, nextYear) }))
    .sort((a, b) => b.metrics.profitYtd - a.metrics.profitYtd)
    .slice(0, 8)
    .map((item) => ({
      id: item.id,
      fullName: item.fullName,
      cities: item.metrics.municipalitiesCount,
      fidelizedCities: item.metrics.fidelizedCount,
      profitYtd: item.metrics.profitYtd,
      nextYearForecast: item.metrics.nextYearForecast,
    }));

  const alerts = municipalities.flatMap((municipality) => {
    const items: string[] = [];
    const latestOpportunity = [...municipality.opportunities].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
    if (!municipality.ownerUserId) {
      items.push(`${municipality.municipalityName}/${municipality.state} esta sem owner interno.`);
    }
    if (latestOpportunity && !latestOpportunity.nextStep && municipality.currentStage !== "fidelized" && municipality.currentStage !== "lost") {
      items.push(`${municipality.municipalityName}/${municipality.state} esta sem proximo passo definido.`);
    }
    if (municipality.currentStage === "implementation") {
      const implementation = municipality.implementations[0];
      if (!implementation?.expectedGoLiveDate) {
        items.push(`${municipality.municipalityName}/${municipality.state} esta em implantacao sem data de go-live.`);
      }
    }
    return items;
  });

  return {
    year,
    kpis: {
      citiesWorked: municipalities.length,
      citiesActive,
      citiesInImplementation,
      citiesFidelized,
      activeCollaborators: collaborators.length,
      resultCollaborators,
      grossRevenueYtd,
      profitBaseYtd,
      averageProfitPerCity: citiesActive > 0 ? profitBaseYtd / citiesActive : 0,
      commissionForecastYtd,
      nextYearForecast,
    },
    monthlyTrend,
    pipelineByStage,
    topCollaborators,
    municipalities: municipalities.slice(0, 12).map((municipality) => ({
      id: municipality.id,
      municipalityName: municipality.municipalityName,
      state: municipality.state,
      stage: municipality.currentStage,
      estimatedAnnualRevenue: toNumber(municipality.estimatedAnnualRevenue),
      estimatedAnnualProfit: toNumber(municipality.estimatedAnnualProfit),
      probability: toNumber(municipality.forecastProbability) || stageProbability(municipality.currentStage),
      collaboratorName: municipality.participations.find((item) => item.isPrimarySource)?.collaborator.fullName,
    })),
    alerts: [...new Set(alerts)].slice(0, 8),
  };
}
