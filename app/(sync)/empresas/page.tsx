"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusOutlined } from "@ant-design/icons";
import { Button, Flex, Result, Skeleton, Typography } from "antd";

import { getFirebaseDb } from "@/core/lib/firebase-client";
import { useAuth } from "@/core/providers/auth-provider";
import type { CompanyItem } from "@/core/lib/company-types";
import { listCompanies, createCompany } from "@/core/lib/companies-firestore";

import { CompanyKpis } from "./_components/company-kpis";
import { CompanyTable } from "./_components/company-table";
import { CompanyDetailPanel } from "./_components/company-detail-panel";
import { NewCompanyDialog } from "./_components/new-company-dialog";

const DEFAULT_GROUP_ID = "default";

export default function EmpresasPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const db = getFirebaseDb();
  const groupId = user?.groupId || DEFAULT_GROUP_ID;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [selectedCompany, setSelectedCompany] = useState<CompanyItem | null>(null);
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);

  const {
    data: companies = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<CompanyItem[]>({
    queryKey: ["companies", groupId, search, statusFilter],
    queryFn: () => listCompanies(db, groupId, { search, status: statusFilter }),
  });

  const createMutation = useMutation({
    mutationFn: (input: Partial<CompanyItem> & { cnpj: string; razaoSocial: string }) =>
      createCompany(db, groupId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });

  // KPIs sobre o mesmo conjunto exibido na tabela — reagem à busca e ao
  // filtro de status como já reagiam antes da migração.
  const totalCompanies = companies.length;
  const totalEmployees = companies.reduce((sum, c) => sum + (c.employeeCount || 0), 0);
  const totalActiveModules = Array.from(
    new Set(companies.flatMap((c) => c.activeModules)),
  ).length;

  if (isError) {
    return (
      <Result
        status="warning"
        title="Não foi possível carregar as empresas"
        subTitle="Verifique a conexão e tente novamente."
        extra={
          <Button type="primary" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        }
      />
    );
  }

  return (
    <Flex vertical gap={20}>
      <Flex align="center" justify="space-between" wrap="wrap" gap={12}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Empresas do Grupo
          </Typography.Title>
          <Typography.Text type="secondary">
            Gestão de entidades do grupo, CNPJs, quadro de colaboradores e módulos ativados.
          </Typography.Text>
        </div>

        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsNewDialogOpen(true)}>
          Nova Empresa
        </Button>
      </Flex>

      <CompanyKpis
        totalCompanies={totalCompanies}
        totalEmployees={totalEmployees}
        totalActiveModules={totalActiveModules}
      />

      {isLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <CompanyTable
          companies={companies}
          selectedId={selectedCompany?.id}
          onSelect={(item) => setSelectedCompany(item)}
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />
      )}

      <CompanyDetailPanel
        company={selectedCompany}
        onClose={() => setSelectedCompany(null)}
      />

      <NewCompanyDialog
        open={isNewDialogOpen}
        onClose={() => setIsNewDialogOpen(false)}
        onSubmit={async (input) => {
          await createMutation.mutateAsync(input);
        }}
      />
    </Flex>
  );
}
