"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { BarChart3, Briefcase, CircleDollarSign, MapPinned, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { collaboratorCreateSchema, type CollaboratorListItem } from "@/core/domain/collaboration";
import { useCollaborators } from "@/core/hooks/use-collaborators";
import { apiClient } from "@/core/lib/api-client";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type CollaboratorCreateInput = z.input<typeof collaboratorCreateSchema>;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function collaboratorTypeLabel(type: CollaboratorListItem["collaboratorType"]) {
  const labels: Record<CollaboratorListItem["collaboratorType"], string> = {
    internal_consultant: "Consultor interno",
    external_partner: "Parceiro externo",
    municipal_articulator: "Articulador municipal",
    introducer: "Indicador",
    strategic_advisor: "Conselheiro estratégico",
    implementation_support: "Suporte à implantação",
    executive_sponsor: "Patrocinador executivo",
    hybrid: "Híbrido",
  };
  return labels[type];
}

function statusLabel(status: CollaboratorListItem["partnershipStatus"]) {
  const labels: Record<CollaboratorListItem["partnershipStatus"], string> = {
    prospect: "Prospecção",
    active: "Ativo",
    paused: "Pausado",
    blocked: "Bloqueado",
    inactive: "Inativo",
  };
  return labels[status];
}

function statusClass(status: CollaboratorListItem["partnershipStatus"]) {
  const styles: Record<CollaboratorListItem["partnershipStatus"], string> = {
    prospect: "border-sky-500/20 bg-sky-500/10 text-sky-300",
    active: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    paused: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    blocked: "border-red-500/20 bg-red-500/10 text-red-300",
    inactive: "border-neutral-700 bg-neutral-800/80 text-neutral-400",
  };
  return styles[status];
}

function CollaboratorForm({ onSubmit }: { onSubmit: (data: CollaboratorCreateInput) => Promise<void> | void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CollaboratorCreateInput>({
    resolver: zodResolver(collaboratorCreateSchema),
    defaultValues: {
      collaboratorType: "external_partner",
      primaryRole: "Captação",
      partnershipStatus: "active",
      defaultCommissionPercent: 3,
      defaultProfitBaseType: "operational_profit_pre_commission",
      defaultTriggerType: "monthly_recurring_after_fidelization",
      payoutCycle: "monthly",
      payoutMethod: "transfer",
    },
  });

  return (
    <form className="space-y-3" onSubmit={handleSubmit(async (data) => onSubmit(data))}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs text-neutral-400" htmlFor="fullName">Nome</label>
          <Input id="fullName" {...register("fullName")} />
          {errors.fullName ? <p className="text-xs text-red-400">{errors.fullName.message}</p> : null}
        </div>
        <div className="space-y-1">
          <label className="text-xs text-neutral-400" htmlFor="shortName">Nome curto</label>
          <Input id="shortName" {...register("shortName")} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs text-neutral-400" htmlFor="email">Email</label>
          <Input id="email" type="email" {...register("email")} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-neutral-400" htmlFor="whatsapp">WhatsApp</label>
          <Input id="whatsapp" {...register("whatsapp")} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs text-neutral-400" htmlFor="state">UF</label>
          <Input id="state" maxLength={2} {...register("state")} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-neutral-400" htmlFor="primaryRole">Papel principal</label>
          <Input id="primaryRole" {...register("primaryRole")} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs text-neutral-400" htmlFor="collaboratorType">Tipo</label>
          <select
            id="collaboratorType"
            className="h-9 w-full rounded-[var(--sync-radius-md)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] px-3 text-sm"
            {...register("collaboratorType")}
          >
            <option value="external_partner">Parceiro externo</option>
            <option value="municipal_articulator">Articulador municipal</option>
            <option value="introducer">Indicador</option>
            <option value="strategic_advisor">Conselheiro estratégico</option>
            <option value="implementation_support">Suporte à implantação</option>
            <option value="internal_consultant">Consultor interno</option>
            <option value="executive_sponsor">Patrocinador executivo</option>
            <option value="hybrid">Híbrido</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-neutral-400" htmlFor="partnershipStatus">Status</label>
          <select
            id="partnershipStatus"
            className="h-9 w-full rounded-[var(--sync-radius-md)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] px-3 text-sm"
            {...register("partnershipStatus")}
          >
            <option value="active">Ativo</option>
            <option value="prospect">Em prospecção</option>
            <option value="paused">Pausado</option>
            <option value="blocked">Bloqueado</option>
            <option value="inactive">Inativo</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs text-neutral-400" htmlFor="defaultCommissionPercent">Comissão padrão (%)</label>
          <Input id="defaultCommissionPercent" type="number" min={0} max={100} step="0.01" {...register("defaultCommissionPercent", { valueAsNumber: true })} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-neutral-400" htmlFor="onboardingDate">Início da parceria</label>
          <Input id="onboardingDate" type="date" {...register("onboardingDate")} />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-neutral-400" htmlFor="notes">Notas</label>
        <textarea
          id="notes"
          className="min-h-24 w-full rounded-[var(--sync-radius-md)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] px-3 py-2 text-sm text-[var(--sync-text-primary)] outline-none"
          {...register("notes")}
        />
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        Salvar colaborador
      </Button>
    </form>
  );
}

export default function PeoplePage() {
  const year = new Date().getUTCFullYear();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data: collaborators = [], isLoading } = useCollaborators({ search, status, year });

  const createCollaboratorMutation = useMutation({
    mutationFn: (payload: CollaboratorCreateInput) => apiClient.post<CollaboratorListItem>("/api/collaborators", payload),
    onSuccess: async () => {
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["collaborators"] });
    },
  });

  const summary = useMemo(
    () => ({
      active: collaborators.filter((item) => item.partnershipStatus === "active").length,
      municipalities: collaborators.reduce((sum, item) => sum + item.metrics.municipalitiesCount, 0),
      profit: collaborators.reduce((sum, item) => sum + item.metrics.profitYtd, 0),
      commission: collaborators.reduce((sum, item) => sum + item.metrics.commissionForecastYtd, 0),
    }),
    [collaborators],
  );

  const columns = useMemo<ColumnDef<CollaboratorListItem>[]>(
    () => [
      {
        accessorKey: "fullName",
        header: "Colaborador",
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-white">{row.original.fullName}</p>
            <p className="text-xs text-neutral-500">{row.original.primaryRole}</p>
          </div>
        ),
      },
      {
        accessorKey: "collaboratorType",
        header: "Tipo",
        cell: ({ row }) => <span className="text-sm text-neutral-300">{collaboratorTypeLabel(row.original.collaboratorType)}</span>,
      },
      {
        accessorKey: "state",
        header: "UF",
        cell: ({ row }) => <span className="text-sm text-neutral-300">{row.original.state ?? "--"}</span>,
      },
      {
        id: "cities",
        header: "Cidades",
        cell: ({ row }) => <span className="text-sm text-neutral-300">{row.original.metrics.municipalitiesCount}</span>,
      },
      {
        id: "fidelized",
        header: "Fidelizadas",
        cell: ({ row }) => <span className="text-sm text-emerald-300">{row.original.metrics.fidelizedCount}</span>,
      },
      {
        id: "profit",
        header: "Lucro YTD",
        cell: ({ row }) => <span className="text-sm text-white">{formatCurrency(row.original.metrics.profitYtd)}</span>,
      },
      {
        id: "commission",
        header: "Comissão YTD",
        cell: ({ row }) => <span className="text-sm text-amber-300">{formatCurrency(row.original.metrics.commissionForecastYtd)}</span>,
      },
      {
        accessorKey: "partnershipStatus",
        header: "Status",
        cell: ({ row }) => (
          <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${statusClass(row.original.partnershipStatus)}`}>
            {statusLabel(row.original.partnershipStatus)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/people/${row.original.id}`}>Abrir</Link>
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Colaboradores"
        description="Rede de parceiros, articuladores e responsáveis por abrir, sustentar e expandir operações em prefeituras."
      />

      <section className="grid gap-4 px-8 lg:grid-cols-4">
        <StatCard label="Colaboradores ativos" value={summary.active} helper="parcerias em andamento" icon={<Briefcase className="h-4 w-4" />} />
        <StatCard label="Cidades associadas" value={summary.municipalities} helper="municípios sob acompanhamento" icon={<MapPinned className="h-4 w-4" />} index={1} />
        <StatCard label="Lucro YTD" value={formatCurrency(summary.profit)} helper={`resultado acumulado em ${year}`} icon={<BarChart3 className="h-4 w-4" />} index={2} />
        <StatCard label="Comissão prevista" value={formatCurrency(summary.commission)} helper="base recorrente prevista" icon={<CircleDollarSign className="h-4 w-4" />} index={3} />
      </section>

      <section className="space-y-4 px-8 pb-8">
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                <Input
                  placeholder="Buscar colaborador, cidade, UF ou papel..."
                  className="pl-10"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <select
                  className="h-9 rounded-[var(--sync-radius-md)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] px-3 text-sm"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="all">Todos os status</option>
                  <option value="active">Ativos</option>
                    <option value="prospect">Em prospecção</option>
                  <option value="paused">Pausados</option>
                  <option value="blocked">Bloqueados</option>
                  <option value="inactive">Inativos</option>
                </select>
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" />
                      Novo colaborador
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Novo colaborador</DialogTitle>
                      <DialogDescription>Cadastre o parceiro para acompanhar municípios, lucro e comissões.</DialogDescription>
                    </DialogHeader>
                    <CollaboratorForm
                      onSubmit={async (payload) => {
                        await createCollaboratorMutation.mutateAsync(payload);
                      }}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {isLoading ? (
              <div className="rounded-[var(--sync-radius-lg)] border border-dashed border-[var(--sync-border-subtle)] p-8 text-center text-sm text-neutral-400">
                Carregando colaboradores...
              </div>
            ) : collaborators.length === 0 ? (
              <div className="rounded-[var(--sync-radius-lg)] border border-dashed border-[var(--sync-border-subtle)] p-8 text-center text-sm text-neutral-400">
                Nenhum colaborador encontrado. Cadastre o primeiro colaborador para iniciar o controle da rede municipal.
              </div>
            ) : (
              <DataTable data={collaborators} columns={columns} rowClassName="group/row" />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
