"use client";

import { Controller, type UseFormReturn } from "react-hook-form";
import { ColorPicker } from "@/components/forms/company-wizard/color-picker";
import { CnpjInput } from "@/components/forms/company-wizard/cnpj-input";
import { LogoUploader } from "@/components/forms/company-wizard/logo-uploader";
import type { CompanyCreateInput } from "@/components/forms/company-wizard/types";
import { Input } from "@/components/ui/input";

interface StepIdentityProps {
  form: UseFormReturn<CompanyCreateInput>;
}

export function StepIdentity({ form }: StepIdentityProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-[var(--sync-text-primary)]">Identidade da empresa</h2>
        <p className="text-sm text-[var(--sync-text-secondary)]">
          Dados institucionais e marca para identificacao.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs text-[var(--sync-text-secondary)]">Logo</label>
          <Controller
            control={control}
            name="logo"
            render={({ field }) => (
              <LogoUploader value={field.value} onChange={field.onChange} />
            )}
          />
          {errors.logo ? (
            <p className="text-xs text-[var(--sync-status-error)]">{errors.logo.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-xs text-[var(--sync-text-secondary)]">Cor identificadora</label>
          <Controller
            control={control}
            name="color"
            render={({ field }) => (
              <ColorPicker value={field.value} onChange={field.onChange} />
            )}
          />
          {errors.color ? (
            <p className="text-xs text-[var(--sync-status-error)]">{errors.color.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="company-name" className="text-xs text-[var(--sync-text-secondary)]">
            Razao Social
          </label>
          <Input id="company-name" {...register("name")} />
          {errors.name ? (
            <p className="text-xs text-[var(--sync-status-error)]">{errors.name.message}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="company-trading-name" className="text-xs text-[var(--sync-text-secondary)]">
            Nome Fantasia
          </label>
          <Input id="company-trading-name" {...register("tradingName")} />
          {errors.tradingName ? (
            <p className="text-xs text-[var(--sync-status-error)]">{errors.tradingName.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="company-cnpj" className="text-xs text-[var(--sync-text-secondary)]">
            CNPJ
          </label>
          <Controller
            control={control}
            name="cnpj"
            render={({ field }) => (
              <CnpjInput
                id="company-cnpj"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
          {errors.cnpj ? (
            <p className="text-xs text-[var(--sync-status-error)]">{errors.cnpj.message}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="company-founded-at" className="text-xs text-[var(--sync-text-secondary)]">
            Data de Fundacao
          </label>
          <Input id="company-founded-at" type="date" {...register("foundedAt")} />
          {errors.foundedAt ? (
            <p className="text-xs text-[var(--sync-status-error)]">{errors.foundedAt.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="company-state-registration" className="text-xs text-[var(--sync-text-secondary)]">
            Inscricao Estadual
          </label>
          <Input id="company-state-registration" {...register("stateRegistration")} />
          {errors.stateRegistration ? (
            <p className="text-xs text-[var(--sync-status-error)]">{errors.stateRegistration.message}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="company-city-registration" className="text-xs text-[var(--sync-text-secondary)]">
            Inscricao Municipal
          </label>
          <Input id="company-city-registration" {...register("cityRegistration")} />
          {errors.cityRegistration ? (
            <p className="text-xs text-[var(--sync-status-error)]">{errors.cityRegistration.message}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
