"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CircleDollarSign, MapPinned, TrendingUp, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCollaboratorDashboard } from "@/core/hooks/use-collaborators";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function stageLabel(stage: string) {
  const labels: Record<string, string> = {
    mapping: "Mapeamento",
    first_contact: "Primeiro contato",
    institutional_validation: "Validação institucional",
    technical_diagnosis: "Diagnóstico técnico",
    proposal_presented: "Proposta apresentada",
    negotiation: "Negociação",
    verbally_approved: "Aprovação verbal",
    contractual: "Contratual",
    implementation: "Implantação",
    assisted_operation: "Operação assistida",
    fidelized: "Fidelizado",
    paused: "Pausado",
    lost: "Perdido",
  };
  return labels[stage] ?? stage;
}

export default function CollaboratorDashboardPage() {
  const params = useParams<{ id: string }>();
  const year = new Date().getUTCFullYear();
  const collaboratorId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { data, isLoading } = useCollaboratorDashboard(collaboratorId, year);

  if (isLoading || !data) {
    return (
      <div className="space-y-5">
        <PageHeader title="Dashboard do colaborador" description="Carregando carteira, resultado e previsões." />
        <section className="px-8">
          <Card>
            <CardContent className="p-8 text-sm text-neutral-400">Carregando dashboard individual...</CardContent>
          </Card>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
        <PageHeader
          title={data.collaborator.fullName}
          description="Carteira de municípios, desempenho, comissão e projeção individual."
        actions={(
          <Button asChild variant="ghost">
            <Link href="/people">
              <ArrowLeft className="h-4 w-4" />
              Voltar para colaboradores
            </Link>
          </Button>
        )}
      />

      <section className="grid gap-4 px-8 lg:grid-cols-4">
        <StatCard label="Cidades associadas" value={data.kpis.associatedCities} helper="municípios no radar" icon={<MapPinned className="h-4 w-4" />} />
        <StatCard label="Cidades fidelizadas" value={data.kpis.fidelizedCities} helper="base recorrente validada" icon={<TrendingUp className="h-4 w-4" />} index={1} />
        <StatCard label="Comissão prevista YTD" value={formatCurrency(data.kpis.commissionForecastYtd)} helper="acúmulo estimado no ano" icon={<CircleDollarSign className="h-4 w-4" />} index={2} />
        <StatCard label="Comissão paga YTD" value={formatCurrency(data.kpis.commissionPaidYtd)} helper="pagamentos efetivamente feitos" icon={<Wallet className="h-4 w-4" />} index={3} />
      </section>

      <section className="grid gap-4 px-8 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Tendência mensal</CardTitle>
            <CardDescription>Lucro-base associado, comissão prevista e comissão paga por mês.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.monthlyTrend.map((month) => (
              <div key={month.month} className="grid grid-cols-[64px_1fr] items-center gap-3">
                <span className="text-xs uppercase tracking-wide text-neutral-500">{String(month.month).padStart(2, "0")}</span>
                <div className="grid gap-2 rounded-[var(--sync-radius-md)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] p-3 md:grid-cols-3">
                  <span className="text-xs text-neutral-400">Lucro: <strong className="text-white">{formatCurrency(month.profit)}</strong></span>
                  <span className="text-xs text-neutral-400">Prevista: <strong className="text-amber-300">{formatCurrency(month.commissionForecast)}</strong></span>
                  <span className="text-xs text-neutral-400">Paga: <strong className="text-emerald-300">{formatCurrency(month.commissionPaid)}</strong></span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumo da parceria</CardTitle>
            <CardDescription>Dados-chave do colaborador e da projeção individual.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-neutral-300">
            <p>Email: {data.collaborator.email ?? "--"}</p>
            <p>Telefone: {data.collaborator.whatsapp ?? data.collaborator.phone ?? "--"}</p>
            <p>Organização: {data.collaborator.companyOrOrganization ?? "--"}</p>
            <p>Papel principal: {data.collaborator.primaryRole}</p>
            <p>Comissão padrão: {data.collaborator.defaultCommissionPercent}%</p>
            <p>Projeção do próximo ano: <strong className="text-emerald-300">{formatCurrency(data.kpis.nextYearForecast)}</strong></p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 px-8 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader>
            <CardTitle>Carteira por cidade</CardTitle>
            <CardDescription>Municípios vinculados, etapa atual, potencial e comissão projetada.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="pb-3 pr-4">Cidade</th>
                  <th className="pb-3 pr-4">Etapa</th>
                  <th className="pb-3 pr-4">Prob.</th>
                  <th className="pb-3 pr-4">Lucro est.</th>
                  <th className="pb-3 pr-4">%</th>
                  <th className="pb-3 pr-4">Comissão est.</th>
                  <th className="pb-3">Owner</th>
                </tr>
              </thead>
              <tbody>
                {data.cities.map((city) => (
                  <tr key={city.id} className="border-t border-[var(--sync-border-subtle)]">
                    <td className="py-3 pr-4 text-white">{city.municipalityName}/{city.state}</td>
                    <td className="py-3 pr-4 text-neutral-300">{stageLabel(city.stage)}</td>
                    <td className="py-3 pr-4 text-neutral-300">{(city.probability * 100).toFixed(0)}%</td>
                    <td className="py-3 pr-4 text-neutral-300">{formatCurrency(city.estimatedAnnualProfit)}</td>
                    <td className="py-3 pr-4 text-neutral-300">{city.agreedCommissionPercent.toFixed(2)}%</td>
                    <td className="py-3 pr-4 text-amber-300">{formatCurrency(city.commissionForecast)}</td>
                    <td className="py-3 text-neutral-300">{city.ownerName ?? "--"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertas da carteira</CardTitle>
            <CardDescription>Pontos que exigem ação para não degradar conversão e projeção.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.alerts.length === 0 ? (
              <p className="text-sm text-neutral-400">Nenhum alerta crítico encontrado.</p>
            ) : (
              data.alerts.map((alert) => (
                <div key={alert} className="rounded-[var(--sync-radius-md)] border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">
                  {alert}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
