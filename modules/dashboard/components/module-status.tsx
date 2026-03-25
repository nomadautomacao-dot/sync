"use client";

import { moduleCatalog } from "@/core/domain/module";
import { useCompanies } from "@/core/hooks/use-companies";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ModuleStatus() {
  const { data: companies = [] } = useCompanies();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status dos modulos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {moduleCatalog.map((module) => {
          const enabledIn = companies.filter((company) =>
            company.enabledModules.includes(module.key),
          ).length;
          return (
            <div
              key={module.key}
              className="flex items-center justify-between rounded-[var(--sync-radius-md)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] px-3 py-2"
            >
              <div>
                <p className="text-sm text-[var(--sync-text-primary)]">{module.label}</p>
                <p className="text-xs text-[var(--sync-text-tertiary)]">{module.description}</p>
              </div>
              <p className="text-xs font-semibold text-[var(--sync-text-secondary)]">
                {enabledIn} empresas
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
