"use client";

import React, { useState } from 'react';
import type { CollaboratorItem } from '@/core/lib/people-types';

interface NewCollaboratorDialogProps {
  onClose: () => void;
  onSubmit: (input: Partial<CollaboratorItem> & { fullName: string }) => Promise<void>;
}

export function NewCollaboratorDialog({
  onClose,
  onSubmit,
}: NewCollaboratorDialogProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [state, setState] = useState('DF');
  const [primaryRole, setPrimaryRole] = useState('Consultor Regional');
  const [collaboratorType, setCollaboratorType] = useState('consultor_parceiro');
  const [defaultCommissionPercent, setDefaultCommissionPercent] = useState(10);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    setSubmitting(true);
    try {
      await onSubmit({
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        state,
        primaryRole,
        collaboratorType,
        defaultCommissionPercent,
        partnershipStatus: 'ativo',
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
            Nova Pessoa / Colaborador
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
              Nome Completo *
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex: João da Silva"
              className="w-full rounded-[8px] border border-line-input bg-card px-3 py-2 text-[13px] text-body focus:border-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[11px] font-semibold text-soft mb-1 uppercase">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="joao@empresa.com"
                className="w-full rounded-[8px] border border-line-input bg-card px-3 py-2 text-[13px] text-body focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-mono text-[11px] font-semibold text-soft mb-1 uppercase">
                Telefone / Whats
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(61) 99999-9999"
                className="w-full rounded-[8px] border border-line-input bg-card px-3 py-2 text-[13px] text-body focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-mono text-[11px] font-semibold text-soft mb-1 uppercase">
                UF
              </label>
              <input
                type="text"
                maxLength={2}
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase())}
                className="w-full rounded-[8px] border border-line-input bg-card px-3 py-2 text-[13px] text-body focus:border-primary focus:outline-none font-mono uppercase"
              />
            </div>
            <div className="col-span-2">
              <label className="block font-mono text-[11px] font-semibold text-soft mb-1 uppercase">
                Função Principal
              </label>
              <input
                type="text"
                value={primaryRole}
                onChange={(e) => setPrimaryRole(e.target.value)}
                placeholder="Ex: Consultor Regional"
                className="w-full rounded-[8px] border border-line-input bg-card px-3 py-2 text-[13px] text-body focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[11px] font-semibold text-soft mb-1 uppercase">
                Tipo de Vínculo
              </label>
              <select
                value={collaboratorType}
                onChange={(e) => setCollaboratorType(e.target.value)}
                className="w-full rounded-[8px] border border-line-input bg-card px-3 py-2 text-[13px] text-body focus:border-primary focus:outline-none font-mono"
              >
                <option value="consultor_parceiro">Consultor Parceiro</option>
                <option value="articulador_politico">Articulador Político</option>
                <option value="socio_executivo">Sócio Executivo</option>
                <option value="equipe_interna">Equipe Interna</option>
                <option value="suporte_tecnico">Suporte Técnico</option>
              </select>
            </div>
            <div>
              <label className="block font-mono text-[11px] font-semibold text-soft mb-1 uppercase">
                Comissão (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={defaultCommissionPercent}
                onChange={(e) => setDefaultCommissionPercent(Number(e.target.value))}
                className="w-full rounded-[8px] border border-line-input bg-card px-3 py-2 text-[13px] text-body focus:border-primary focus:outline-none font-mono"
              />
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
              {submitting ? 'Salvando...' : 'Cadastrar Pessoa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
