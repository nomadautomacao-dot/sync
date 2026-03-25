"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowRight, ShieldCheck, History, TrendingUp } from "lucide-react";
import type { FundebEvolution } from "../types/case-sucesso";

interface CaseSucessoImpactCardProps {
    data: FundebEvolution;
}

export function CaseSucessoImpactCard({ data }: CaseSucessoImpactCardProps) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
            notation: "compact",
            maximumFractionDigits: 2,
        }).format(value);
    };

    return (
        <Card className="overflow-hidden border-[var(--sync-accent)]/30 bg-gradient-to-br from-[var(--sync-bg-elevated)] to-[var(--sync-bg-surface)] shadow-lg">
            <CardHeader className="border-b border-[var(--sync-border-subtle)]/50 pb-4">
                <div className="flex items-center gap-2 text-[var(--sync-accent)]">
                    <TrendingUp className="h-5 w-5" />
                    <CardTitle className="text-lg font-bold">Resumo de Impacto — Gestão Sync</CardTitle>
                </div>
                <CardDescription>
                    Comparativo direto dos valores antes e após a assunção do controle.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {/* Antes da Gestão */}
                    <div className="relative space-y-3 rounded-xl border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)]/50 p-5">
                        <div className="flex items-center gap-2 text-[var(--sync-text-secondary)]">
                            <History className="h-4 w-4" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--sync-text-tertiary)]">Cenário Anterior ({data.baseYear})</span>
                        </div>
                        <div className="space-y-1">
                            <p className="text-3xl font-bold text-[var(--sync-text-secondary)] opacity-80">
                                {formatCurrency(data.dataBase?.total || 0)}
                            </p>
                            <p className="text-[11px] text-[var(--sync-text-tertiary)]">Arrecadação base sem intervenção estratégica</p>
                        </div>
                        <div className="absolute -right-4 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-elevated)] p-1 text-[var(--sync-text-tertiary)] lg:block shadow-sm">
                            <ArrowRight className="h-4 w-4" />
                        </div>
                    </div>

                    {/* Após a Gestão */}
                    <div className="relative space-y-3 rounded-xl border border-[var(--sync-accent)]/50 bg-[var(--sync-accent)]/5 p-5 shadow-[0_0_20px_rgba(var(--sync-accent-rgb),0.05)]">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-[var(--sync-accent)]">
                                <ShieldCheck className="h-4 w-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Gestão Sync ({data.targetYear})</span>
                            </div>
                            {data.deltas.total > 0 && (
                                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-500 border border-emerald-500/20">
                                    CASO DE SUCESSO
                                </span>
                            )}
                        </div>
                        <div className="space-y-1">
                            <p className="text-3xl font-black text-[var(--sync-text-primary)]">
                                {formatCurrency(data.dataTarget?.total || 0)}
                            </p>
                            <p className="text-[11px] text-[var(--sync-accent)] font-medium">Otimização máxima de recursos alcançada</p>
                        </div>
                    </div>

                    {/* Indicador de Evolução */}
                    <div className="flex flex-col justify-center space-y-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 p-4">
                        <div className="space-y-1">
                            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-500">Evolução Real</span>
                            <div className="flex items-baseline gap-2">
                                <p className="text-4xl font-black text-emerald-500">
                                    {data.deltas.total >= 0 ? "+" : ""}{data.deltas.total.toFixed(2)}%
                                </p>
                            </div>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-emerald-500/10">
                            <div
                                className="h-full bg-emerald-500 transition-all duration-1000"
                                style={{ width: `${Math.min(Math.max(data.deltas.total, 0), 100)}%` }}
                            />
                        </div>
                        <p className="text-[10px] italic text-emerald-500/70">
                            * Variação baseada na melhoria dos critérios técnicos (VAAF, VAAT, VAAR).
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
