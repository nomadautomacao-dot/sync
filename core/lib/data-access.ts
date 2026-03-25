import { PrismaClient } from "@prisma/client";
import {
  companySegmentSchema,
  companySizeSchema,
  companyStatusSchema,
  employeeStatusSchema,
  taxRegimeSchema,
  type AuditLogEntry,
  type Company,
  type Employee,
} from "@/core/domain/organization";
import { moduleKeySchema } from "@/core/domain/module";

const DEFAULT_GROUP_SLUG = process.env.SYNC_GROUP_SLUG?.trim() || "sync-default";
const DEFAULT_GROUP_NAME = process.env.SYNC_GROUP_NAME?.trim() || "Sync Holdings";
const DEFAULT_ADMIN_EMAIL = process.env.SYNC_ADMIN_EMAIL?.trim() || "admin@sync.local";
const DEFAULT_ADMIN_NAME = process.env.SYNC_ADMIN_NAME?.trim() || "Admin Sync";

const globalStore = globalThis as typeof globalThis & {
  __syncPrisma?: PrismaClient;
};

function getPrisma() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error(
      "DATABASE_URL nao configurado. Defina .env.local e rode `npm run supabase:bootstrap`.",
    );
  }

  if (!globalStore.__syncPrisma) {
    globalStore.__syncPrisma = new PrismaClient({
      log: ["error"],
    });
  }

  return globalStore.__syncPrisma;
}

function toCompany(company: {
  id: string;
  groupId: string;
  name: string;
  tradingName: string;
  cnpj: string;
  stateRegistration: string | null;
  cityRegistration: string | null;
  foundedAt: Date | null;
  logo: string | null;
  color: string | null;
  zipCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  phoneSecondary: string | null;
  email: string | null;
  website: string | null;
  contactName: string | null;
  contactPosition: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  segment: string;
  description: string | null;
  size: string | null;
  taxRegime: string | null;
  status: string;
  enabledModules: string[];
  createdAt: Date;
  updatedAt: Date;
}): Company {
  return {
    id: company.id,
    groupId: company.groupId,
    name: company.name,
    tradingName: company.tradingName,
    cnpj: company.cnpj,
    stateRegistration: company.stateRegistration ?? undefined,
    cityRegistration: company.cityRegistration ?? undefined,
    foundedAt: company.foundedAt ? company.foundedAt.toISOString().slice(0, 10) : undefined,
    logo: company.logo ?? undefined,
    color: company.color ?? undefined,
    zipCode: company.zipCode ?? "",
    street: company.street ?? "",
    number: company.number ?? "",
    complement: company.complement ?? undefined,
    neighborhood: company.neighborhood ?? "",
    city: company.city ?? "",
    state: company.state ?? "",
    phone: company.phone ?? "",
    phoneSecondary: company.phoneSecondary ?? undefined,
    email: company.email ?? "",
    website: company.website ?? undefined,
    contactName: company.contactName ?? "",
    contactPosition: company.contactPosition ?? "",
    contactEmail: company.contactEmail ?? "",
    contactPhone: company.contactPhone ?? undefined,
    segment: parseCompanySegment(company.segment),
    description: company.description ?? undefined,
    size: parseCompanySize(company.size),
    taxRegime: parseTaxRegime(company.taxRegime),
    status: parseCompanyStatus(company.status),
    enabledModules: parseEnabledModules(company.enabledModules),
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
  };
}

function toEmployee(employee: {
  id: string;
  userId: string;
  companyId: string;
  name: string;
  email: string;
  position: string;
  role: string;
  status: string;
  hireDate: Date;
  createdAt: Date;
}): Employee {
  return {
    id: employee.id,
    userId: employee.userId,
    companyId: employee.companyId,
    name: employee.name,
    email: employee.email,
    position: employee.position,
    role: employee.role,
    status: parseEmployeeStatus(employee.status),
    hireDate: employee.hireDate.toISOString().slice(0, 10),
    createdAt: employee.createdAt.toISOString(),
  };
}

function toAuditEntry(entry: {
  id: string;
  action: string;
  userId: string;
  companyId: string | null;
  targetId: string | null;
  metadata: unknown | null;
  createdAt: Date;
}): AuditLogEntry {
  const metadata =
    entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata)
      ? (entry.metadata as Record<string, unknown>)
      : undefined;

  return {
    id: entry.id,
    action: entry.action,
    userId: entry.userId,
    companyId: entry.companyId ?? undefined,
    targetId: entry.targetId ?? undefined,
    metadata,
    createdAt: entry.createdAt.toISOString(),
  };
}

async function ensureWorkspaceContext(prisma: PrismaClient) {
  const group = await prisma.group.upsert({
    where: { slug: DEFAULT_GROUP_SLUG },
    update: {},
    create: {
      name: DEFAULT_GROUP_NAME,
      slug: DEFAULT_GROUP_SLUG,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: DEFAULT_ADMIN_EMAIL },
    update: {
      name: DEFAULT_ADMIN_NAME,
      groupId: group.id,
      groupRole: "owner",
    },
    create: {
      email: DEFAULT_ADMIN_EMAIL,
      name: DEFAULT_ADMIN_NAME,
      groupId: group.id,
      groupRole: "owner",
    },
  });

  return { group, user };
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

function optionalString(value?: string) {
  const clean = value?.trim();
  return clean ? clean : undefined;
}

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

function optionalDate(value?: string) {
  if (!value) {
    return undefined;
  }
  return new Date(`${value}T00:00:00.000Z`);
}

function parseCompanySegment(value: string): Company["segment"] {
  const parsed = companySegmentSchema.safeParse(value);
  return parsed.success ? parsed.data : "outro";
}

function parseCompanySize(value: string | null): Company["size"] {
  if (!value) {
    return undefined;
  }
  const parsed = companySizeSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function parseTaxRegime(value: string | null): Company["taxRegime"] {
  if (!value) {
    return undefined;
  }
  const parsed = taxRegimeSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function parseCompanyStatus(value: string): Company["status"] {
  const parsed = companyStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : "active";
}

function parseEmployeeStatus(value: string): Employee["status"] {
  const parsed = employeeStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : "active";
}

function parseEnabledModules(value: string[]): Company["enabledModules"] {
  return value.filter((moduleKey): moduleKey is Company["enabledModules"][number] =>
    moduleKeySchema.safeParse(moduleKey).success,
  );
}

export async function listCompanies(params?: { search?: string; status?: string }) {
  const prisma = getPrisma();
  const { group } = await ensureWorkspaceContext(prisma);

  const companies = await prisma.company.findMany({
    where: {
      groupId: group.id,
      ...(params?.status ? { status: params.status } : {}),
      ...(params?.search
        ? {
            OR: [
              { name: { contains: params.search, mode: "insensitive" } },
              { tradingName: { contains: params.search, mode: "insensitive" } },
              { cnpj: { contains: params.search } },
              { segment: { contains: params.search, mode: "insensitive" } },
              { email: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { tradingName: "asc" },
  });

  return companies.map(toCompany);
}

export async function getCompanyById(companyId: string) {
  const prisma = getPrisma();
  const { group } = await ensureWorkspaceContext(prisma);
  const company = await prisma.company.findFirst({
    where: {
      id: companyId,
      groupId: group.id,
    },
  });

  return company ? toCompany(company) : undefined;
}

export async function createCompany(input: {
  name: string;
  tradingName: string;
  cnpj: string;
  stateRegistration?: string;
  cityRegistration?: string;
  foundedAt?: string;
  logo?: string;
  color?: string;
  zipCode: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  phone: string;
  phoneSecondary?: string;
  email: string;
  website?: string;
  contactName: string;
  contactPosition: string;
  contactEmail: string;
  contactPhone?: string;
  segment: string;
  description?: string;
  size?: string;
  taxRegime?: string;
  status?: string;
  enabledModules?: string[];
}, actorUserId: string) {
  const prisma = getPrisma();
  const { group } = await ensureWorkspaceContext(prisma);

  try {
    const company = await prisma.company.create({
      data: {
        groupId: group.id,
        name: input.name.trim(),
        tradingName: input.tradingName.trim(),
        cnpj: normalizeDigits(input.cnpj),
        stateRegistration: optionalString(input.stateRegistration),
        cityRegistration: optionalString(input.cityRegistration),
        foundedAt: optionalDate(input.foundedAt),
        logo: optionalString(input.logo),
        color: optionalString(input.color),
        zipCode: optionalString(input.zipCode),
        street: optionalString(input.street),
        number: optionalString(input.number),
        complement: optionalString(input.complement),
        neighborhood: optionalString(input.neighborhood),
        city: optionalString(input.city),
        state: optionalString(input.state)?.toUpperCase(),
        phone: optionalString(input.phone),
        phoneSecondary: optionalString(input.phoneSecondary),
        email: optionalString(input.email)?.toLowerCase(),
        website: optionalString(input.website),
        contactName: optionalString(input.contactName),
        contactPosition: optionalString(input.contactPosition),
        contactEmail: optionalString(input.contactEmail)?.toLowerCase(),
        contactPhone: optionalString(input.contactPhone),
        segment: input.segment,
        description: optionalString(input.description),
        size: optionalString(input.size),
        taxRegime: optionalString(input.taxRegime),
        status: input.status ?? "active",
        enabledModules: input.enabledModules ?? [],
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "company.created",
        userId: actorUserId,
        companyId: company.id,
        targetId: company.id,
        metadata: { tradingName: company.tradingName },
      },
    });

    return { data: toCompany(company) };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        error: {
          formErrors: ["CNPJ ja cadastrado"],
          fieldErrors: { cnpj: ["CNPJ ja cadastrado"] },
        },
      };
    }
    throw error;
  }
}

export async function updateCompany(
  companyId: string,
  input: Partial<{
    name: string;
    tradingName: string;
    cnpj: string;
    stateRegistration: string;
    cityRegistration: string;
    foundedAt: string;
    logo: string;
    color: string;
    zipCode: string;
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
    phone: string;
    phoneSecondary: string;
    email: string;
    website: string;
    contactName: string;
    contactPosition: string;
    contactEmail: string;
    contactPhone: string;
    segment: string;
    description: string;
    size: string;
    taxRegime: string;
    status: string;
    enabledModules: string[];
  }>,
  actorUserId: string,
) {
  const prisma = getPrisma();
  const { group } = await ensureWorkspaceContext(prisma);
  const existing = await prisma.company.findFirst({
    where: {
      id: companyId,
      groupId: group.id,
    },
  });

  if (!existing) {
    return { error: { formErrors: ["Empresa nao encontrada"] } };
  }

  try {
    const updateData: Record<string, unknown> = {};

    if (input.name !== undefined) updateData.name = input.name.trim();
    if (input.tradingName !== undefined) updateData.tradingName = input.tradingName.trim();
    if (input.cnpj !== undefined) updateData.cnpj = normalizeDigits(input.cnpj);
    if (input.stateRegistration !== undefined)
      updateData.stateRegistration = optionalString(input.stateRegistration);
    if (input.cityRegistration !== undefined)
      updateData.cityRegistration = optionalString(input.cityRegistration);
    if (input.foundedAt !== undefined) updateData.foundedAt = optionalDate(input.foundedAt);
    if (input.logo !== undefined) updateData.logo = optionalString(input.logo);
    if (input.color !== undefined) updateData.color = optionalString(input.color);
    if (input.zipCode !== undefined) updateData.zipCode = optionalString(input.zipCode);
    if (input.street !== undefined) updateData.street = optionalString(input.street);
    if (input.number !== undefined) updateData.number = optionalString(input.number);
    if (input.complement !== undefined) updateData.complement = optionalString(input.complement);
    if (input.neighborhood !== undefined)
      updateData.neighborhood = optionalString(input.neighborhood);
    if (input.city !== undefined) updateData.city = optionalString(input.city);
    if (input.state !== undefined) updateData.state = optionalString(input.state)?.toUpperCase();
    if (input.phone !== undefined) updateData.phone = optionalString(input.phone);
    if (input.phoneSecondary !== undefined)
      updateData.phoneSecondary = optionalString(input.phoneSecondary);
    if (input.email !== undefined) updateData.email = optionalString(input.email)?.toLowerCase();
    if (input.website !== undefined) updateData.website = optionalString(input.website);
    if (input.contactName !== undefined) updateData.contactName = optionalString(input.contactName);
    if (input.contactPosition !== undefined)
      updateData.contactPosition = optionalString(input.contactPosition);
    if (input.contactEmail !== undefined)
      updateData.contactEmail = optionalString(input.contactEmail)?.toLowerCase();
    if (input.contactPhone !== undefined)
      updateData.contactPhone = optionalString(input.contactPhone);
    if (input.segment !== undefined) updateData.segment = input.segment;
    if (input.description !== undefined) updateData.description = optionalString(input.description);
    if (input.size !== undefined) updateData.size = optionalString(input.size);
    if (input.taxRegime !== undefined) updateData.taxRegime = optionalString(input.taxRegime);
    if (input.status !== undefined) updateData.status = input.status;
    if (input.enabledModules !== undefined) updateData.enabledModules = input.enabledModules;

    const company = await prisma.company.update({
      where: { id: existing.id },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        action: "company.updated",
        userId: actorUserId,
        companyId: company.id,
        targetId: company.id,
        metadata: { enabledModules: company.enabledModules },
      },
    });

    return { data: toCompany(company) };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        error: {
          formErrors: ["CNPJ ja cadastrado"],
          fieldErrors: { cnpj: ["CNPJ ja cadastrado"] },
        },
      };
    }
    throw error;
  }
}

export async function deleteCompany(companyId: string, actorUserId: string) {
  const prisma = getPrisma();
  const { group } = await ensureWorkspaceContext(prisma);
  const existing = await prisma.company.findFirst({
    where: {
      id: companyId,
      groupId: group.id,
    },
  });

  if (!existing) {
    return false;
  }

  await prisma.company.delete({
    where: { id: existing.id },
  });

  await prisma.auditLog.create({
    data: {
      action: "company.deleted",
      userId: actorUserId,
      companyId,
      targetId: companyId,
    },
  });

  return true;
}

export async function listEmployees(params?: { companyId?: string; search?: string }) {
  const prisma = getPrisma();
  const { group } = await ensureWorkspaceContext(prisma);

  const employees = await prisma.employee.findMany({
    where: {
      company: {
        groupId: group.id,
      },
      ...(params?.companyId ? { companyId: params.companyId } : {}),
      ...(params?.search
        ? {
            OR: [
              { name: { contains: params.search, mode: "insensitive" } },
              { email: { contains: params.search, mode: "insensitive" } },
              { position: { contains: params.search, mode: "insensitive" } },
              { role: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
  });

  return employees.map(toEmployee);
}

export async function createEmployee(input: {
  companyId: string;
  name: string;
  email: string;
  position: string;
  role: string;
  status?: string;
  hireDate: string;
}, actorUserId: string) {
  const prisma = getPrisma();
  const { group } = await ensureWorkspaceContext(prisma);

  const company = await prisma.company.findFirst({
    where: {
      id: input.companyId,
      groupId: group.id,
    },
  });

  if (!company) {
    return {
      error: {
        formErrors: ["Empresa nao encontrada"],
        fieldErrors: { companyId: ["Empresa nao encontrada"] },
      },
    };
  }

  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: {
      name: input.name,
      groupId: group.id,
    },
    create: {
      email: input.email,
      name: input.name,
      groupId: group.id,
      groupRole: "member",
    },
  });

  try {
    const employee = await prisma.employee.create({
      data: {
        userId: user.id,
        companyId: company.id,
        name: input.name,
        email: input.email,
        position: input.position,
        role: input.role,
        status: input.status ?? "active",
        hireDate: new Date(`${input.hireDate}T00:00:00.000Z`),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "employee.created",
        userId: actorUserId,
        companyId: employee.companyId,
        targetId: employee.id,
        metadata: { name: employee.name },
      },
    });

    return { data: toEmployee(employee) };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        error: {
          formErrors: ["Funcionario ja vinculado a esta empresa"],
          fieldErrors: { email: ["Funcionario ja vinculado a esta empresa"] },
        },
      };
    }
    throw error;
  }
}

export async function listAuditLogs(limit = 20) {
  const prisma = getPrisma();
  await ensureWorkspaceContext(prisma);

  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return entries.map(toAuditEntry);
}
