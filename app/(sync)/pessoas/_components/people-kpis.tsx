"use client";

import React from 'react';
import { formatCompactCurrency } from '@/core/lib/people-types';

interface PeopleKpisProps {
  totalPeople: number;
  activeCount: number;
  totalCommissionsYtd: number;
}

export function PeopleKpis({
  totalPeople,
  activeCount,
  totalCommissionsYtd,
}: PeopleKpisProps) {
  return (
    <div className="flex flex-row gap-3">
      {/* Total Pessoas */}
      <div className="flex-1 bg-card border border-line rounded-[14px] px-[18px] py-4 shadow-sm">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[1.1px] text-soft">
          Total de Pessoas
        </div>
        <div className="font-mono text-[26px] font-semibold leading-none tracking-[-1.2px] text-title tabular-nums mt-1">
          {totalPeople}
        </div>
        <div className="font-mono text-[11px] text-soft mt-1">
          Cadastrados no sistema
        </div>
      </div>

      {/* Em Acompanhamento */}
      <div className="flex-1 bg-card border border-line rounded-[14px] px-[18px] py-4 shadow-sm">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[1.1px] text-soft">
          Em Acompanhamento
        </div>
        <div className="font-mono text-[26px] font-semibold leading-none tracking-[-1.2px] text-title tabular-nums mt-1">
          {activeCount}
        </div>
        <div className="font-mono text-[11px] text-soft mt-1">
          Com auxílio/parceria ativa
        </div>
      </div>

      {/* Comissões YTD */}
      <div className="flex-1 bg-card border border-line rounded-[14px] px-[18px] py-4 shadow-sm">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[1.1px] text-soft">
          Comissões Pagas (YTD)
        </div>
        <div className="font-mono text-[26px] font-semibold leading-none tracking-[-1.2px] text-primary-strong tabular-nums mt-1">
          {formatCompactCurrency(totalCommissionsYtd)}
        </div>
        <div className="font-mono text-[11px] text-soft mt-1">
          Acumulado do ano
        </div>
      </div>
    </div>
  );
}
