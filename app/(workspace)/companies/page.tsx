"use client";

import { Building2, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Company } from "@/core/domain/organization";
import { useCompanies } from "@/core/hooks/use-companies";

export default function CompaniesPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const { data: companies = [], isLoading } = useCompanies(search, status);
  const hasActiveFilters = search.trim().length > 0 || status !== "all";

  const columns = useMemo<ColumnDef<Company>[]>(
    () => [
      {
        accessorKey: "tradingName",
        header: "Empresa",
        cell: ({ row }) => (
          <Link href={`/companies/${row.original.id}`} className="font-medium text-[var(--sync-text-primary)]">
            {row.original.tradingName}
          </Link>
        ),
      },
      {
        accessorKey: "segment",
        header: "Segmento",
      },
      {
        accessorKey: "cnpj",
        header: "CNPJ",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "enabledModules",
        header: "Modulos",
        cell: ({ row }) => (
          <p className="text-xs uppercase text-[var(--sync-text-tertiary)]">
            {row.original.enabledModules.length}
          </p>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-4 pb-8">
      <PageHeader
        title="Empresas"
        description="Selecione uma empresa para visualizar detalhes, modulos e equipes."
        actions={
          <Button asChild>
            <Link href="/companies/new">
              <Plus className="h-4 w-4" />
              Nova empresa
            </Link>
          </Button>
        }
      />
      <div className="space-y-4 px-8">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--sync-text-tertiary)]" />
            <Input
              placeholder="Buscar empresa por nome, CNPJ ou segmento..."
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-9 min-w-44 rounded-[var(--sync-radius-md)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] px-3 text-sm text-[var(--sync-text-primary)]"
          >
            <option value="all">Todos os status</option>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>

          {hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setStatus("all");
              }}
            >
              <X className="h-4 w-4" />
              Limpar filtros
            </Button>
          ) : null}
        </div>

        {isLoading ? <LoadingState rows={6} /> : null}

        {!isLoading && companies.length === 0 ? (
          <div className="sync-panel flex min-h-[280px] flex-col items-center justify-center gap-4 rounded-[var(--sync-radius-lg)] px-6 py-10 text-center">
            <div className="rounded-full border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] p-3">
              <Building2 className="h-6 w-6 text-[var(--sync-text-tertiary)]" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold text-[var(--sync-text-primary)]">Nenhuma empresa encontrada</h3>
              <p className="max-w-lg text-sm text-[var(--sync-text-secondary)]">
                Cadastre a primeira empresa para iniciar a operacao do workspace.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/companies/new">
                  <Plus className="h-4 w-4" />
                  Criar primeira empresa
                </Link>
              </Button>
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setStatus("all");
                  }}
                >
                  Limpar filtros
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {!isLoading && companies.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wider text-[var(--sync-text-tertiary)]">
              {companies.length} empresa{companies.length > 1 ? "s" : ""} encontrada{companies.length > 1 ? "s" : ""}
            </p>
            <DataTable data={companies} columns={columns} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
