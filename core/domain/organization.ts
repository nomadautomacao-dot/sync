import { z } from "zod";
import { moduleKeySchema } from "@/core/domain/module";

export const companyStatusSchema = z.enum(["active", "inactive"]);
export const employeeStatusSchema = z.enum(["active", "on_leave", "inactive"]);
export const companySizeSchema = z.enum(["mei", "me", "epp", "medio", "grande"]);
export const taxRegimeSchema = z.enum(["simples", "lucro_presumido", "lucro_real"]);
export const companySegmentSchema = z.enum([
  "consultoria",
  "terceirizacao",
  "formacao",
  "tecnologia",
  "assessoria",
  "outro",
]);

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function emptyToUndefined(value: unknown) {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }
  return value;
}

function isValidCnpj(value: string) {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) {
    return false;
  }

  const calculateCheckDigit = (base: string, weights: number[]) => {
    const sum = base
      .split("")
      .reduce((acc, digit, idx) => acc + Number(digit) * weights[idx], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const base = cnpj.slice(0, 12);
  const digit1 = calculateCheckDigit(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const digit2 = calculateCheckDigit(
    `${base}${digit1}`,
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );

  return cnpj === `${base}${digit1}${digit2}`;
}

function isValidZipCode(value: string) {
  return onlyDigits(value).length === 8;
}

function isValidPhone(value: string) {
  const digits = onlyDigits(value);
  return digits.length >= 10 && digits.length <= 11;
}

export const companyCreateSchema = z.object({
  name: z.string().trim().min(3, "Razao social obrigatoria"),
  tradingName: z.string().trim().min(2, "Nome fantasia obrigatorio"),
  cnpj: z
    .string()
    .trim()
    .min(1, "CNPJ obrigatorio")
    .refine((value) => isValidCnpj(value), "CNPJ invalido"),
  stateRegistration: z.preprocess(emptyToUndefined, z.string().trim().max(30).optional()),
  cityRegistration: z.preprocess(emptyToUndefined, z.string().trim().max(30).optional()),
  foundedAt: z.preprocess(emptyToUndefined, z.iso.date().optional()),
  logo: z.preprocess(emptyToUndefined, z.url().optional()),
  color: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^#([A-Fa-f0-9]{6})$/, "Cor invalida")
      .optional(),
  ),
  zipCode: z
    .string()
    .trim()
    .min(1, "CEP obrigatorio")
    .refine((value) => isValidZipCode(value), "CEP invalido"),
  street: z.string().trim().min(3, "Logradouro obrigatorio").max(120),
  number: z.string().trim().min(1, "Numero obrigatorio").max(30),
  complement: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  neighborhood: z.string().trim().min(2, "Bairro obrigatorio").max(80),
  city: z.string().trim().min(2, "Cidade obrigatoria").max(80),
  state: z
    .string()
    .trim()
    .min(1, "UF obrigatoria")
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "UF invalida"),
  phone: z
    .string()
    .trim()
    .min(1, "Telefone principal obrigatorio")
    .refine((value) => isValidPhone(value), "Telefone invalido"),
  phoneSecondary: z.preprocess(emptyToUndefined, z.string().trim().max(20).optional()),
  email: z.string().trim().min(1, "Email corporativo obrigatorio").email("Email invalido"),
  website: z.preprocess(emptyToUndefined, z.url("Website invalido").optional()),
  contactName: z.string().trim().min(3, "Nome do responsavel obrigatorio").max(120),
  contactPosition: z.string().trim().min(2, "Cargo do responsavel obrigatorio").max(80),
  contactEmail: z
    .string()
    .trim()
    .min(1, "Email do responsavel obrigatorio")
    .email("Email de responsavel invalido"),
  contactPhone: z.preprocess(emptyToUndefined, z.string().trim().max(20).optional()),
  segment: z.preprocess(emptyToUndefined, companySegmentSchema.default("outro")),
  description: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
  size: z.preprocess(emptyToUndefined, companySizeSchema.optional()),
  taxRegime: z.preprocess(emptyToUndefined, taxRegimeSchema.optional()),
  status: companyStatusSchema.default("active"),
  enabledModules: z.array(moduleKeySchema).default([]),
});

export const companySchema = companyCreateSchema;
export const companyUpdateSchema = companyCreateSchema.partial();

export const employeeSchema = z.object({
  companyId: z.string().trim().min(1, "Empresa obrigatoria"),
  name: z.string().trim().min(2, "Nome obrigatorio"),
  email: z.email("Email invalido"),
  position: z.string().trim().min(2, "Cargo obrigatorio"),
  role: z.string().trim().min(2, "Perfil obrigatorio"),
  status: employeeStatusSchema.default("active"),
  hireDate: z.iso.date(),
});

export const employeeQuerySchema = z.object({
  companyId: z.string().optional(),
  search: z.string().optional(),
});

export interface Company extends z.infer<typeof companyCreateSchema> {
  id: string;
  groupId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Employee extends z.infer<typeof employeeSchema> {
  id: string;
  userId: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  userId: string;
  companyId?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
