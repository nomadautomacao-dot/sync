"use client";

import { useState } from "react";
import { moduleCatalog, type ModuleKey } from "@/core/domain/module";
import { useWorkspaceStore } from "@/core/stores/workspace-store";
import { ModuleIcon } from "@/components/shared/module-icon";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConsultoriaPage } from "@/modules/consultoria/consultoria-page";
import { FundebPage } from "@/modules/fundeb/fundeb-page";
import { LevantamentoFundebPage } from "@/modules/levantamento-fundeb/levantamento-fundeb-page";
import { CaseDeSucessoPage } from "@/modules/case-de-sucesso/case-de-sucesso-page";
import { PropostasPage } from "@/modules/propostas/propostas-page";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft } from "lucide-react";

export default function ModulesPage() {
  const [activeTab, setActiveTab] = useState<ModuleKey | null>(null);
  const { setActiveModule } = useWorkspaceStore();

  const handleSelectModule = (key: ModuleKey) => {
    setActiveTab(key);
    setActiveModule(key);
  };

  const handleBack = () => {
    setActiveTab(null);
    setActiveModule(undefined);
  };

  return (
    <div className="relative min-h-[calc(100vh-120px)] w-full overflow-x-hidden px-4 py-8 md:px-6 md:py-10 lg:px-8 xl:px-10">
      <div className={activeTab ? "w-full" : "mx-auto max-w-screen-xl"}>
        <AnimatePresence mode="wait">
          {!activeTab ? (
            <motion.div
              key="catalog"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="space-y-8"
            >
              <div className="space-y-2">
                <PageHeader
                  title="Catálogo de Módulos"
                  description="Selecione um serviço para gerenciar as operações da sua empresa."
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {moduleCatalog.map((module, index) => (
                  <motion.button
                    key={module.key}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleSelectModule(module.key)}
                    className="group block text-left outline-none"
                  >
                    <Card className="h-full border-[var(--sync-border-subtle)] bg-[var(--sync-bg-elevated)]/30 transition-all duration-300 hover:border-[var(--sync-accent)] hover:shadow-[var(--sync-shadow-glow)] group-hover:translate-y-[-4px]">
                      <CardHeader className="p-5">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--sync-bg-surface)] text-[var(--sync-accent)] border border-[var(--sync-border-subtle)] group-hover:border-[var(--sync-accent)] transition-all duration-300 shadow-sm">
                          <ModuleIcon moduleKey={module.key} className="h-6 w-6" />
                        </div>
                        <CardTitle className="text-xl font-bold group-hover:text-[var(--sync-accent)] transition-colors">
                          {module.label}
                        </CardTitle>
                        <CardDescription className="line-clamp-2 mt-2 leading-relaxed text-[var(--sync-text-secondary)]">
                          {module.description}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="module-content"
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.4, ease: "circOut" }}
              className="flex flex-col space-y-4"
            >
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  className="hover:bg-[var(--sync-bg-surface)]"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Voltar ao Catálogo
                </Button>
                <div className="h-4 w-px bg-[var(--sync-border-subtle)]" />
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--sync-text-secondary)]">
                  <ModuleIcon moduleKey={activeTab} className="h-4 w-4" />
                  <span>{moduleCatalog.find(m => m.key === activeTab)?.label}</span>
                </div>
              </div>

              <div className="sync-panel overflow-hidden rounded-[var(--sync-radius-xl)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-elevated)]/50 p-4 md:p-6 lg:p-8 shadow-xl backdrop-blur-sm transition-all duration-500">
                <div className={activeTab === "case-de-sucesso" ? "w-full" : "mx-auto max-w-7xl"}>
                  {activeTab === "consultoria" && <ConsultoriaPage />}
                  {activeTab === "fundeb" && <FundebPage />}
                  {activeTab === "levantamento-fundeb" && <LevantamentoFundebPage />}
                  {activeTab === "case-de-sucesso" && <CaseDeSucessoPage />}
                  {activeTab === "propostas" && <PropostasPage />}

                  {!["consultoria", "fundeb", "levantamento-fundeb", "case-de-sucesso", "propostas"].includes(activeTab) && (
                    <div className="flex min-h-[450px] flex-col items-center justify-center text-center">
                      <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="mb-6 rounded-3xl bg-[var(--sync-bg-surface)] p-8 shadow-inner"
                      >
                        <ModuleIcon moduleKey={activeTab} className="h-16 w-16 text-[var(--sync-accent)]" />
                      </motion.div>
                      <h3 className="text-2xl font-bold text-[var(--sync-text-primary)]">Módulo em Preparação</h3>
                      <p className="mt-4 max-w-md text-base text-[var(--sync-text-secondary)] leading-relaxed">
                        Estamos preparando as ferramentas operacionais para o módulo <span className="text-[var(--sync-accent)] font-bold">{moduleCatalog.find(m => m.key === activeTab)?.label}</span>.
                        Fique atento às próximas atualizações da plataforma Sync.
                      </p>
                      <Button variant="outline" size="lg" className="mt-8 rounded-full px-8" onClick={handleBack}>
                        Voltar ao Catálogo
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
