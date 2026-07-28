"use client";

import React, { useState } from 'react';
import type { CompanyItem } from '@/core/lib/company-types';
import { cleanCnpj } from '@/core/lib/company-types';

interface NewCompanyDialogProps {
  onClose: () => void;
  onSubmit: (input: Partial<CompanyItem> & { cnpj: string; razaoSocial: string }) => Promise<void>;
}

const AVAILABLE_MODULES = [
  { id: 'pipeline', label: 'Pipeline de Vendas' },
  { id: 'levantamento_fundeb', label: 'Levantamento FUNDEB' },
  { id: 'contrato_fundeb', label: 'Gestão de Contratos' },
  { id: 'caixa', label: 'Fluxo de Caixa' },
];

export function NewCompanyDialog({
  onClose,
  onSubmit,
}: NewCompanyDialogProps) {
  const [cnpj, setCnpj] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [responsavelNome, setResponsavelNome] = useState('');
  const [responsavelEmail, setResponsavelEmail] = useState('');
  const [selectedModules, setSelectedModules] = useState<string[]>([
    'pipeline',
    'levantamento_fundeb',
  ]);
  const [submitting, setSubmitting] = useState(false);

  const toggleModule = (id: string) => {
    setSelectedModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawCnpj = cleanCnpj(cnpj);
    if (!rawCnpj || !razaoSocial.trim()) return;

    setSubmitting(true);
    try {
      await onSubmit({
        cnpj: rawCnpj,
        razaoSocial: razaoSocial.trim(),
        nomeFantasia: nomeFantasia.trim() || razaoSocial.trim(),
        responsavelNome: responsavelNome.trim() || undefined,
        responsavelEmail: responsavelEmail.trim() || undefined,
        activeModules: selectedModules,
        status: 'ativo',
        employeeCount: 1,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-[14px] bg-card border border-line p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-line pb-4 mb-4">
          <h2 className="text-[18px] font-bold text-title">
            Nova Empresa
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-title"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-mono text-[11px] font-semibold text-soft mb-1 uppercase">
              CNPJ *
            </label>
            <input
              type="text"
              required
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0001-00"
              className="w-full rounded-[8px] border border-line-input bg-card px-3 py-2 text-[13px] text-body font-mono focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-mono text-[11px] font-semibold text-soft mb-1 uppercase">
              Razão Social *
            </label>
            <input
              type="text"
              required
              value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.target.value)}
              placeholder="Empresa Exemplo LTDA"
              className="w-full rounded-[8px] border border-line-input bg-card px-3 py-2 text-[13px] text-body focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-mono text-[11px] font-semibold text-soft mb-1 uppercase">
              Nome Fantasia
            </label>
            <input
              type="text"
              value={nomeFantasia}
              onChange={(e) => setNomeFantasia(e.target.value)}
              placeholder="Exemplo Soluções"
              className="w-full rounded-[8px] border border-line-input bg-card px-3 py-2 text-[13px] text-body focus:border-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[11px] font-semibold text-soft mb-1 uppercase">
                Responsável
              </label>
              <input
                type="text"
                value={responsavelNome}
                onChange={(e) => setResponsavelNome(e.target.value)}
                placeholder="Nome do responsável"
                className="w-full rounded-[8px] border border-line-input bg-card px-3 py-2 text-[13px] text-body focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-mono text-[11px] font-semibold text-soft mb-1 uppercase">
                E-mail Responsável
              </label>
              <input
                type="email"
                value={responsavelEmail}
                onChange={(e) => setResponsavelEmail(e.target.value)}
                placeholder="contato@empresa.com"
                className="w-full rounded-[8px] border border-line-input bg-card px-3 py-2 text-[13px] text-body focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-[11px] font-semibold text-soft mb-2 uppercase">
              Módulos Habilitados
            </label>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_MODULES.map((mod) => {
                const isSelected = selectedModules.includes(mod.id);
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => toggleModule(mod.id)}
                    className={`flex items-center justify-between p-2.5 rounded-[8px] border font-mono text-[11px] text-left transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary-light text-primary-strong font-semibold'
                        : 'border-line bg-card text-soft hover:bg-surface-subtle'
                    }`}
                  >
                    <span>{mod.label}</span>
                    {isSelected && <span>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-line mt-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[8px] border border-line px-4 py-2 text-[13px] font-medium text-body hover:bg-surface-subtle"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-[8px] bg-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-strong transition-colors disabled:opacity-50"
            >
              {submitting ? 'Salvando...' : 'Cadastrar Empresa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
