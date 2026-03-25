"use client";

import { useState } from "react";
import { MunicipioSelector } from "./municipio-selector";
import { FundebMetricsCards } from "./fundeb-metrics-cards";
import { FundebEvolutionCharts } from "./fundeb-evolution-charts";
import { CaseSucessoImpactCard } from "./case-sucesso-impact-card";
import { useCaseSucessoData } from "../hooks/use-case-sucesso";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { FileDown } from "lucide-react";
import { generateCaseSucessoPdf } from "../utils/generate-case-sucesso-pdf";

export function CaseSucessoDashboard() {
    const [selectedMunicipio, setSelectedMunicipio] = useState<string | null>(null);
    const { data, isLoading } = useCaseSucessoData(selectedMunicipio);
    const canExport = !!data && !!selectedMunicipio && !isLoading;

    const handleExportPdf = async () => {
        if (!data) return;
        await generateCaseSucessoPdf(data);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="w-full max-w-lg">
                    <MunicipioSelector
                        onSelect={setSelectedMunicipio}
                        selectedMunicipio={selectedMunicipio}
                    />
                </div>
                <div className="flex justify-end">
                    <Button
                        variant="outline"
                        className="gap-2"
                        disabled={!canExport}
                        onClick={handleExportPdf}
                    >
                        <FileDown className="h-4 w-4" />
                        Gerar PDF
                    </Button>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {!selectedMunicipio ? (
                    <motion.div
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <EmptyState
                            icon={<Search className="h-10 w-10 text-[var(--sync-text-tertiary)]" />}
                            title="Aguardando seleção"
                            description="Digite ou selecione um município acima para visualizar a evolução financeira do FUNDEB."
                        />
                    </motion.div>
                ) : isLoading ? (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex h-64 flex-col items-center justify-center space-y-4"
                    >
                        <Loader2 className="h-8 w-8 animate-spin text-[var(--sync-accent)]" />
                        <p className="text-sm text-[var(--sync-text-secondary)]">Carregando dados comparativos...</p>
                    </motion.div>
                ) : data ? (
                    <motion.div
                        key="dashboard"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-8"
                    >
                        <FundebMetricsCards data={data} />

                        <FundebEvolutionCharts data={data} />

                        <CaseSucessoImpactCard data={data} />

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-medium">Observações Analíticas</CardTitle>
                                <CardDescription>{`Principais variações entre ${data.baseYear} e ${data.targetYear}.`}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="prose prose-invert max-w-none text-sm text-[var(--sync-text-secondary)]">
                                    <p>
                                        A evolução das <strong>Receitas Totais do FUNDEB</strong> para o município de <strong>{selectedMunicipio}</strong>
                                        apresenta uma variação de <span className={data.deltas.total >= 0 ? "text-emerald-500 font-bold" : "text-red-500 font-bold"}>
                                            {data.deltas.total.toFixed(2)}%
                                        </span> em relação a {data.baseYear}.
                                    </p>
                                    <ul className="mt-2 list-disc pl-5 space-y-1">
                                        <li>VAAF: {data.deltas.vaaf.toFixed(2)}%</li>
                                        <li>VAAT: {data.deltas.vaat.toFixed(2)}%</li>
                                        <li>VAAR: {data.deltas.vaar.toFixed(2)}%</li>
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </div>
    );
}
