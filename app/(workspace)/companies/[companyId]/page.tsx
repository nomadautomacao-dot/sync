"use client";

import { useEffect } from "react";
import { ModuleConfigForm } from "@/components/forms/module-config-form";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { useCompany } from "@/core/hooks/use-companies";
import { useEmployees } from "@/core/hooks/use-employees";
import { useWorkspaceStore } from "@/core/stores/workspace-store";
import type { Employee } from "@/core/domain/organization";

interface CompanyDetailsPageProps {
  params: { companyId: string };
}

export default function CompanyDetailsPage({ params }: CompanyDetailsPageProps) {
  const { companyId } = params;
  return <CompanyDetailsContent companyId={companyId} />;
}

function CompanyDetailsContent({ companyId }: { companyId: string }) {
  const { data: company, isLoading } = useCompany(companyId);
  const { data: employees = [] } = useEmployees({ companyId });
  const { setActiveCompany } = useWorkspaceStore();

  useEffect(() => {
    setActiveCompany(companyId);
    return () => setActiveCompany(undefined);
  }, [companyId, setActiveCompany]);

  if (isLoading) {
    return <LoadingState rows={5} />;
  }

  if (!company) {
    return (
      <EmptyState
        title="Empresa nao encontrada"
        description="Verifique o identificador informado ou volte para a lista de empresas."
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={company.tradingName}
        description={company.segment}
        actions={<StatusBadge status={company.status} />}
      />

      <div className="grid gap-3 xl:grid-cols-2">
        <Card>
          <CardContent className="space-y-2 p-4 text-sm text-[var(--sync-text-secondary)]">
            <p>
              <span className="text-[var(--sync-text-tertiary)]">Razao social:</span>{" "}
              {company.name}
            </p>
            <p>
              <span className="text-[var(--sync-text-tertiary)]">CNPJ:</span> {company.cnpj}
            </p>
            <p>
              <span className="text-[var(--sync-text-tertiary)]">Status:</span>{" "}
              {company.status}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <ModuleConfigForm
              companyName={company.tradingName}
              initialModules={company.enabledModules}
            />
          </CardContent>
        </Card>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--sync-text-primary)]">
          Funcionarios vinculados
        </h2>
        {employees.length === 0 ? (
          <EmptyState
            title="Sem funcionarios nesta empresa"
            description="Cadastre funcionarios em Pessoas para iniciar operacao."
          />
        ) : (
          <DataTable
            data={employees}
            columns={[
              {
                header: "Nome",
                accessorKey: "name",
              },
              {
                header: "Email",
                accessorKey: "email",
              },
              {
                header: "Cargo",
                accessorKey: "position",
              },
              {
                header: "Perfil",
                accessorKey: "role",
              },
              {
                header: "Status",
                accessorKey: "status",
                cell: ({ row }: { row: { original: Employee } }) => (
                  <StatusBadge status={row.original.status} />
                ),
              },
            ]}
          />
        )}
      </section>
    </div>
  );
}
