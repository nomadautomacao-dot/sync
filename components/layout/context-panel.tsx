"use client";

import { Building2, Clock3, LayoutGrid, UserRound } from "lucide-react";
import { useMemo } from "react";
import { useAudit } from "@/core/hooks/use-audit";
import { useCompanies } from "@/core/hooks/use-companies";
import { moduleCatalog } from "@/core/domain/module";
import { formatDate } from "@/core/lib/utils";
import { useWorkspaceStore } from "@/core/stores/workspace-store";

export function ContextPanel() {
  const { activeCompanyId, activeModuleKey } = useWorkspaceStore();
  const { data: companies = [] } = useCompanies();
  const { data: audit = [] } = useAudit(8);

  const activeCompany = useMemo(
    () => companies.find((company) => company.id === activeCompanyId),
    [activeCompanyId, companies],
  );
  const activeModule = useMemo(
    () => moduleCatalog.find((module) => module.key === activeModuleKey),
    [activeModuleKey],
  );

  return (
    <aside className="hidden w-80 shrink-0 border-l border-neutral-800 bg-neutral-900 xl:flex xl:flex-col">
      <div className="px-6 py-6">
        <h3 className="text-sm font-semibold text-white">Contexto</h3>
        <p className="text-xs text-neutral-400">Detalhes e atividade recente</p>
      </div>
      <div className="space-y-6 overflow-y-auto px-6 pb-6">
        <section>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Selecoes ativas
          </h4>
          <div className="flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-800 p-4 text-sm text-neutral-400">
            <p className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-neutral-500" />
              {activeCompany ? activeCompany.tradingName : "Nenhuma empresa selecionada"}
            </p>
            <p className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-neutral-500" />
              {activeModule ? activeModule.label : "Nenhum modulo selecionado"}
            </p>
          </div>
        </section>

        <section>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Timeline
          </h4>
          <div className="space-y-2">
            {audit.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-3 rounded-lg border border-neutral-800 bg-neutral-950 p-4"
              >
                <UserRound className="mt-0.5 h-4 w-4 text-neutral-500" />
                <div>
                  <p className="text-sm text-neutral-200">{entry.action}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-neutral-500">
                    <Clock3 className="h-3 w-3" />
                    {formatDate(entry.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}
