"use client";

import React from "react";
import { formatCurrency, formatCurrencyCompact } from "@/core/lib/city-types";
import { TrendingUpIcon, ShieldCheckIcon, AlertTriangleIcon, DollarSignIcon } from "lucide-react";
import { Badge } from "@/core/components/ui/badge";

interface PipelineKpisProps {
  totalRevenue: number;     // Pipeline bruto (YTD)
  weightedRevenue: number;  // Valor ponderado (forecast)
  inactiveCities: number;   // Cidades inativas > 7 dias
}

export function PipelineKpis({ totalRevenue, weightedRevenue, inactiveCities }: PipelineKpisProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {/* Total Revenue - Featured Card */}
      <div className="relative overflow-hidden rounded-2xl border border-[#16181D]/20 bg-gradient-to-br from-[#16181D] via-[#2C2F38] to-[#3B3F4A] p-5 text-white shadow-sm">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-white/80">
            Pipeline Bruto (YTD)
          </span>
          <div className="flex size-8 items-center justify-center rounded-xl bg-white/10 text-white/80 backdrop-blur-sm">
            <TrendingUpIcon className="size-4" />
          </div>
        </div>

        <div className="mt-2.5 flex items-baseline justify-between">
          <span className="font-mono text-2xl font-black tracking-tight text-white sm:text-3xl">
            {formatCurrencyCompact(totalRevenue)}
          </span>
          <span className="rounded bg-white/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white/80">
            BRL
          </span>
        </div>

        <p className="mt-2 text-[11px] font-medium text-white/60">
          Estimativa anual total ({formatCurrency(totalRevenue)})
        </p>
      </div>

      {/* Weighted Revenue */}
      <div className="rounded-2xl border border-white/95 bg-white/[.88] p-5 shadow-[0_10px_26px_rgba(22,24,29,.05)] transition-all hover:border-[#F0F1F5]">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#767A86]">
            Valor Ponderado (Forecast)
          </span>
          <div className="flex size-8 items-center justify-center rounded-xl bg-[#F2F1F7] text-[#16181D]">
            <ShieldCheckIcon className="size-4" />
          </div>
        </div>

        <div className="mt-2.5 flex items-baseline justify-between">
          <span className="font-mono text-2xl font-black tracking-tight text-[#16181D] sm:text-3xl">
            {formatCurrencyCompact(weightedRevenue)}
          </span>
          <Badge variant="outline" className="border-[#F0F1F5] bg-[#F2F1F7] text-[#16181D] text-[10px] font-bold">
            Ponderado
          </Badge>
        </div>

        <p className="mt-2 text-[11px] font-medium text-[#767A86]">
          Ajustado pela probabilidade de cada estágio
        </p>
      </div>

      {/* Inactive Cities */}
      <div className="rounded-2xl border border-white/95 bg-white/[.88] p-5 shadow-[0_10px_26px_rgba(22,24,29,.05)] transition-all hover:border-[#F0F1F5]">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#767A86]">
            Atenção (&gt; 7 dias sem contato)
          </span>
          <div className={`flex size-8 items-center justify-center rounded-xl ${inactiveCities > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
            <AlertTriangleIcon className="size-4" />
          </div>
        </div>

        <div className="mt-2.5 flex items-baseline justify-between">
          <span className={`font-mono text-2xl font-black tracking-tight sm:text-3xl ${inactiveCities > 0 ? "text-amber-800" : "text-[#16181D]"}`}>
            {inactiveCities}
          </span>
          <Badge variant="outline" className={inactiveCities > 0 ? "border-amber-200 bg-amber-50 text-amber-800 text-[10px] font-bold" : "border-emerald-200 bg-emerald-50 text-emerald-800 text-[10px] font-bold"}>
            {inactiveCities > 0 ? "Requer Ação" : "Em Dia"}
          </Badge>
        </div>

        <p className="mt-2 text-[11px] font-medium text-[#767A86]">
          Cidades inativas necessitando de follow-up
        </p>
      </div>
    </div>
  );
}
