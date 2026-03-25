"use client";

import { Controller, type UseFormReturn } from "react-hook-form";
import { ModuleSelector } from "@/components/forms/company-wizard/module-selector";
import type { CompanyCreateInput } from "@/components/forms/company-wizard/types";

const SEGMENT_OPTIONS = [
  { value: "consultoria", label: "Consultoria" },
  { value: "terceirizacao", label: "Terceirizacao" },
  { value: "formacao", label: "Formacao" },
  { value: "tecnologia", label: "Tecnologia" },
  { value: "assessoria", label: "Assessoria" },
  { value: "outro", label: "Outro" },
] as const;

const SIZE_OPTIONS = [
  { value: "mei", label: "MEI" },
  { value: "me", label: "ME" },
  { value: "epp", label: "EPP" },
  { value: "medio", label: "Medio" },
  { value: "grande", label: "Grande" },
] as const;

const TAX_OPTIONS = [
  { value: "simples", label: "Simples Nacional" },
  { value: "lucro_presumido", label: "Lucro Presumido" },
  { value: "lucro_real", label: "Lucro Real" },
] as const;

interface StepModulesProps {
  form: UseFormReturn<CompanyCreateInput>;
}

export function StepModules({ form }: StepModulesProps) {
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = form;
  const descriptionLength = (watch("description") ?? "").length;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-[var(--sync-text-primary)]">Segmento e modulos</h2>
        <p className="text-sm text-[var(--sync-text-secondary)]">
          Defina classificacao fiscal e os modulos que a empresa vai operar.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="company-segment" className="text-xs text-[var(--sync-text-secondary)]">
            Segmento
          </label>
          <select
            id="company-segment"
            className="flex h-9 w-full rounded-[var(--sync-radius-md)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] px-3 text-sm text-[var(--sync-text-primary)] focus-visible:border-[var(--sync-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sync-accent-muted)]"
            {...register("segment")}
          >
            <option value="">Selecione</option>
            {SEGMENT_OPTIONS.map((segment) => (
              <option key={segment.value} value={segment.value}>
                {segment.label}
              </option>
            ))}
          </select>
          {errors.segment ? (
            <p className="text-xs text-[var(--sync-status-error)]">{errors.segment.message}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="company-size" className="text-xs text-[var(--sync-text-secondary)]">
            Porte
          </label>
          <select
            id="company-size"
            className="flex h-9 w-full rounded-[var(--sync-radius-md)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] px-3 text-sm text-[var(--sync-text-primary)] focus-visible:border-[var(--sync-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sync-accent-muted)]"
            {...register("size")}
          >
            <option value="">Nao informado</option>
            {SIZE_OPTIONS.map((size) => (
              <option key={size.value} value={size.value}>
                {size.label}
              </option>
            ))}
          </select>
          {errors.size ? (
            <p className="text-xs text-[var(--sync-status-error)]">{errors.size.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="company-tax-regime" className="text-xs text-[var(--sync-text-secondary)]">
            Regime tributario
          </label>
          <select
            id="company-tax-regime"
            className="flex h-9 w-full rounded-[var(--sync-radius-md)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] px-3 text-sm text-[var(--sync-text-primary)] focus-visible:border-[var(--sync-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sync-accent-muted)]"
            {...register("taxRegime")}
          >
            <option value="">Nao informado</option>
            {TAX_OPTIONS.map((tax) => (
              <option key={tax.value} value={tax.value}>
                {tax.label}
              </option>
            ))}
          </select>
          {errors.taxRegime ? (
            <p className="text-xs text-[var(--sync-status-error)]">{errors.taxRegime.message}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="company-description" className="text-xs text-[var(--sync-text-secondary)]">
          Descricao da atividade
        </label>
        <textarea
          id="company-description"
          rows={4}
          maxLength={500}
          className="w-full resize-none rounded-[var(--sync-radius-md)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] px-3 py-2 text-sm text-[var(--sync-text-primary)] placeholder:text-[var(--sync-text-tertiary)] focus-visible:border-[var(--sync-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sync-accent-muted)]"
          placeholder="Descreva brevemente a atividade principal da empresa..."
          {...register("description")}
        />
        <div className="flex items-center justify-between">
          {errors.description ? (
            <p className="text-xs text-[var(--sync-status-error)]">{errors.description.message}</p>
          ) : (
            <span />
          )}
          <p className="text-xs text-[var(--sync-text-tertiary)]">{descriptionLength}/500</p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-[var(--sync-text-secondary)]">Modulos habilitados</label>
        <Controller
          control={control}
          name="enabledModules"
          render={({ field }) => (
            <ModuleSelector value={field.value ?? []} onChange={field.onChange} />
          )}
        />
        {errors.enabledModules ? (
          <p className="text-xs text-[var(--sync-status-error)]">{errors.enabledModules.message}</p>
        ) : null}
      </div>
    </div>
  );
}
