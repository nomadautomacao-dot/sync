"use client";

import React from 'react';
import type { CompanyItem } from '@/core/lib/company-types';
import {
  formatCnpj,
  companyStatusTone,
  companyInitials,
} from '@/core/lib/company-types';

interface CompanyTableProps {
  companies: CompanyItem[];
  selectedId?: string;
  onSelect: (item: CompanyItem) => void;
}

export function CompanyTable({
  companies,
  selectedId,
  onSelect,
}: CompanyTableProps) {
  if (companies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-card rounded-[14px] border border-line text-center">
        <p className="font-mono text-sm text-soft">
          Nenhuma empresa encontrada com os filtros selecionados.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[14px] border border-line bg-card shadow-sm">
      <table className="w-full text-left border-collapse min-w-[850px]">
        <thead>
          <tr className="border-b border-line bg-surface-subtle font-mono text-[10px] font-semibold uppercase tracking-[1px] text-soft">
            <th className="py-3 px-4">Empresa / Razão Social</th>
            <th className="py-3 px-3">CNPJ</th>
            <th className="py-3 px-3">Responsável</th>
            <th className="py-3 px-3">Módulos Habilitados</th>
            <th className="py-3 px-3 text-center">Quadro</th>
            <th className="py-3 px-3 text-center">Status</th>
            <th className="py-3 px-3 text-right"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line text-[12px]">
          {companies.map((item) => {
            const isSelected = item.id === selectedId;
            const tone = companyStatusTone(item.status);
            const initials = companyInitials(item.nomeFantasia || item.razaoSocial);

            return (
              <tr
                key={item.id}
                onClick={() => onSelect(item)}
                className={`cursor-pointer transition-colors hover:bg-surface-subtle ${
                  isSelected ? 'bg-primary-light/40' : ''
                }`}
              >
                {/* Nome / Avatar */}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-[8px] bg-primary-light border border-line flex items-center justify-center font-mono font-bold text-[10px] text-primary-strong flex-shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-[13px] text-title truncate">
                        {item.nomeFantasia || item.razaoSocial}
                      </div>
                      <div className="font-mono text-[11px] text-soft truncate">
                        {item.razaoSocial}
                      </div>
                    </div>
                  </div>
                </td>

                {/* CNPJ */}
                <td className="py-3 px-3 font-mono text-[11px] text-title tabular-nums">
                  {formatCnpj(item.cnpj)}
                </td>

                {/* Responsável */}
                <td className="py-3 px-3">
                  <div className="text-[12px] font-medium text-body">
                    {item.responsavelNome || '—'}
                  </div>
                  <div className="font-mono text-[10px] text-soft">
                    {item.responsavelEmail || ''}
                  </div>
                </td>

                {/* Módulos Habilitados */}
                <td className="py-3 px-3">
                  <div className="flex flex-wrap gap-1">
                    {item.activeModules.length > 0 ? (
                      item.activeModules.slice(0, 3).map((mod) => (
                        <span
                          key={mod}
                          className="rounded-[4px] bg-surface-subtle border border-line px-1.5 py-0.5 font-mono text-[10px] text-soft uppercase"
                        >
                          {mod.replace('_', ' ')}
                        </span>
                      ))
                    ) : (
                      <span className="font-mono text-[11px] text-muted">Nenhum</span>
                    )}
                    {item.activeModules.length > 3 && (
                      <span className="font-mono text-[10px] text-muted">
                        +{item.activeModules.length - 3}
                      </span>
                    )}
                  </div>
                </td>

                {/* Quadro */}
                <td className="py-3 px-3 text-center font-mono text-[12px] font-semibold text-title tabular-nums">
                  {item.employeeCount || 0}
                </td>

                {/* Status */}
                <td className="py-3 px-3 text-center">
                  <span
                    className={`inline-block rounded-[6px] px-2 py-0.5 font-mono text-[10px] font-medium capitalize ${tone.bg} ${tone.fg}`}
                  >
                    {item.status}
                  </span>
                </td>

                {/* Chevron */}
                <td className="py-3 px-3 text-right text-muted">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
