"use client";

import { Activity, Building2, ClipboardList, Users } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { useAudit } from "@/core/hooks/use-audit";
import { useCompanies } from "@/core/hooks/use-companies";
import { useEmployees } from "@/core/hooks/use-employees";

export function GroupOverview() {
  const { data: companies = [] } = useCompanies();
  const { data: employees = [] } = useEmployees();
  const { data: audit = [] } = useAudit(50);

  const activeCompanies = companies.filter((company) => company.status === "active").length;
  const activeEmployees = employees.filter((employee) => employee.status === "active").length;

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Empresas"
        value={companies.length}
        helper={`${activeCompanies} ativas`}
        icon={<Building2 className="h-4 w-4" />}
        index={0}
      />
      <StatCard
        label="Funcionarios"
        value={employees.length}
        helper={`${activeEmployees} ativos`}
        icon={<Users className="h-4 w-4" />}
        index={1}
      />
      <StatCard
        label="Eventos"
        value={audit.length}
        helper="Auditoria consolidada"
        icon={<Activity className="h-4 w-4" />}
        index={2}
      />
      <StatCard
        label="Backlog"
        value={Math.max(0, 28 - activeEmployees)}
        helper="Estimativa operacional"
        icon={<ClipboardList className="h-4 w-4" />}
        index={3}
      />
    </section>
  );
}
