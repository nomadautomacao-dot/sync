"use client";

import { useDroppable } from "@dnd-kit/core";
import type { CityAccount, StageKey } from "@/core/lib/city-types";
import { STAGE_LABELS, BOARD_STAGES, formatCurrencyCompact } from "@/core/lib/city-types";
import { stageSignal, signalColor } from "./stage-helpers";
import { CityCard } from "./city-card";
import { StageIndex } from "./stage-index";
import { useState } from "react";
import { MapPinIcon, LayersIcon } from "lucide-react";

interface PipelineKanbanProps {
  cities: CityAccount[];
  selectedCityId?: string;
  onSelectCity: (city: CityAccount) => void;
  onStageDrop: (cityId: string, targetStage: string) => void;
}

const MIN_COLUMN_WIDTH = 220;
const INDEX_COLUMN_WIDTH = 140;
const GAP = 12;
const CARDS_PER_COLUMN = 6;

// Cores temáticas por estágio da negociação
const STAGE_ACCENTS: Record<StageKey, { border: string; bg: string; text: string }> = {
  mapping: { border: "border-[#16181D]", bg: "bg-[#F2F1F7]", text: "text-[#16181D]" },
  first_contact: { border: "border-[#93B8F2]", bg: "bg-[#E2EDFA]", text: "text-[#16181D]" },
  technical_diagnostic: { border: "border-[#8FD3B6]", bg: "bg-[#DFF2E7]", text: "text-[#16181D]" },
  proposal_presented: { border: "border-[#F7C77E]", bg: "bg-[#FBF0D9]", text: "text-[#16181D]" },
  contractual: { border: "border-[#F5A3B5]", bg: "bg-[#FBE0E7]", text: "text-[#16181D]" },
  institutional_validation: { border: "border-[#16181D]", bg: "bg-[#F2F1F7]", text: "text-[#16181D]" },
  negotiation: { border: "border-[#F7C77E]", bg: "bg-[#FBF0D9]", text: "text-[#16181D]" },
  verbal_approval: { border: "border-[#8FD3B6]", bg: "bg-[#DFF2E7]", text: "text-[#16181D]" },
  implementation: { border: "border-[#8FD3B6]", bg: "bg-[#DFF2E7]", text: "text-[#16181D]" },
  assisted_operation: { border: "border-[#93B8F2]", bg: "bg-[#E2EDFA]", text: "text-[#16181D]" },
  fidelized: { border: "border-[#8FD3B6]", bg: "bg-[#DFF2E7]", text: "text-[#16181D]" },
  paused: { border: "border-[#A2A6B2]", bg: "bg-[#F2F1F7]", text: "text-[#3B3F4A]" },
  lost: { border: "border-rose-400", bg: "bg-rose-50", text: "text-rose-700" },
};

export function PipelineKanban({
  cities,
  selectedCityId,
  onSelectCity,
  onStageDrop,
}: PipelineKanbanProps) {
  const [expandedStages, setExpandedStages] = useState<Set<StageKey>>(new Set());

  const indexStages: StageKey[] = [
    "institutional_validation",
    "negotiation",
    "verbal_approval",
    "implementation",
    "assisted_operation",
    "fidelized",
    "paused",
  ];

  const toggleExpand = (stage: StageKey) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  };

  const minBoardWidth =
    BOARD_STAGES.length * (MIN_COLUMN_WIDTH + GAP) + INDEX_COLUMN_WIDTH;

  return (
    <div className="h-full">
      <div
        className="flex h-full gap-3 overflow-x-auto pb-4"
        style={{ minWidth: minBoardWidth }}
      >
        {BOARD_STAGES.map((stage) => (
          <StageColumn
            key={stage}
            stage={stage}
            cities={cities.filter((c) => c.stage === stage)}
            isExpanded={expandedStages.has(stage)}
            onToggleExpand={() => toggleExpand(stage)}
            selectedCityId={selectedCityId}
            onSelectCity={onSelectCity}
            onStageDrop={onStageDrop}
          />
        ))}
        <StageIndex
          stages={indexStages}
          cities={cities}
          onDrop={onStageDrop}
        />
      </div>
    </div>
  );
}

// ── Coluna de estágio ────────────────────────────────────────

interface StageColumnProps {
  stage: StageKey;
  cities: CityAccount[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  selectedCityId?: string;
  onSelectCity: (city: CityAccount) => void;
  onStageDrop: (cityId: string, targetStage: string) => void;
}

function StageColumn({
  stage,
  cities,
  isExpanded,
  onToggleExpand,
  selectedCityId,
  onSelectCity,
  onStageDrop,
}: StageColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `column-${stage}`,
    data: { stage },
  });

  const columnRevenue = cities.reduce(
    (sum, c) => sum + c.estimatedAnnualRevenue,
    0
  );
  const signal = stageSignal(cities);
  const visible =
    isExpanded || cities.length <= CARDS_PER_COLUMN
      ? cities
      : cities.slice(0, CARDS_PER_COLUMN);
  const hidden = cities.length - visible.length;

  const accent = STAGE_ACCENTS[stage] || { border: "border-[#16181D]", bg: "bg-[#F7F6FA]", text: "text-[#3B3F4A]" };

  return (
    <div
      ref={setNodeRef}
      className={`flex min-w-[220px] flex-1 flex-col rounded-2xl border bg-white/[.88] shadow-[0_10px_26px_rgba(22,24,29,.05)] transition-all ${
        isOver
          ? "border-[#16181D] ring-2 ring-[#16181D]/20 bg-[#F7F6FA]/20"
          : "border-white/95"
      }`}
    >
      {/* Cabeçalho da coluna com border accent no topo */}
      <div className={`rounded-t-2xl border-b border-[#F0F1F5] p-3.5 border-t-4 ${accent.border}`}>
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: signalColor(signal) }}
            />
            <h3 className="truncate text-xs font-bold text-[#16181D]">
              {STAGE_LABELS[stage]}
            </h3>
          </div>
          <span className="rounded-full bg-[#F2F1F7] px-2 py-0.5 font-mono text-[10px] font-bold text-[#3B3F4A] shrink-0">
            {cities.length}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="font-mono font-bold text-[#16181D]">
            {columnRevenue > 0 ? formatCurrencyCompact(columnRevenue) : "R$ 0"}
          </span>
          <span className="text-[10px] font-medium text-[#767A86]">acumulado</span>
        </div>
      </div>

      {/* Corpo: cards */}
      <div className="flex-1 overflow-y-auto p-2.5">
        {cities.length === 0 ? (
          /* Placeholder de coluna vazia */
          <div className={`flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-[#F0F1F5]/80 p-3 text-center transition-colors ${isOver ? "bg-[#F7F6FA]/40 border-[#16181D]" : "bg-[#F7F6FA]/40"}`}>
            <MapPinIcon className="size-5 text-[#A2A6B2]" />
            <p className="mt-1 text-[11px] font-medium text-[#A2A6B2]">
              {isOver ? "Solte para mover" : "Nenhuma cidade nesta fase"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {visible.map((city) => (
              <CityCard
                key={city.id}
                city={city}
                isSelected={city.id === selectedCityId}
                onSelect={onSelectCity}
              />
            ))}
          </div>
        )}
      </div>

      {/* Rodapé "+N" / "Mostrar menos" */}
      {(hidden > 0 || isExpanded) && (
        <div className="p-2.5 pt-0">
          <button
            type="button"
            onClick={onToggleExpand}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#F0F1F5] py-1.5 text-xs font-semibold text-[#5A5E6A] transition-colors hover:bg-[#F7F6FA] hover:text-[#16181D]"
            title={isExpanded ? "Mostrar menos" : "Mostrar todos"}
          >
            <span>{isExpanded ? "−" : "+"}</span>
            <span className="font-mono text-[11px]">
              {isExpanded ? "Mostrar menos" : `+${hidden} cidades`}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
