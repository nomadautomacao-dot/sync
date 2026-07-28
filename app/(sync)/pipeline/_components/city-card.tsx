"use client";

import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { MapPinIcon, ClockIcon, CalendarIcon, SparklesIcon } from "lucide-react";

import type { CityAccount } from "@/core/lib/city-types";
import { formatCurrencyCompact } from "@/core/lib/city-types";
import { cardAlert, isHot, initials, nextStepLine } from "./stage-helpers";
import { Badge } from "@/core/components/ui/badge";

interface CityCardProps {
  city: CityAccount;
  isSelected: boolean;
  onSelect: (city: CityAccount) => void;
}

export function CityCard({ city, isSelected, onSelect }: CityCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: city.id,
    data: { city },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const alertState = cardAlert(city);
  const hot = isHot(city);
  const step = nextStepLine(city);

  let avatarBg = "bg-[#F2F1F7] text-[#3B3F4A] border-[#F0F1F5]";
  if (hot) avatarBg = "bg-[#16181D] text-white border-[#16181D]";
  else if (alertState === "due") avatarBg = "bg-amber-600 text-white border-amber-600";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onSelect(city)}
      className={`group relative flex flex-col gap-2.5 rounded-2xl border bg-white/[.88] p-4 shadow-[0_10px_26px_rgba(22,24,29,.05)] transition-all ${
        isSelected
          ? "border-[#16181D] ring-2 ring-[#16181D]/20 shadow-md"
          : "border-white/95 hover:border-[#F0F1F5] hover:shadow-xs"
      } ${isDragging ? "cursor-grabbing opacity-60 shadow-xl" : "cursor-grab"}`}
    >
      {/* Topo do Card: Nome do Município, UF e Valor */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-xs font-extrabold tracking-tight text-[#16181D]">
              {city.name}
            </span>
            <Badge variant="outline" className="border-[#F0F1F5] bg-[#F7F6FA] font-mono text-[9px] font-bold text-[#5A5E6A] px-1 py-0">
              {city.uf}
            </Badge>
          </div>
          <p className="mt-1 font-mono text-sm font-black text-[#16181D]">
            {city.estimatedAnnualRevenue ? formatCurrencyCompact(city.estimatedAnnualRevenue) : "R$ 0"}
          </p>
        </div>

        {/* Probabilidade */}
        <div className="flex flex-col items-end">
          <span className="font-mono text-[11px] font-bold text-[#3B3F4A]">{city.probability}%</span>
          <div className="mt-1 h-1.5 w-10 overflow-hidden rounded-full bg-[#F2F1F7]">
            <div
              className={`h-full rounded-full transition-all ${
                city.probability >= 70
                  ? "bg-emerald-500"
                  : city.probability >= 40
                  ? "bg-[#16181D]"
                  : "bg-amber-500"
              }`}
              style={{ width: `${city.probability}%` }}
            />
          </div>
        </div>
      </div>

      {/* Próximo Passo */}
      {step && (
        <div className="flex items-center gap-1.5 rounded-lg border border-[#F0F1F5] bg-[#F7F6FA]/60 px-2.5 py-1.5 text-[11px] font-medium text-[#5A5E6A]">
          <ClockIcon className="size-3 shrink-0 text-[#A2A6B2]" />
          <span className="truncate">{step}</span>
        </div>
      )}

      {/* Rodapé do Card: Avatar do Responsável + Alertas */}
      <div className="flex items-center justify-between pt-1 border-t border-[#F0F1F5]">
        <div className="flex items-center gap-2">
          <div className={`flex size-6 items-center justify-center rounded-full border font-mono text-[9px] font-bold ${avatarBg}`}>
            {initials(city.name)}
          </div>
          <span className="truncate text-[10px] font-medium text-[#767A86] max-w-[100px]">
            {city.collaboratorName || "Sem responsável"}
          </span>
        </div>

        {alertState !== "none" && (
          <div className="flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded text-[10px] font-bold">
            {alertState === "idle" ? (
              <>
                <ClockIcon className="size-3" />
                <span>+7d</span>
              </>
            ) : (
              <>
                <CalendarIcon className="size-3" />
                <span>Prazo</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
