"use client";

import { Controller, type UseFormReturn } from "react-hook-form";
import { PhoneInput } from "@/components/forms/company-wizard/phone-input";
import type { CompanyCreateInput } from "@/components/forms/company-wizard/types";
import { Input } from "@/components/ui/input";

interface StepContactProps {
  form: UseFormReturn<CompanyCreateInput>;
}

export function StepContact({ form }: StepContactProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-[var(--sync-text-primary)]">Contato e responsavel</h2>
        <p className="text-sm text-[var(--sync-text-secondary)]">
          Configure os canais principais da empresa e do responsavel operacional.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="company-phone" className="text-xs text-[var(--sync-text-secondary)]">
            Telefone principal
          </label>
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <PhoneInput
                id="company-phone"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
          {errors.phone ? (
            <p className="text-xs text-[var(--sync-status-error)]">{errors.phone.message}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="company-phone-secondary" className="text-xs text-[var(--sync-text-secondary)]">
            Telefone secundario
          </label>
          <Controller
            control={control}
            name="phoneSecondary"
            render={({ field }) => (
              <PhoneInput
                id="company-phone-secondary"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
          {errors.phoneSecondary ? (
            <p className="text-xs text-[var(--sync-status-error)]">{errors.phoneSecondary.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="company-email" className="text-xs text-[var(--sync-text-secondary)]">
            Email corporativo
          </label>
          <Input id="company-email" type="email" placeholder="contato@empresa.com" {...register("email")} />
          {errors.email ? (
            <p className="text-xs text-[var(--sync-status-error)]">{errors.email.message}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="company-website" className="text-xs text-[var(--sync-text-secondary)]">
            Website
          </label>
          <Input id="company-website" placeholder="https://empresa.com.br" {...register("website")} />
          {errors.website ? (
            <p className="text-xs text-[var(--sync-status-error)]">{errors.website.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="company-contact-name" className="text-xs text-[var(--sync-text-secondary)]">
            Nome do responsavel
          </label>
          <Input id="company-contact-name" {...register("contactName")} />
          {errors.contactName ? (
            <p className="text-xs text-[var(--sync-status-error)]">{errors.contactName.message}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="company-contact-position" className="text-xs text-[var(--sync-text-secondary)]">
            Cargo do responsavel
          </label>
          <Input id="company-contact-position" {...register("contactPosition")} />
          {errors.contactPosition ? (
            <p className="text-xs text-[var(--sync-status-error)]">{errors.contactPosition.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="company-contact-email" className="text-xs text-[var(--sync-text-secondary)]">
            Email do responsavel
          </label>
          <Input
            id="company-contact-email"
            type="email"
            placeholder="responsavel@empresa.com"
            {...register("contactEmail")}
          />
          {errors.contactEmail ? (
            <p className="text-xs text-[var(--sync-status-error)]">{errors.contactEmail.message}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="company-contact-phone" className="text-xs text-[var(--sync-text-secondary)]">
            Telefone do responsavel
          </label>
          <Controller
            control={control}
            name="contactPhone"
            render={({ field }) => (
              <PhoneInput
                id="company-contact-phone"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
          {errors.contactPhone ? (
            <p className="text-xs text-[var(--sync-status-error)]">{errors.contactPhone.message}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
