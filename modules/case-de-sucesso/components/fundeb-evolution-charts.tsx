"use client";

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FundebEvolution } from "../types/case-sucesso";

interface FundebEvolutionChartsProps {
    data: FundebEvolution;
}

export function FundebEvolutionCharts({ data }: FundebEvolutionChartsProps) {
    const preBaseYearLabel = data.preBaseYear ? String(data.preBaseYear) : null;
    const baseYearLabel = String(data.baseYear);
    const targetYearLabel = String(data.targetYear);

    const chartData = [
        {
            name: "VAAF",
            ...(preBaseYearLabel ? { [preBaseYearLabel]: data.dataPreBase?.vaaf || 0 } : {}),
            [baseYearLabel]: data.dataBase?.vaaf || 0,
            [targetYearLabel]: data.dataTarget?.vaaf || 0,
        },
        {
            name: "VAAT",
            ...(preBaseYearLabel ? { [preBaseYearLabel]: data.dataPreBase?.vaat || 0 } : {}),
            [baseYearLabel]: data.dataBase?.vaat || 0,
            [targetYearLabel]: data.dataTarget?.vaat || 0,
        },
        {
            name: "VAAR",
            ...(preBaseYearLabel ? { [preBaseYearLabel]: data.dataPreBase?.vaar || 0 } : {}),
            [baseYearLabel]: data.dataBase?.vaar || 0,
            [targetYearLabel]: data.dataTarget?.vaar || 0,
        },
        {
            name: "Receitas Totais",
            ...(preBaseYearLabel ? { [preBaseYearLabel]: data.dataPreBase?.total || 0 } : {}),
            [baseYearLabel]: data.dataBase?.total || 0,
            [targetYearLabel]: data.dataTarget?.total || 0,
        },
    ];

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
            notation: "compact",
        }).format(value);
    };

    return (
        <div className="grid gap-4 md:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium">{`Comparativo ${data.baseYear} vs ${data.targetYear}`}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--sync-border-subtle)" />
                                <XAxis
                                    dataKey="name"
                                    stroke="var(--sync-text-tertiary)"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="var(--sync-text-tertiary)"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={formatCurrency}
                                />
                                <Tooltip
                                    cursor={{ fill: "var(--sync-bg-surface)" }}
                                    contentStyle={{
                                        backgroundColor: "var(--sync-bg-elevated)",
                                        borderColor: "var(--sync-border-subtle)",
                                        fontSize: "12px"
                                    }}
                                    itemStyle={{ color: "var(--sync-text-primary)" }}
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    formatter={(value: any) => [new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0), ""]}
                                />
                                <Legend iconType="circle" wrapperStyle={{ fontSize: "12px", paddingTop: "20px" }} />
                                {preBaseYearLabel && (
                                    <Bar dataKey={preBaseYearLabel} fill="var(--sync-bg-surface)" stroke="var(--sync-text-tertiary)" radius={[4, 4, 0, 0]} barSize={32} />
                                )}
                                <Bar dataKey={baseYearLabel} fill="var(--sync-text-tertiary)" radius={[4, 4, 0, 0]} barSize={32} />
                                <Bar dataKey={targetYearLabel} fill="var(--sync-accent)" radius={[4, 4, 0, 0]} barSize={32} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium">{`Distribuicao por Componente (${data.targetYear})`}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                layout="vertical"
                                data={chartData.filter(d => d.name !== "Receitas Totais")}
                                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--sync-border-subtle)" />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    stroke="var(--sync-text-tertiary)"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    cursor={{ fill: "var(--sync-bg-surface)" }}
                                    contentStyle={{
                                        backgroundColor: "var(--sync-bg-elevated)",
                                        borderColor: "var(--sync-border-subtle)",
                                        fontSize: "12px"
                                    }}
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    formatter={(value: any) => [new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0), String(data.targetYear)]}
                                />
                                <Bar dataKey={targetYearLabel} fill="var(--sync-accent)" radius={[0, 4, 4, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
