"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFirebaseDb } from '@/core/lib/firebase-client';
import { useAuth } from '@/core/providers/auth-provider';
import type { CollaboratorItem, LinkFilter } from '@/core/lib/people-types';
import {
  listCollaborators,
  createCollaborator,
} from '@/core/lib/collaborators-firestore';
import { PeopleKpis } from './_components/people-kpis';
import { PeopleTable } from './_components/people-table';
import { CollaboratorDetailPanel } from './_components/collaborator-detail-panel';
import { NewCollaboratorDialog } from './_components/new-collaborator-dialog';

const DEFAULT_GROUP_ID = 'default';

export default function PessoasPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const db = getFirebaseDb();
  const groupId = user?.groupId || DEFAULT_GROUP_ID;

  const [search, setSearch] = useState('');
  const [linkFilter, setLinkFilter] = useState<LinkFilter>('todos');
  const [selectedCollaborator, setSelectedCollaborator] =
    useState<CollaboratorItem | null>(null);
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);

  const { data: collaborators = [], isLoading } = useQuery<CollaboratorItem[]>({
    queryKey: ['collaborators', groupId, search, linkFilter],
    queryFn: () => listCollaborators(db, groupId, { search, linkFilter }),
  });

  const createMutation = useMutation({
    mutationFn: (input: Partial<CollaboratorItem> & { fullName: string }) =>
      createCollaborator(db, groupId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
    },
  });

  // Calculate KPIs
  const totalPeople = collaborators.length;
  const activeCount = collaborators.filter(
    (c) => c.partnershipStatus === 'ativo'
  ).length;
  const totalCommissionsYtd = collaborators.reduce(
    (sum, c) => sum + (c.commissionPaidYtd || 0),
    0
  );

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      <div className="flex flex-1 flex-col overflow-y-auto p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-sans text-[22px] font-bold text-title tracking-[-0.5px]">
              Pessoas e Colaboradores
            </h1>
            <p className="font-mono text-[12px] text-soft">
              Gestão de equipe interna, consultores parceiros e comissões.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsNewDialogOpen(true)}
            className="inline-flex items-center gap-2 rounded-[8px] bg-primary px-4 py-2 font-mono text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-primary-strong self-start sm:self-auto"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nova Pessoa
          </button>
        </div>

        {/* KPIs */}
        <PeopleKpis
          totalPeople={totalPeople}
          activeCount={activeCount}
          totalCommissionsYtd={totalCommissionsYtd}
        />

        {/* Toolbar: Search + LinkFilter */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          {/* Link filter tabs */}
          <div className="flex rounded-[8px] bg-surface-subtle border border-line p-1 w-full sm:w-auto">
            {(['todos', 'parceiros', 'internos'] as LinkFilter[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setLinkFilter(tab)}
                className={`flex-1 sm:flex-initial px-3 py-1 font-mono text-[11px] font-semibold capitalize rounded-[6px] transition-colors ${
                  linkFilter === tab
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
              placeholder="Buscar por nome, função, UF..."
              className="w-full rounded-[8px] border border-line-input bg-card pl-9 pr-3 py-1.5 font-mono text-[12px] text-body placeholder:text-muted focus:border-primary focus:outline-none"
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
          <PeopleTable
            collaborators={collaborators}
            selectedId={selectedCollaborator?.id}
            onSelect={(item) => setSelectedCollaborator(item)}
          />
        )}
      </div>

      {/* Detail Slide-in Panel */}
      {selectedCollaborator && (
        <CollaboratorDetailPanel
          collaborator={selectedCollaborator}
          onClose={() => setSelectedCollaborator(null)}
        />
      )}

      {/* New Collaborator Dialog */}
      {isNewDialogOpen && (
        <NewCollaboratorDialog
          onClose={() => setIsNewDialogOpen(false)}
          onSubmit={async (input) => {
            await createMutation.mutateAsync(input);
          }}
        />
      )}
    </div>
  );
}
