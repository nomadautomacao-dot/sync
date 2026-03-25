import type { z } from "zod";
import type { FieldPath } from "react-hook-form";
import { companyCreateSchema } from "@/core/domain/organization";

export type CompanyCreateInput = z.output<typeof companyCreateSchema>;

export type WizardStep = {
  id: number;
  title: string;
  description: string;
  fields: FieldPath<CompanyCreateInput>[];
};
