"use client";

import { PageHeader } from "@/components/shared/page-header";
import { ContractSummary } from "@/modules/consultoria/components/contract-summary";
import { DeliverableTracker } from "@/modules/consultoria/components/deliverable-tracker";
import { ProjectDetail } from "@/modules/consultoria/components/project-detail";
import { ProjectList } from "@/modules/consultoria/components/project-list";

export function ConsultoriaPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Modulo Consultoria"
        description="Projetos, entregas e contratos por empresa."
      />
      <div className="grid gap-3 xl:grid-cols-2">
        <ProjectList />
        <ProjectDetail />
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        <DeliverableTracker />
        <ContractSummary />
      </div>
    </div>
  );
}
