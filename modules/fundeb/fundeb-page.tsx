"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, CircleDollarSign, Landmark, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { z } from "zod";
import { fundebConsultingProjectCreateSchema } from "@/core/domain/fundeb-consulting";
import { municipalityCreateSchema } from "@/core/domain/collaboration";
import { useFundebConsultingWorkspace } from "@/core/hooks/use-fundeb-consulting";
import { apiClient } from "@/core/lib/api-client";

type FundebProjectFormState = z.input<typeof fundebConsultingProjectCreateSchema>;
type MunicipalityFormState = z.input<typeof municipalityCreateSchema>;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export function FundebPage() {
  const currentYear = new Date().getUTCFullYear();
  const [year, setYear] = useState(currentYear);
  const [projectForm, setProjectForm] = useState<FundebProjectFormState>({
    municipalityAccountId: "",
    collaboratorId: "",
    serviceLabel: "Consultoria FUNDEB",
    baseYear: currentYear,
    commissionBase: "profit",
    commissionPercent: 3,
    projectedMonthlyRevenue: 0,
    projectedMonthlyCost: 0,
    projectedMonths: 12,
    expectedStartDate: "",
    sourceLabel: "",
    projectionNotes: "",
  });
  const [municipalityForm, setMunicipalityForm] = useState<MunicipalityFormState>({
    municipalityName: "",
    state: "",
    currentStage: "first_contact",
    estimatedAnnualRevenue: 0,
    estimatedAnnualCost: 0,
  });

  const queryClient = useQueryClient();
  const { data, isLoading } = useFundebConsultingWorkspace(year);
  const selectedMunicipalityId = projectForm.municipalityAccountId || data?.municipalities[0]?.id || "";
  const selectedCollaboratorId = projectForm.collaboratorId || data?.collaborators[0]?.id || "";

  const createProjectMutation = useMutation({
    mutationFn: async () => {
      const payload = fundebConsultingProjectCreateSchema.parse({
        ...projectForm,
        baseYear: year,
        municipalityAccountId: selectedMunicipalityId,
        collaboratorId: selectedCollaboratorId,
      });
      return apiClient.post("/api/fundeb-consulting", payload);
    },
    onSuccess: async () => {
      setProjectForm((current) => ({
        ...current,
        projectedMonthlyRevenue: 0,
        projectedMonthlyCost: 0,
        projectedMonths: 12,
        sourceLabel: "",
        projectionNotes: "",
      }));
      await queryClient.invalidateQueries({ queryKey: ["fundeb-consulting-workspace", year] });
    },
  });

  const createMunicipalityMutation = useMutation({
    mutationFn: async () => {
      const payload = municipalityCreateSchema.parse(municipalityForm);
      return apiClient.post("/api/municipalities", payload);
    },
    onSuccess: async () => {
      setMunicipalityForm({
        municipalityName: "",
        state: "",
        currentStage: "first_contact",
        estimatedAnnualRevenue: 0,
        estimatedAnnualCost: 0,
      });
      await queryClient.invalidateQueries({ queryKey: ["fundeb-consulting-workspace", year] });
    },
  });

  const projectedMonthlyProfit = Math.max(0, Number(projectForm.projectedMonthlyRevenue) - Number(projectForm.projectedMonthlyCost));
  const projectedAnnualRevenue = Number(projectForm.projectedMonthlyRevenue) * Number(projectForm.projectedMonths);
  const projectedAnnualProfit = projectedMonthlyProfit * Number(projectForm.projectedMonths);
  const commissionBaseAmount = projectForm.commissionBase === "revenue" ? projectedAnnualRevenue : projectedAnnualProfit;
  const projectedCommission = commissionBaseAmount * (Number(projectForm.commissionPercent) / 100);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Consultoria FUNDEB"
        description="Selecione o municipio, vincule o colaborador indicador e registre a projecao de faturamento para calcular a comissao."
        actions={(
          <Button asChild variant="ghost">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
              Voltar ao dashboard
            </Link>
          </Button>
        )}
      />

      <section className="grid gap-4 px-8 lg:grid-cols-4">
        <StatCard label="Operacoes no ano" value={data?.summary.projectCount ?? 0} helper={`base ${year}`} icon={<Landmark className="h-4 w-4" />} />
        <StatCard label="Municipios ativos" value={data?.summary.municipalitiesCount ?? 0} helper="com projecao registrada" icon={<Building2 className="h-4 w-4" />} index={1} />
        <StatCard label="Faturamento projetado" value={formatCurrency(data?.summary.projectedAnnualRevenue ?? 0)} helper="receita anual consolidada" icon={<TrendingUp className="h-4 w-4" />} index={2} />
        <StatCard label="Comissao projetada" value={formatCurrency(data?.summary.projectedCommissionAmount ?? 0)} helper="repasse do indicador" icon={<CircleDollarSign className="h-4 w-4" />} index={3} />
      </section>

      <section className="grid gap-4 px-8 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Nova operacao FUNDEB</CardTitle>
            <CardDescription>Registre a projecao media de faturamento e o percentual do colaborador para calcular o valor estimado da comissao.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-neutral-400" htmlFor="baseYear">Ano base</label>
                <Input id="baseYear" type="number" value={year} onChange={(event) => setYear(Number(event.target.value) || currentYear)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-neutral-400" htmlFor="serviceLabel">Servico</label>
                <Input id="serviceLabel" value={projectForm.serviceLabel} onChange={(event) => setProjectForm((current) => ({ ...current, serviceLabel: event.target.value }))} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-neutral-400" htmlFor="municipalityAccountId">Municipio</label>
                <select
                  id="municipalityAccountId"
                  className="h-9 w-full rounded-[var(--sync-radius-md)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] px-3 text-sm"
                  value={selectedMunicipalityId}
                  onChange={(event) => setProjectForm((current) => ({ ...current, municipalityAccountId: event.target.value }))}
                >
                  <option value="">Selecione</option>
                  {data?.municipalities.map((municipality) => (
                    <option key={municipality.id} value={municipality.id}>{municipality.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-neutral-400" htmlFor="collaboratorId">Colaborador</label>
                <select
                  id="collaboratorId"
                  className="h-9 w-full rounded-[var(--sync-radius-md)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] px-3 text-sm"
                  value={selectedCollaboratorId}
                  onChange={(event) => setProjectForm((current) => ({ ...current, collaboratorId: event.target.value }))}
                >
                  <option value="">Selecione</option>
                  {data?.collaborators.map((collaborator) => (
                    <option key={collaborator.id} value={collaborator.id}>{collaborator.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1">
                <label className="text-xs text-neutral-400" htmlFor="projectedMonthlyRevenue">Media faturamento mensal</label>
                <Input id="projectedMonthlyRevenue" type="number" min="0" value={Number(projectForm.projectedMonthlyRevenue ?? 0)} onChange={(event) => setProjectForm((current) => ({ ...current, projectedMonthlyRevenue: Number(event.target.value) }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-neutral-400" htmlFor="projectedMonthlyCost">Custo mensal medio</label>
                <Input id="projectedMonthlyCost" type="number" min="0" value={Number(projectForm.projectedMonthlyCost ?? 0)} onChange={(event) => setProjectForm((current) => ({ ...current, projectedMonthlyCost: Number(event.target.value) }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-neutral-400" htmlFor="projectedMonths">Meses projetados</label>
                <Input id="projectedMonths" type="number" min="1" max="12" value={Number(projectForm.projectedMonths ?? 12)} onChange={(event) => setProjectForm((current) => ({ ...current, projectedMonths: Number(event.target.value) }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-neutral-400" htmlFor="commissionPercent">% do colaborador</label>
                <Input id="commissionPercent" type="number" min="0" max="100" step="0.01" value={Number(projectForm.commissionPercent ?? 0)} onChange={(event) => setProjectForm((current) => ({ ...current, commissionPercent: Number(event.target.value) }))} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-neutral-400" htmlFor="commissionBase">Base de comissao</label>
                <select
                  id="commissionBase"
                  className="h-9 w-full rounded-[var(--sync-radius-md)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] px-3 text-sm"
                  value={projectForm.commissionBase}
                  onChange={(event) => setProjectForm((current) => ({ ...current, commissionBase: event.target.value as "profit" | "revenue" }))}
                >
                  <option value="profit">Sobre lucro</option>
                  <option value="revenue">Sobre faturamento</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-neutral-400" htmlFor="expectedStartDate">Inicio previsto</label>
                <Input id="expectedStartDate" type="date" value={projectForm.expectedStartDate ?? ""} onChange={(event) => setProjectForm((current) => ({ ...current, expectedStartDate: event.target.value }))} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-neutral-400" htmlFor="sourceLabel">Origem da projecao</label>
                <Input id="sourceLabel" value={projectForm.sourceLabel ?? ""} onChange={(event) => setProjectForm((current) => ({ ...current, sourceLabel: event.target.value }))} placeholder="Ex.: media historica, proposta comercial, simulado" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-neutral-400" htmlFor="projectionNotes">Observacoes</label>
                <Input id="projectionNotes" value={projectForm.projectionNotes ?? ""} onChange={(event) => setProjectForm((current) => ({ ...current, projectionNotes: event.target.value }))} placeholder="Notas sobre premissas do calculo" />
              </div>
            </div>

            <div className="rounded-[var(--sync-radius-lg)] border border-emerald-500/20 bg-emerald-500/10 p-4">
              <div className="grid gap-2 text-sm text-neutral-200 md:grid-cols-3">
                <p>Lucro mensal estimado: <strong className="text-white">{formatCurrency(projectedMonthlyProfit)}</strong></p>
                <p>Lucro anual projetado: <strong className="text-white">{formatCurrency(projectedAnnualProfit)}</strong></p>
                <p>Comissao estimada: <strong className="text-emerald-300">{formatCurrency(projectedCommission)}</strong></p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => createProjectMutation.mutate()} disabled={createProjectMutation.isPending || !selectedMunicipalityId || !selectedCollaboratorId}>
                Registrar operacao
              </Button>
              <p className="text-xs text-neutral-400">
                {data?.collaborators.length ? "A comissao e calculada automaticamente a partir da base selecionada." : "Cadastre pelo menos um colaborador antes de registrar a operacao."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cadastro rapido de municipio</CardTitle>
            <CardDescription>Se o municipio ainda nao estiver no funil, crie o registro base aqui e use na operacao FUNDEB.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-neutral-400" htmlFor="municipalityName">Municipio</label>
                <Input id="municipalityName" value={municipalityForm.municipalityName} onChange={(event) => setMunicipalityForm((current) => ({ ...current, municipalityName: event.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-neutral-400" htmlFor="state">UF</label>
                <Input id="state" maxLength={2} value={municipalityForm.state} onChange={(event) => setMunicipalityForm((current) => ({ ...current, state: event.target.value.toUpperCase() }))} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs text-neutral-400" htmlFor="currentStage">Etapa</label>
                <select
                  id="currentStage"
                  className="h-9 w-full rounded-[var(--sync-radius-md)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] px-3 text-sm"
                  value={municipalityForm.currentStage}
                  onChange={(event) => setMunicipalityForm((current) => ({ ...current, currentStage: event.target.value as MunicipalityFormState["currentStage"] }))}
                >
                  <option value="mapping">Mapeamento</option>
                  <option value="first_contact">Primeiro contato</option>
                  <option value="technical_diagnosis">Diagnostico tecnico</option>
                  <option value="proposal_presented">Proposta apresentada</option>
                  <option value="negotiation">Negociacao</option>
                  <option value="implementation">Implantacao</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-neutral-400" htmlFor="estimatedAnnualRevenue">Receita anual estimada</label>
                <Input id="estimatedAnnualRevenue" type="number" min="0" value={Number(municipalityForm.estimatedAnnualRevenue ?? 0)} onChange={(event) => setMunicipalityForm((current) => ({ ...current, estimatedAnnualRevenue: Number(event.target.value) }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-neutral-400" htmlFor="estimatedAnnualCost">Custo anual estimado</label>
                <Input id="estimatedAnnualCost" type="number" min="0" value={Number(municipalityForm.estimatedAnnualCost ?? 0)} onChange={(event) => setMunicipalityForm((current) => ({ ...current, estimatedAnnualCost: Number(event.target.value) }))} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={() => createMunicipalityMutation.mutate()} disabled={createMunicipalityMutation.isPending}>
                Salvar municipio
              </Button>
              <Button asChild variant="ghost">
                <Link href="/people">Ir para colaboradores</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="px-8 pb-8">
        <Card>
          <CardHeader>
            <CardTitle>Operacoes registradas</CardTitle>
            <CardDescription>Base consolidada para acompanhar faturamento projetado, lucro e comissao do indicador por municipio.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {isLoading ? (
              <p className="text-sm text-neutral-400">Carregando operacoes...</p>
            ) : !data?.projects.length ? (
              <p className="text-sm text-neutral-400">Nenhuma operacao FUNDEB registrada para {year}.</p>
            ) : (
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="pb-3 pr-4">Municipio</th>
                    <th className="pb-3 pr-4">Colaborador</th>
                    <th className="pb-3 pr-4">Servico</th>
                    <th className="pb-3 pr-4">Fat. anual</th>
                    <th className="pb-3 pr-4">Lucro anual</th>
                    <th className="pb-3 pr-4">% base</th>
                    <th className="pb-3 pr-4">Comissao</th>
                    <th className="pb-3">Fonte</th>
                  </tr>
                </thead>
                <tbody>
                  {data.projects.map((project) => (
                    <tr key={project.id} className="border-t border-[var(--sync-border-subtle)]">
                      <td className="py-3 pr-4 text-white">{project.municipalityName}/{project.state}</td>
                      <td className="py-3 pr-4 text-neutral-300">
                        <div>{project.collaboratorName}</div>
                        <div className="text-xs text-neutral-500">{project.collaboratorRole}</div>
                      </td>
                      <td className="py-3 pr-4 text-neutral-300">{project.serviceLabel}</td>
                      <td className="py-3 pr-4 text-neutral-300">{formatCurrency(project.projectedAnnualRevenue)}</td>
                      <td className="py-3 pr-4 text-emerald-300">{formatCurrency(project.projectedAnnualProfit)}</td>
                      <td className="py-3 pr-4 text-neutral-300">{project.commissionPercent.toFixed(2)}% {project.commissionBase === "profit" ? "lucro" : "faturamento"}</td>
                      <td className="py-3 pr-4 text-amber-300">{formatCurrency(project.projectedCommissionAmount)}</td>
                      <td className="py-3 text-neutral-300">{project.sourceLabel ?? "--"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
