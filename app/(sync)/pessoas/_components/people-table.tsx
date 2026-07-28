"use client";

import React from 'react';
import type { CollaboratorItem } from '@/core/lib/people-types';
import {
  collaboratorInitials,
  collaboratorLinkCategory,
  statusTone,
  formatCompactCurrency,
} from '@/core/lib/people-types';

interface PeopleTableProps {
  collaborators: CollaboratorItem[];
  selectedId?: string;
  onSelect: (item: CollaboratorItem) => void;
}

export function PeopleTable({
  collaborators,
  selectedId,
  onSelect,
}: PeopleTableProps) {
  if (collaborators.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-card rounded-[14px] border border-line text-center">
        <p className="font-mono text-sm text-soft">
          Nenhuma pessoa encontrada com os filtros selecionados.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[14px] border border-line bg-card shadow-sm">
      <table className="w-full text-left border-collapse min-w-[850px]">
        <thead>
          <tr className="border-b border-line bg-surface-subtle font-mono text-[10px] font-semibold uppercase tracking-[1px] text-soft">
            <th className="py-3 px-4">Nome / Função</th>
            <th className="py-3 px-3">Vínculo</th>
            <th className="py-3 px-2 text-center">UF</th>
            <th className="py-3 px-3 text-center">Cidades</th>
            <th className="py-3 px-3 text-right">Lucro YTD</th>
            <th className="py-3 px-3 text-right">Comissão YTD</th>
            <th className="py-3 px-3 text-center">Status</th>
            <th className="py-3 px-3 text-right"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line text-[12px]">
          {collaborators.map((item) => {
            const isSelected = item.id === selectedId;
            const category = collaboratorLinkCategory(item.collaboratorType);
            const tone = statusTone(item.partnershipStatus);
            const initials = collaboratorInitials(item.fullName);

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
                    <div className="w-8 h-8 rounded-full bg-surface-subtle border border-line flex items-center justify-center font-mono font-bold text-[10px] text-title flex-shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-[13px] text-title truncate">
                        {item.fullName}
                      </div>
                      <div className="font-mono text-[11px] text-soft truncate">
                        {item.primaryRole}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Vínculo */}
                <td className="py-3 px-3">
                  <span className="inline-block rounded-[6px] px-2 py-0.5 font-mono text-[11px] bg-surface-subtle text-title border border-line">
                    {category}
                  </span>
                </td>

                {/* UF */}
                <td className="py-3 px-2 text-center font-mono text-[11px] text-soft">
                  {item.state || '—'}
                </td>

                {/* Cidades */}
                <td className="py-3 px-3 text-center font-mono text-[12px] font-semibold text-title tabular-nums">
                  {item.sourcedCitiesCount || 0}
                </td>

                {/* Lucro YTD */}
                <td className="py-3 px-3 text-right font-mono text-[11px] text-title tabular-nums">
                  {formatCompactCurrency(item.profitAccruedYtd || 0)}
                </td>

                {/* Comissão YTD */}
                <td className="py-3 px-3 text-right font-mono text-[11px] font-semibold text-primary-strong tabular-nums">
                  {formatCompactCurrency(item.commissionPaidYtd || 0)}
                </td>

                {/* Status */}
                <td className="py-3 px-3 text-center">
                  <span
                    className={`inline-block rounded-[6px] px-2 py-0.5 font-mono text-[10px] font-medium capitalize ${tone.bg} ${tone.fg}`}
                  >
                    {item.partnershipStatus}
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
