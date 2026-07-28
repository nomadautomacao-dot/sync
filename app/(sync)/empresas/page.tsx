"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFirebaseDb } from '@/core/lib/firebase-client';
import { useAuth } from '@/core/providers/auth-provider';
import type { CompanyItem } from '@/core/lib/company-types';
import {
  listCompanies,
  createCompany,
} from '@/core/lib/companies-firestore';
import { CompanyKpis } from './_components/company-kpis';
import { CompanyTable } from './_components/company-table';
import { CompanyDetailPanel } from './_components/company-detail-panel';
import { NewCompanyDialog } from './_components/new-company-dialog';

const DEFAULT_GROUP_ID = 'default';

export default function EmpresasPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const db = getFirebaseDb();
  const groupId = user?.groupId || DEFAULT_GROUP_ID;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [selectedCompany, setSelectedCompany] = useState<CompanyItem | null>(null);
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);

  const { data: companies = [], isLoading } = useQuery<CompanyItem[]>({
    queryKey: ['companies', groupId, search, statusFilter],
    queryFn: () => listCompanies(db, groupId, { search, status: statusFilter }),
  });

  const createMutation = useMutation({
    mutationFn: (input: Partial<CompanyItem> & { cnpj: string; razaoSocial: string }) =>
      createCompany(db, groupId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
  });

  // Calculate KPIs
  const totalCompanies = companies.length;
  const totalEmployees = companies.reduce(
    (sum, c) => sum + (c.employeeCount || 0),
    0
  );
  const totalActiveModules = Array.from(
    new Set(companies.flatMap((c) => c.activeModules))
  ).length;

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      <div className="flex flex-1 flex-col overflow-y-auto p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-sans text-[22px] font-bold text-title tracking-[-0.5px]">
              Empresas do Grupo
            </h1>
            <p className="font-mono text-[12px] text-soft">
              Gestão de entidades do grupo, CNPJs, quadro de colaboradores e módulos ativados.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsNewDialogOpen(true)}
            className="inline-flex items-center gap-2 rounded-[20px] bg-[#16181D] px-4 py-2 font-mono text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-primary-strong self-start sm:self-auto"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nova Empresa
          </button>
        </div>

        {/* KPIs */}
        <CompanyKpis
          totalCompanies={totalCompanies}
          totalEmployees={totalEmployees}
          totalActiveModules={totalActiveModules}
        />

        {/* Toolbar: Search + Status Filter */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          {/* Status filter tabs */}
          <div className="flex rounded-[8px] bg-surface-subtle border border-line p-1 w-full sm:w-auto">
            {['todos', 'ativo', 'inativo'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`flex-1 sm:flex-initial px-3 py-1 font-mono text-[11px] font-semibold capitalize rounded-[6px] transition-colors ${
                  statusFilter === tab
                    ? 'bg-card text-primary-strong shadow-sm'
                    : 'text-muted hover:text-body'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por razão, CNPJ, responsável..."
              className="w-full rounded-[24px] border border-white/90 bg-[#F2F1F7] pl-9 pr-3 py-1.5 font-mono text-[12px] text-body placeholder:text-[#A2A6B2] focus:border-primary focus:outline-none"
            />
            <svg
              className="absolute left-3 top-2.5 text-muted"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>
        </div>

        {/* Table / Content */}
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <CompanyTable
            companies={companies}
            selectedId={selectedCompany?.id}
            onSelect={(item) => setSelectedCompany(item)}
          />
        )}
      </div>

      {/* Detail Slide-in Panel */}
      {selectedCompany && (
        <CompanyDetailPanel
          company={selectedCompany}
          onClose={() => setSelectedCompany(null)}
        />
      )}

      {/* New Company Dialog */}
      {isNewDialogOpen && (
        <NewCompanyDialog
          onClose={() => setIsNewDialogOpen(false)}
          onSubmit={async (input) => {
            await createMutation.mutateAsync(input);
          }}
        />
      )}
    </div>
  );
}
