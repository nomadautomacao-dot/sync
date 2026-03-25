"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CircleDollarSign,
  Landmark,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useExecutiveDashboard } from "@/core/hooks/use-executive-dashboard";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatStageLabel(value: string) {
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
  return labels[value] ?? value;
}

function DashboardTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ color?: string; name?: string; value?: number | string }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-[var(--sync-radius-lg)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-elevated)] p-3 shadow-[var(--sync-shadow-lg)]">
      {label !== undefined ? (
        <p className="mb-2 text-xs uppercase tracking-wider text-[var(--sync-text-tertiary)]">
          {label}
        </p>
      ) : null}
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4 text-sm">
            <span className="flex items-center gap-2 text-[var(--sync-text-secondary)]">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color ?? "var(--sync-text-primary)" }}
              />
              {entry.name}
            </span>
            <strong className="text-[var(--sync-text-primary)]">
              {typeof entry.value === "number" ? formatCurrency(entry.value) : entry.value}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardSection({
  title,
  description,
  children,
  contentClassName = "",
}: {
  title: string;
  description: string;
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <Card className="min-w-0 h-full">
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={`min-w-0 flex-1 ${contentClassName}`}>{children}</CardContent>
    </Card>
  );
}

function DashboardKpi({
  label,
  value,
  helper,
  icon,
  index = 0,
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: ReactNode;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.28 }}
      className="h-full"
    >
      <Card className="h-full min-w-0 bg-[var(--sync-bg-elevated)]">
        <CardContent className="flex h-full min-h-[144px] flex-col justify-between p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="max-w-[150px] text-[11px] uppercase tracking-[0.18em] text-[var(--sync-text-tertiary)]">
              {label}
            </p>
            <div className="shrink-0 rounded-[var(--sync-radius-md)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] p-2 text-[var(--sync-text-secondary)]">
              {icon}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[clamp(1.8rem,2vw,2.2rem)] font-semibold leading-none tracking-tight text-[var(--sync-text-primary)] [font-variant-numeric:tabular-nums]">
              {value}
            </p>
            <p className="max-w-[18ch] text-[13px] leading-6 text-[var(--sync-text-secondary)]">
              {helper}
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function DashboardPage() {
  const year = new Date().getUTCFullYear();
  const { data, isLoading } = useExecutiveDashboard(year);

  if (isLoading || !data) {
    return (
      <div className="space-y-5 pb-8">
        <PageHeader
          title="Dashboard executivo"
          description="Carregando projeções, faturamento bruto e desempenho anual."
        />
        <section className="px-8">
          <Card>
            <CardContent className="flex min-h-[320px] items-center justify-center p-8 text-sm text-[var(--sync-text-secondary)]">
              Carregando dashboard executivo...
            </CardContent>
          </Card>
        </section>
      </div>
    );
  }

  const projectedGrossRevenue = data.municipalities.reduce(
    (sum, municipality) => sum + municipality.estimatedAnnualRevenue * municipality.probability,
    0,
  );
  const weightedProfit = data.municipalities.reduce(
    (sum, municipality) => sum + municipality.estimatedAnnualProfit * municipality.probability,
    0,
  );
  const projectedMargin = projectedGrossRevenue > 0 ? weightedProfit / projectedGrossRevenue : 0;
  const implementationCoverage =
    data.kpis.citiesWorked > 0
      ? (data.kpis.citiesInImplementation + data.kpis.citiesFidelized) / data.kpis.citiesWorked
      : 0;

  const municipalityRanking = [...data.municipalities]
    .sort(
      (a, b) =>
        b.estimatedAnnualRevenue * b.probability - a.estimatedAnnualRevenue * a.probability,
    )
    .slice(0, 6)
    .map((municipality) => ({
      ...municipality,
      projectedRevenue: municipality.estimatedAnnualRevenue * municipality.probability,
      projectedProfit: municipality.estimatedAnnualProfit * municipality.probability,
    }));

  const portfolioMix = [
    { name: "Fidelizadas", value: data.kpis.citiesFidelized, color: "var(--sync-status-active)" },
    { name: "Em implantação", value: data.kpis.citiesInImplementation, color: "var(--sync-status-warning)" },
    {
      name: "Em operação",
      value: Math.max(
        0,
        data.kpis.citiesActive - data.kpis.citiesInImplementation - data.kpis.citiesFidelized,
      ),
      color: "var(--sync-status-info)",
    },
    {
      name: "Demais cidades",
      value: Math.max(0, data.kpis.citiesWorked - data.kpis.citiesActive),
      color: "var(--sync-accent-hover)",
    },
  ].filter((item) => item.value > 0);

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Dashboard executivo"
        description="Panorama geral da empresa com foco no faturamento bruto projetado do ano vigente."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link href="/people">Colaboradores</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/modules">Módulos</Link>
            </Button>
          </div>
        }
      />

      <section className="px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="sync-panel overflow-hidden rounded-[var(--sync-radius-xl)] border border-[var(--sync-border-subtle)] bg-[linear-gradient(135deg,var(--sync-bg-elevated)_0%,var(--sync-bg-surface)_55%,var(--sync-bg-elevated)_100%)]"
        >
          <div className="grid min-w-0 gap-5 p-5 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="min-w-0 space-y-4">
              <div className="space-y-2.5">
                <span className="inline-flex items-center rounded-full border border-[var(--sync-border-medium)] bg-[var(--sync-bg-surface)] px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-[var(--sync-text-secondary)]">
                  Ano vigente · visão consolidada
                </span>
                <div className="space-y-1.5">
                  <h2 className="text-[clamp(2rem,3vw,3.1rem)] font-semibold leading-none tracking-tight text-[var(--sync-text-primary)]">
                    {formatCurrency(projectedGrossRevenue)}
                  </h2>
                  <p className="max-w-3xl text-[15px] leading-7 text-[var(--sync-text-secondary)]">
                    Faturamento bruto projetado considerando as cidades já trabalhadas, o estágio atual do pipeline e as probabilidades financeiras registradas no sistema.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[var(--sync-radius-lg)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] p-3.5">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--sync-text-tertiary)]">
                      Faturamento bruto
                    </p>
                    <Landmark className="h-4 w-4 text-[var(--sync-text-secondary)]" />
                  </div>
                  <p className="text-[1.9rem] font-semibold leading-none text-[var(--sync-text-primary)]">
                    {formatCompactCurrency(projectedGrossRevenue)}
                  </p>
                  <p className="mt-2 text-[13px] text-[var(--sync-text-secondary)]">
                    projeção ponderada para {year}
                  </p>
                </div>

                <div className="rounded-[var(--sync-radius-lg)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] p-3.5">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--sync-text-tertiary)]">
                      Lucro projetado
                    </p>
                    <TrendingUp className="h-4 w-4 text-[var(--sync-text-secondary)]" />
                  </div>
                  <p className="text-[1.9rem] font-semibold leading-none text-[var(--sync-text-primary)]">
                    {formatCompactCurrency(weightedProfit)}
                  </p>
                  <p className="mt-2 text-[13px] text-[var(--sync-text-secondary)]">
                    retorno econômico ponderado
                  </p>
                </div>

                <div className="rounded-[var(--sync-radius-lg)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] p-3.5">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--sync-text-tertiary)]">
                      Margem projetada
                    </p>
                    <ArrowUpRight className="h-4 w-4 text-[var(--sync-text-secondary)]" />
                  </div>
                  <p className="text-[1.9rem] font-semibold leading-none text-[var(--sync-text-primary)]">
                    {(projectedMargin * 100).toFixed(1)}%
                  </p>
                  <p className="mt-2 text-[13px] text-[var(--sync-text-secondary)]">
                    margem sobre faturamento bruto
                  </p>
                </div>

                <div className="rounded-[var(--sync-radius-lg)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] p-3.5">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--sync-text-tertiary)]">
                      Cobertura operacional
                    </p>
                    <Building2 className="h-4 w-4 text-[var(--sync-text-secondary)]" />
                  </div>
                  <p className="text-[1.9rem] font-semibold leading-none text-[var(--sync-text-primary)]">
                    {(implementationCoverage * 100).toFixed(0)}%
                  </p>
                  <p className="mt-2 text-[13px] text-[var(--sync-text-secondary)]">
                    cidades em implantação ou fidelizadas
                  </p>
                </div>
              </div>
            </div>

            <div className="min-w-0">
              <Card className="h-full min-w-0 bg-[var(--sync-bg-primary)]/35">
                <CardHeader>
                  <CardTitle className="text-sm">Pulso financeiro mensal</CardTitle>
                  <CardDescription>
                    Receita e lucro do ano vigente em uma leitura compacta.
                  </CardDescription>
                </CardHeader>
                <CardContent className="min-w-0">
                  <div className="h-[280px] min-w-0">
                    <ResponsiveContainer width="100%" height="100%" minWidth={280}>
                      <AreaChart data={data.monthlyTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="dashboardRevenueFill" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="var(--sync-status-info)" stopOpacity={0.28} />
                            <stop offset="100%" stopColor="var(--sync-status-info)" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="dashboardProfitFill" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="var(--sync-status-active)" stopOpacity={0.22} />
                            <stop offset="100%" stopColor="var(--sync-status-active)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="var(--sync-border-subtle)" vertical={false} />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "var(--sync-text-tertiary)", fontSize: 12 }}
                          tickFormatter={(value) => String(value).padStart(2, "0")}
                        />
                        <YAxis hide />
                        <Tooltip content={<DashboardTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          name="Receita"
                          stroke="var(--sync-status-info)"
                          strokeWidth={2.2}
                          fill="url(#dashboardRevenueFill)"
                        />
                        <Area
                          type="monotone"
                          dataKey="profit"
                          name="Lucro"
                          stroke="var(--sync-status-active)"
                          strokeWidth={2}
                          fill="url(#dashboardProfitFill)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="grid gap-4 px-8 lg:grid-cols-5">
        <DashboardKpi
          label="Cidades trabalhadas"
          value={data.kpis.citiesWorked}
          helper={`municípios acompanhados em ${data.year}`}
          icon={<Building2 className="h-4 w-4" />}
        />
        <DashboardKpi
          label="Cidades fidelizadas"
          value={data.kpis.citiesFidelized}
          helper="base recorrente validada"
          icon={<TrendingUp className="h-4 w-4" />}
          index={1}
        />
        <DashboardKpi
          label="Lucro base YTD"
          value={formatCurrency(data.kpis.profitBaseYtd)}
          helper="resultado operacional considerado"
          icon={<Landmark className="h-4 w-4" />}
          index={2}
        />
        <DashboardKpi
          label="Comissão prevista"
          value={formatCurrency(data.kpis.commissionForecastYtd)}
          helper="acúmulo previsto no ano"
          icon={<CircleDollarSign className="h-4 w-4" />}
          index={3}
        />
        <DashboardKpi
          label="Próximo ciclo"
          value={formatCurrency(data.kpis.nextYearForecast)}
          helper="projeção do ano seguinte"
          icon={<ArrowUpRight className="h-4 w-4" />}
          index={4}
        />
      </section>

      <section className="grid gap-4 px-8 xl:grid-cols-[1.35fr_0.65fr]">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.3 }} className="min-w-0">
          <DashboardSection
            title="Receita, lucro e comissão no ano"
            description="Resultado mensal da operação para leitura financeira rápida."
            contentClassName="flex items-center"
          >
            <div className="h-[320px] min-w-0 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={320}>
                <BarChart data={data.monthlyTrend} barGap={10} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke="var(--sync-border-subtle)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--sync-text-tertiary)", fontSize: 12 }}
                    tickFormatter={(value) => String(value).padStart(2, "0")}
                  />
                  <YAxis hide />
                  <Tooltip content={<DashboardTooltip />} />
                  <Bar dataKey="revenue" name="Receita" radius={[6, 6, 0, 0]} fill="var(--sync-status-info)" />
                  <Bar dataKey="profit" name="Lucro" radius={[6, 6, 0, 0]} fill="var(--sync-status-active)" />
                  <Bar dataKey="commission" name="Comissão" radius={[6, 6, 0, 0]} fill="var(--sync-status-warning)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </DashboardSection>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.3 }} className="min-w-0">
          <DashboardSection
            title="Radar executivo"
            description="Pontos que exigem atenção imediata para não distorcer a projeção."
            contentClassName="flex flex-col justify-between gap-4"
          >
            <div className="flex h-full flex-col gap-4">
              {data.alerts.length === 0 ? (
                <div className="flex min-h-[124px] items-center rounded-[var(--sync-radius-lg)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] p-4 text-sm text-[var(--sync-text-secondary)]">
                  Nenhum alerta crítico encontrado na carteira atual.
                </div>
              ) : (
                data.alerts.map((alert) => (
                  <div
                    key={alert}
                    className="flex gap-3 rounded-[var(--sync-radius-lg)] border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{alert}</span>
                  </div>
                ))
              )}

              <div className="rounded-[var(--sync-radius-lg)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] p-4">
                <p className="text-xs uppercase tracking-wider text-[var(--sync-text-tertiary)]">
                  Resultado médio por cidade
                </p>
                <p className="mt-2 text-2xl font-semibold text-[var(--sync-text-primary)]">
                  {formatCompactCurrency(data.kpis.averageProfitPerCity)}
                </p>
                <p className="mt-2 text-sm text-[var(--sync-text-secondary)]">
                  Média de retorno da base operacional ativa no ano vigente.
                </p>
              </div>
            </div>
          </DashboardSection>
        </motion.div>
      </section>

      <section className="grid gap-4 px-8 xl:grid-cols-[0.9fr_1.1fr]">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.3 }} className="min-w-0">
          <DashboardSection
            title="Composição da carteira"
            description="Distribuição da base municipal entre fidelização, implantação e operação."
            contentClassName="flex items-center"
          >
            {portfolioMix.length === 0 ? (
              <div className="flex min-h-[240px] w-full items-center rounded-[var(--sync-radius-lg)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] p-4 text-sm text-[var(--sync-text-secondary)]">
                Ainda não há cidades suficientes para compor o gráfico.
              </div>
            ) : (
              <div className="grid min-w-0 w-full items-center gap-6 lg:grid-cols-[0.8fr_1.2fr]">
                <div className="h-[240px] min-w-0">
                  <ResponsiveContainer width="100%" height="100%" minWidth={220}>
                    <PieChart>
                      <Pie
                        data={portfolioMix}
                        innerRadius={52}
                        outerRadius={86}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                      >
                        {portfolioMix.map((item) => (
                          <Cell key={item.name} fill={item.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<DashboardTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-3">
                  {portfolioMix.map((item) => (
                    <div
                      key={item.name}
                      className="rounded-[var(--sync-radius-lg)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-sm text-[var(--sync-text-secondary)]">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          {item.name}
                        </span>
                        <strong className="text-[var(--sync-text-primary)]">{item.value}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </DashboardSection>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.3 }} className="min-w-0">
          <DashboardSection
            title="Cidades com maior projeção"
            description="Prioridades financeiras da carteira atual com base na receita ponderada."
            contentClassName="flex"
          >
            {municipalityRanking.length === 0 ? (
              <div className="flex min-h-[240px] w-full items-center rounded-[var(--sync-radius-lg)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] p-4 text-sm text-[var(--sync-text-secondary)]">
                Ainda não há cidades com projeção suficiente para destacar nesta visão.
              </div>
            ) : (
              <div className="flex w-full flex-col gap-3">
                {municipalityRanking.map((municipality) => (
                  <div
                    key={municipality.id}
                    className="rounded-[var(--sync-radius-lg)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--sync-text-primary)]">
                          {municipality.municipalityName}/{municipality.state}
                        </p>
                        <p className="mt-1 text-xs text-[var(--sync-text-tertiary)]">
                          {formatStageLabel(municipality.stage)} · {(municipality.probability * 100).toFixed(0)}% de probabilidade
                        </p>
                      </div>
                      <span className="text-sm font-medium text-[var(--sync-text-primary)]">
                        {formatCompactCurrency(municipality.projectedRevenue)}
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--sync-bg-primary)]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(8, municipality.probability * 100)}%` }}
                        transition={{ duration: 0.45, ease: "easeOut" }}
                        className="h-full rounded-full bg-[var(--sync-accent-hover)]"
                      />
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-[var(--sync-text-secondary)] sm:grid-cols-2">
                      <span>
                        Lucro ponderado:{" "}
                        <strong className="text-[var(--sync-text-primary)]">
                          {formatCurrency(municipality.projectedProfit)}
                        </strong>
                      </span>
                      <span>
                        Colaborador:{" "}
                        <strong className="text-[var(--sync-text-primary)]">
                          {municipality.collaboratorName ?? "--"}
                        </strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashboardSection>
        </motion.div>
      </section>
    </div>
  );
}
