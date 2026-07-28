"use client";

import React, { useState } from 'react';
import type { CollaboratorItem } from '@/core/lib/people-types';
import {
  collaboratorInitials,
  collaboratorLinkCategory,
  statusTone,
  formatCompactCurrency,
} from '@/core/lib/people-types';

interface CollaboratorDetailPanelProps {
  collaborator: CollaboratorItem;
  onClose: () => void;
}

const TABS = ['Dados Cadastrais', 'Financeiro & PIX', 'Cidades'] as const;

export function CollaboratorDetailPanel({
  collaborator,
  onClose,
}: CollaboratorDetailPanelProps) {
  const [activeTab, setActiveTab] = useState(0);
  const initials = collaboratorInitials(collaborator.fullName);
  const category = collaboratorLinkCategory(collaborator.collaboratorType);
  const tone = statusTone(collaborator.partnershipStatus);

  return (
    <div className="flex h-full w-[450px] flex-col border-l border-line bg-card shadow-xl">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-line p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-light border border-line flex items-center justify-center font-mono font-bold text-[12px] text-primary-strong">
            {initials}
          </div>
          <div>
            <h2 className="text-[16px] font-bold tracking-[-0.3px] text-title leading-tight">
              {collaborator.fullName}
            </h2>
            <p className="font-mono text-[11px] text-soft">
              {collaborator.primaryRole} · {category}
            </p>
            <span
              className={`mt-1.5 inline-block rounded-[6px] px-2 py-[2px] font-mono text-[10px] font-medium capitalize ${tone.bg} ${tone.fg}`}
            >
              {collaborator.partnershipStatus}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-muted transition-colors hover:text-title"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-line bg-surface-subtle">
        {TABS.map((tab, index) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(index)}
            className={`flex-1 py-[10px] text-center font-mono text-[11px] font-semibold uppercase tracking-[0.5px] transition-colors ${
              activeTab === index
                ? 'border-b-2 border-primary text-primary-strong'
                : 'border-b-2 border-transparent text-muted hover:text-body'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-5 font-mono text-[11px] space-y-4">
        {activeTab === 0 && (
          <div className="space-y-4">
            <Section title="CONTATO & VÍNCULO">
              <Row label="E-mail" value={collaborator.email || '—'} />
              <Row label="Telefone" value={collaborator.phone || '—'} />
              <Row label="WhatsApp" value={collaborator.whatsapp || '—'} />
              <Row label="UF" value={collaborator.state || '—'} />
              <Row label="Empresa/Organização" value={collaborator.companyOrOrganization || '—'} />
            </Section>

            <Section title="CONFIGURAÇÃO DE COMISSÃO">
              <Row label="Comissão Padrão" value={`${collaborator.defaultCommissionPercent}%`} />
              <Row label="Tipo de Colaborador" value={collaborator.collaboratorType} />
            </Section>
          </div>
        )}

        {activeTab === 1 && (
          <div className="space-y-4">
            <Section title="DADOS DE PAGAMENTO">
              <Row label="Chave PIX" value={collaborator.pixKey || '—'} />
              <Row label="Dados Bancários" value={collaborator.bankAccountInfo || '—'} />
            </Section>

            <Section title="RESUMO FINANCEIRO (YTD)">
              <Row
                label="Comissão Paga YTD"
                value={formatCompactCurrency(collaborator.commissionPaidYtd || 0)}
              />
              <Row
                label="Comissão Prevista YTD"
                value={formatCompactCurrency(collaborator.commissionForecastYtd || 0)}
              />
              <Row
                label="Lucro Acumulado Cidades"
                value={formatCompactCurrency(collaborator.profitAccruedYtd || 0)}
              />
            </Section>
          </div>
        )}

        {activeTab === 2 && (
          <div className="space-y-4">
            <Section title="MUNICÍPIOS SOB RESPONSABILIDADE">
              <Row label="Total de Cidades" value={`${collaborator.sourcedCitiesCount || 0} cidades`} />
            </Section>
            <div className="p-4 rounded-[8px] bg-surface-subtle border border-line text-center text-muted">
              Cidades vinculadas a esta pessoa aparecem destacadas no Kanban do Pipeline.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[1px] text-soft">
        {title}
      </h3>
      <div className="space-y-0">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-line py-[6px]">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium text-body">{value}</span>
    </div>
  );
}
