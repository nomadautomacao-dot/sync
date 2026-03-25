"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import type { Company } from "@/core/domain/organization";
import { employeeSchema } from "@/core/domain/organization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type EmployeeFormValues = z.input<typeof employeeSchema>;

interface EmployeeFormProps {
  companies: Company[];
  onSubmit: (data: EmployeeFormValues) => Promise<void> | void;
}

export function EmployeeForm({ companies, onSubmit }: EmployeeFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      companyId: companies[0]?.id ?? "",
      name: "",
      email: "",
      position: "",
      role: "analyst",
      status: "active",
      hireDate: new Date().toISOString().slice(0, 10),
    },
  });

  return (
    <form className="space-y-3" onSubmit={handleSubmit(async (data) => onSubmit(data))}>
      <div className="space-y-1">
        <label className="text-xs text-[var(--sync-text-secondary)]" htmlFor="companyId">
          Empresa
        </label>
        <select
          id="companyId"
          className="h-9 w-full rounded-[var(--sync-radius-md)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] px-3 text-sm"
          {...register("companyId")}
        >
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.tradingName}
            </option>
          ))}
        </select>
        {errors.companyId ? (
          <p className="text-xs text-[var(--sync-status-error)]">{errors.companyId.message}</p>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs text-[var(--sync-text-secondary)]" htmlFor="name">
            Nome
          </label>
          <Input id="name" {...register("name")} />
          {errors.name ? <p className="text-xs text-[var(--sync-status-error)]">{errors.name.message}</p> : null}
        </div>
        <div className="space-y-1">
          <label className="text-xs text-[var(--sync-text-secondary)]" htmlFor="email">
            Email
          </label>
          <Input id="email" type="email" {...register("email")} />
          {errors.email ? <p className="text-xs text-[var(--sync-status-error)]">{errors.email.message}</p> : null}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs text-[var(--sync-text-secondary)]" htmlFor="position">
            Cargo
          </label>
          <Input id="position" {...register("position")} />
          {errors.position ? (
            <p className="text-xs text-[var(--sync-status-error)]">{errors.position.message}</p>
          ) : null}
        </div>
        <div className="space-y-1">
          <label className="text-xs text-[var(--sync-text-secondary)]" htmlFor="role">
            Perfil
          </label>
          <Input id="role" {...register("role")} />
          {errors.role ? <p className="text-xs text-[var(--sync-status-error)]">{errors.role.message}</p> : null}
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-[var(--sync-text-secondary)]" htmlFor="hireDate">
          Data de admissao
        </label>
        <Input id="hireDate" type="date" {...register("hireDate")} />
        {errors.hireDate ? (
          <p className="text-xs text-[var(--sync-status-error)]">{errors.hireDate.message}</p>
        ) : null}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        Adicionar funcionario
      </Button>
    </form>
  );
}
