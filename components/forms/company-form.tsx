"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import type { z } from "zod";
import { moduleCatalog } from "@/core/domain/module";
import { companySchema, type Company } from "@/core/domain/organization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CompanyFormValues = z.output<typeof companySchema>;

interface CompanyFormProps {
  defaultValues?: Partial<Company>;
  onSubmit: (data: CompanyFormValues) => Promise<void> | void;
  submitLabel?: string;
}

export function CompanyForm({
  defaultValues,
  onSubmit,
  submitLabel = "Salvar empresa",
}: CompanyFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema) as Resolver<CompanyFormValues>,
    defaultValues: {
      name: defaultValues?.name ?? "",
      tradingName: defaultValues?.tradingName ?? "",
      cnpj: defaultValues?.cnpj ?? "",
      segment: defaultValues?.segment ?? "consultoria",
      status: defaultValues?.status ?? "active",
      enabledModules: defaultValues?.enabledModules ?? [],
    },
  });

  const selectedModules = watch("enabledModules") ?? [];

  return (
    <form className="space-y-3" onSubmit={handleSubmit(async (data) => onSubmit(data))}>
      <div className="space-y-1">
        <label className="text-xs text-[var(--sync-text-secondary)]" htmlFor="name">
          Razao social
        </label>
        <Input id="name" {...register("name")} />
        {errors.name ? <p className="text-xs text-[var(--sync-status-error)]">{errors.name.message}</p> : null}
      </div>
      <div className="space-y-1">
        <label className="text-xs text-[var(--sync-text-secondary)]" htmlFor="tradingName">
          Nome fantasia
        </label>
        <Input id="tradingName" {...register("tradingName")} />
        {errors.tradingName ? (
          <p className="text-xs text-[var(--sync-status-error)]">{errors.tradingName.message}</p>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs text-[var(--sync-text-secondary)]" htmlFor="cnpj">
            CNPJ (14 digitos)
          </label>
          <Input id="cnpj" {...register("cnpj")} />
          {errors.cnpj ? <p className="text-xs text-[var(--sync-status-error)]">{errors.cnpj.message}</p> : null}
        </div>
        <div className="space-y-1">
          <label className="text-xs text-[var(--sync-text-secondary)]" htmlFor="segment">
            Segmento
          </label>
          <Input id="segment" {...register("segment")} />
          {errors.segment ? <p className="text-xs text-[var(--sync-status-error)]">{errors.segment.message}</p> : null}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs text-[var(--sync-text-secondary)]">Modulos habilitados</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {moduleCatalog.map((module) => (
            <label
              key={module.key}
              className="flex cursor-pointer items-center gap-2 rounded-[var(--sync-radius-md)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] px-2 py-1.5 text-xs"
            >
              <input
                type="checkbox"
                checked={selectedModules.includes(module.key)}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...selectedModules, module.key]
                    : selectedModules.filter((item) => item !== module.key);
                  setValue("enabledModules", next, { shouldDirty: true });
                }}
              />
              <span>{module.label}</span>
            </label>
          ))}
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {submitLabel}
      </Button>
    </form>
  );
}
