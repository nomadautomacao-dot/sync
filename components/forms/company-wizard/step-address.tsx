"use client";

import { useCallback, useEffect, useState } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";
import { CepInput } from "@/components/forms/company-wizard/cep-input";
import type { CompanyCreateInput } from "@/components/forms/company-wizard/types";
import { Input } from "@/components/ui/input";
import { cn } from "@/core/lib/utils";

const BR_STATES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

interface StepAddressProps {
  form: UseFormReturn<CompanyCreateInput>;
}

export function StepAddress({ form }: StepAddressProps) {
  const {
    register,
    control,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = form;
  const [autoFillFlash, setAutoFillFlash] = useState(false);

  const handleAddressResolved = useCallback(
    (address: { street?: string; neighborhood?: string; city?: string; state?: string }) => {
      setValue("street", address.street ?? "", { shouldValidate: true, shouldDirty: true });
      setValue("neighborhood", address.neighborhood ?? "", { shouldValidate: true, shouldDirty: true });
      setValue("city", address.city ?? "", { shouldValidate: true, shouldDirty: true });
      setValue("state", address.state ?? "", { shouldValidate: true, shouldDirty: true });
      clearErrors(["street", "neighborhood", "city", "state"]);
      setAutoFillFlash(true);
    },
    [clearErrors, setValue],
  );

  const handleInvalidCep = useCallback(() => {
    setError("zipCode", {
      type: "manual",
      message: "CEP invalido ou nao encontrado. Preencha manualmente.",
    });
  }, [setError]);

  useEffect(() => {
    if (!autoFillFlash) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setAutoFillFlash(false);
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [autoFillFlash]);

  const autoFillClass = cn(autoFillFlash && "border-[var(--sync-status-active)]");

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-[var(--sync-text-primary)]">Endereco e localizacao</h2>
        <p className="text-sm text-[var(--sync-text-secondary)]">
          Complete os dados de endereco para operacao e faturamento.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1 md:col-span-1">
          <label htmlFor="company-zip-code" className="text-xs text-[var(--sync-text-secondary)]">
            CEP
          </label>
          <Controller
            control={control}
            name="zipCode"
            render={({ field }) => (
              <CepInput
                id="company-zip-code"
                value={field.value}
                onChange={(next) => {
                  clearErrors("zipCode");
                  field.onChange(next);
                }}
                onAddressResolved={handleAddressResolved}
                onInvalidCep={handleInvalidCep}
              />
            )}
          />
          {errors.zipCode ? (
            <p className="text-xs text-[var(--sync-status-error)]">{errors.zipCode.message}</p>
          ) : null}
        </div>

        <div className="space-y-1 md:col-span-2">
          <label htmlFor="company-street" className="text-xs text-[var(--sync-text-secondary)]">
            Logradouro
          </label>
          <Input id="company-street" className={autoFillClass} {...register("street")} />
          {errors.street ? (
            <p className="text-xs text-[var(--sync-status-error)]">{errors.street.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor="company-number" className="text-xs text-[var(--sync-text-secondary)]">
            Numero
          </label>
          <Input id="company-number" {...register("number")} />
          {errors.number ? (
            <p className="text-xs text-[var(--sync-status-error)]">{errors.number.message}</p>
          ) : null}
        </div>

        <div className="space-y-1 md:col-span-2">
          <label htmlFor="company-complement" className="text-xs text-[var(--sync-text-secondary)]">
            Complemento
          </label>
          <Input id="company-complement" {...register("complement")} />
          {errors.complement ? (
            <p className="text-xs text-[var(--sync-status-error)]">{errors.complement.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor="company-neighborhood" className="text-xs text-[var(--sync-text-secondary)]">
            Bairro
          </label>
          <Input id="company-neighborhood" className={autoFillClass} {...register("neighborhood")} />
          {errors.neighborhood ? (
            <p className="text-xs text-[var(--sync-status-error)]">{errors.neighborhood.message}</p>
          ) : null}
        </div>

        <div className="space-y-1 md:col-span-2">
          <label htmlFor="company-city" className="text-xs text-[var(--sync-text-secondary)]">
            Cidade
          </label>
          <Input id="company-city" className={autoFillClass} {...register("city")} />
          {errors.city ? (
            <p className="text-xs text-[var(--sync-status-error)]">{errors.city.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor="company-state" className="text-xs text-[var(--sync-text-secondary)]">
            Estado (UF)
          </label>
          <select
            id="company-state"
            className={cn(
              "flex h-9 w-full rounded-[var(--sync-radius-md)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] px-3 text-sm text-[var(--sync-text-primary)] focus-visible:border-[var(--sync-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sync-accent-muted)]",
              autoFillClass,
            )}
            {...register("state")}
          >
            <option value="">Selecione</option>
            {BR_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
          {errors.state ? (
            <p className="text-xs text-[var(--sync-status-error)]">{errors.state.message}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
