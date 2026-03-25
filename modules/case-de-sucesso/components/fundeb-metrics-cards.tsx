"use client";

import { StatCard } from "@/components/shared/stat-card";
import { TrendingUp, DollarSign } from "lucide-react";
import type { FundebEvolution } from "../types/case-sucesso";

interface FundebMetricsCardsProps {
    data: FundebEvolution;
}

export function FundebMetricsCards({ data }: FundebMetricsCardsProps) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
        }).format(value);
    };

    const formatDelta = (delta: number) => {
        const isPositive = delta >= 0;
        return (
            <span className={isPositive ? "text-emerald-500" : "text-red-500"}>
                {isPositive ? "+" : ""}{delta.toFixed(2)}% em relacao a {data.baseYear}
            </span>
        );
    };

    const metrics = [
        {
            label: `Total Receitas FUNDEB (${data.targetYear})`,
            value: formatCurrency(data.dataTarget?.total || 0),
            helper: formatDelta(data.deltas.total),
            icon: <DollarSign className="h-4 w-4" />,
        },
        {
            label: `VAAF (${data.targetYear})`,
            value: formatCurrency(data.dataTarget?.vaaf || 0),
            helper: formatDelta(data.deltas.vaaf),
            icon: <TrendingUp className="h-4 w-4" />,
        },
        {
            label: `VAAT (${data.targetYear})`,
            value: formatCurrency(data.dataTarget?.vaat || 0),
            helper: formatDelta(data.deltas.vaat),
            icon: <TrendingUp className="h-4 w-4" />,
        },
        {
            label: `VAAR (${data.targetYear})`,
            value: formatCurrency(data.dataTarget?.vaar || 0),
            helper: formatDelta(data.deltas.vaar),
            icon: <TrendingUp className="h-4 w-4" />,
        },
    ];

    return (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            {metrics.map((metric, i) => (
                <StatCard
                    key={metric.label}
                    label={metric.label}
                    value={metric.value}
                    helper={metric.helper}
                    icon={metric.icon}
                    index={i}
                />
            ))}
        </div>
    );
}
