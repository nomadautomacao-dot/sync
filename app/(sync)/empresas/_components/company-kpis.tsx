"use client";

import React from 'react';

interface CompanyKpisProps {
  totalCompanies: number;
  totalEmployees: number;
  totalActiveModules: number;
}

export function CompanyKpis({
  totalCompanies,
  totalEmployees,
  totalActiveModules,
}: CompanyKpisProps) {
  return (
    <div className="flex flex-row gap-3">
      {/* Total Empresas */}
      <div className="flex-1 bg-white/[.88] border border-white/95 rounded-2xl shadow-[0_10px_26px_rgba(22,24,29,.05)] px-[18px] py-4">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[1.1px] text-soft">
          Empresas Cadastradas
        </div>
        <div className="font-mono text-[26px] font-semibold leading-none tracking-[-1.2px] text-title tabular-nums mt-1">
          {totalCompanies}
        </div>
        <div className="font-mono text-[11px] text-soft mt-1">
          Entidades do grupo
        </div>
      </div>

      {/* Funcionários */}
      <div className="flex-1 bg-white/[.88] border border-white/95 rounded-2xl shadow-[0_10px_26px_rgba(22,24,29,.05)] px-[18px] py-4">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[1.1px] text-soft">
          Funcionários / Quadro
        </div>
        <div className="font-mono text-[26px] font-semibold leading-none tracking-[-1.2px] text-title tabular-nums mt-1">
          {totalEmployees}
        </div>
        <div className="font-mono text-[11px] text-soft mt-1">
          Total de posições vinculadas
        </div>
      </div>

      {/* Módulos Habilitados */}
      <div className="flex-1 bg-white/[.88] border border-white/95 rounded-2xl shadow-[0_10px_26px_rgba(22,24,29,.05)] px-[18px] py-4">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[1.1px] text-soft">
          Módulos Ativos
        </div>
        <div className="font-mono text-[26px] font-semibold leading-none tracking-[-1.2px] text-primary-strong tabular-nums mt-1">
          {totalActiveModules}
        </div>
        <div className="font-mono text-[11px] text-soft mt-1">
          Acessos autorizados
        </div>
      </div>
    </div>
  );
}
