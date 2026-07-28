"use client";

import React, { useState } from 'react';
import type { CompanyItem } from '@/core/lib/company-types';
import {
  formatCnpj,
  companyStatusTone,
  companyInitials,
} from '@/core/lib/company-types';

interface CompanyDetailPanelProps {
  company: CompanyItem;
  onClose: () => void;
}

const TABS = ['Dados Cadastrais', 'Módulos', 'Quadro'] as const;

export function CompanyDetailPanel({
  company,
  onClose,
}: CompanyDetailPanelProps) {
  const [activeTab, setActiveTab] = useState(0);
  const initials = companyInitials(company.nomeFantasia || company.razaoSocial);
  const tone = companyStatusTone(company.status);

  return (
    <div className="flex h-full w-[450px] flex-col border-l border-line bg-card shadow-xl">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-line p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[8px] bg-primary-light border border-line flex items-center justify-center font-mono font-bold text-[12px] text-primary-strong">
            {initials}
          </div>
          <div>
            <h2 className="text-[16px] font-bold tracking-[-0.3px] text-title leading-tight">
              {company.nomeFantasia || company.razaoSocial}
            </h2>
            <p className="font-mono text-[11px] text-soft">
              {formatCnpj(company.cnpj)}
            </p>
            <span
              className={`mt-1.5 inline-block rounded-[6px] px-2 py-[2px] font-mono text-[10px] font-medium capitalize ${tone.bg} ${tone.fg}`}
            >
              {company.status}
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
            <Section title="IDENTIFICAÇÃO">
              <Row label="Razão Social" value={company.razaoSocial} />
              <Row label="Nome Fantasia" value={company.nomeFantasia || '—'} />
              <Row label="CNPJ" value={formatCnpj(company.cnpj)} />
              <Row label="UF / Cidade" value={`${company.cidade || '—'} / ${company.uf || '—'}`} />
            </Section>

            <Section title="CONTATO / RESPONSÁVEL">
              <Row label="Nome" value={company.responsavelNome || '—'} />
              <Row label="E-mail" value={company.responsavelEmail || '—'} />
            </Section>
          </div>
        )}

        {activeTab === 1 && (
          <div className="space-y-4">
            <Section title="MÓDULOS CONTRATADOS E AUTORIZADOS">
              <div className="space-y-2 mt-2">
                {company.activeModules.length > 0 ? (
                  company.activeModules.map((mod) => (
                    <div
                      key={mod}
                      className="flex items-center justify-between p-3 rounded-[8px] bg-surface-subtle border border-line"
                    >
                      <span className="font-semibold text-title uppercase">{mod.replace('_', ' ')}</span>
                      <span className="text-success-dark font-semibold">● Ativo</span>
                    </div>
                  ))
                ) : (
                  <p className="text-muted italic">Nenhum módulo ativo.</p>
                )}
              </div>
            </Section>
          </div>
        )}

        {activeTab === 2 && (
          <div className="space-y-4">
            <Section title="QUADRO DE PESSOAL">
              <Row label="Total Posições Alocadas" value={`${company.employeeCount || 0} pessoas`} />
            </Section>
            <div className="p-4 rounded-[8px] bg-surface-subtle border border-line text-center text-muted">
              Quadro de colaboradores alocados para atendimento desta empresa.
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
