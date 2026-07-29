"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";
import type { CityAccount } from "@/core/lib/city-types";
import { STAGE_LABELS } from "@/core/lib/city-types";
import { stagePastelColor } from "./stage-helpers";
import { ResumoTab } from "./city-detail-tabs/resumo-tab";
import { FundebTab } from "./city-detail-tabs/fundeb-tab";
import { HistoricoTab } from "./city-detail-tabs/historico-tab";
import { NotasTab } from "./city-detail-tabs/notas-tab";

interface CityDetailPanelProps {
  city: CityAccount;
  onClose: () => void;
  onSave: (cityId: string, data: Record<string, unknown>) => void;
}

const TABS = ["Resumo", "FUNDEB", "Histórico", "Notas"] as const;

export function CityDetailPanel({ city, onClose, onSave }: CityDetailPanelProps) {
  const [activeTab, setActiveTab] = useState(0);
  const tone = stagePastelColor(city.stage);

  return (
    <div className="flex h-full w-[450px] flex-col border-l border-white/95 bg-white/[.88] shadow-[-10px_0_26px_rgba(22,24,29,.05)] backdrop-blur-md">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-line px-5 py-4">
        <div>
          <h2 className="text-[18px] font-bold tracking-[-0.5px] text-title">
            {city.name}
          </h2>
          <p className="mt-0.5 font-mono text-[12px] text-dim">{city.uf}</p>
          <span
            className="mt-2 inline-flex items-center gap-1.5 rounded-[14px] px-2.5 py-[3px] font-mono text-[11px] font-medium"
            style={{ backgroundColor: tone.bg, color: tone.text }}
          >
            <span className="size-1.5 rounded-full" style={{ backgroundColor: tone.dot }} />
            {STAGE_LABELS[city.stage] ?? city.stage}
          </span>
          <Link
            href={`/cidades/${city.id}`}
            className="mt-2 flex w-fit items-center gap-1 text-[10px] font-bold text-[#2C4E82] hover:underline"
          >
            Abrir ficha completa
            <ArrowUpRightIcon className="size-3" />
          </Link>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-muted transition-colors hover:text-title"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
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
                ? "border-b-2 border-primary text-primary-strong"
                : "border-b-2 border-transparent text-muted hover:text-body"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 0 && <ResumoTab city={city} onSave={onSave} />}
        {activeTab === 1 && <FundebTab city={city} />}
        {activeTab === 2 && <HistoricoTab city={city} />}
        {activeTab === 3 && <NotasTab city={city} />}
      </div>
    </div>
  );
}
