"use client";

import type { CityAccount } from "@/core/lib/city-types";
import { STAGE_LABELS, formatCurrency } from "@/core/lib/city-types";
import { cardAlert, daysIdle, daysToDue, isHot, stagePastelColor } from "./stage-helpers";

interface PipelineTableProps {
  cities: CityAccount[];
  selectedCityId?: string;
  onSelectCity: (city: CityAccount) => void;
}

export function PipelineTable({
  cities,
  selectedCityId,
  onSelectCity,
}: PipelineTableProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/95 bg-white/[.88] shadow-[0_10px_26px_rgba(22,24,29,.05)]">
      {/* Cabeçalho */}
      <div className="flex items-center bg-surface-subtle px-4 py-[9px]">
        <span className="flex-[25] font-mono text-[10px] font-semibold uppercase tracking-[1.1px] text-soft">
          MUNICÍPIO
        </span>
        <span className="flex-[20] font-mono text-[10px] font-semibold uppercase tracking-[1.1px] text-soft">
          RESPONSÁVEL
        </span>
        <span className="flex-[20] font-mono text-[10px] font-semibold uppercase tracking-[1.1px] text-soft">
          ESTÁGIO
        </span>
        <span className="flex-[18] font-mono text-[10px] font-semibold uppercase tracking-[1.1px] text-soft">
          RECEITA EST.
        </span>
        <span className="flex-[30] font-mono text-[10px] font-semibold uppercase tracking-[1.1px] text-soft">
          PRÓXIMO PASSO
        </span>
        <span className="w-6" />
      </div>

      <div className="h-px bg-line" />

      {/* Corpo */}
      <div className="flex-1 overflow-y-auto">
        {cities.map((city) => (
          <TableRow
            key={city.id}
            city={city}
            isSelected={city.id === selectedCityId}
            onSelect={() => onSelectCity(city)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Linha da tabela ──────────────────────────────────────────

interface TableRowProps {
  city: CityAccount;
  isSelected: boolean;
  onSelect: () => void;
}

function TableRow({ city, isSelected, onSelect }: TableRowProps) {
  const isClosed = city.stage === "paused" || city.stage === "lost";
  const tone = stagePastelColor(city.stage);
  const due = daysToDue(city);
  const rawDue = city.nextStepDueDate;
  const dueDate = rawDue ? new Date(rawDue) : null;
  const validDueDate =
    dueDate && !isNaN(dueDate.getTime()) ? dueDate : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center border-b border-line px-4 py-[10px] text-left transition-colors hover:bg-surface-subtle ${
        isSelected ? "bg-primary-light" : ""
      }`}
    >
      {/* Município */}
      <span className="flex flex-[25] items-baseline gap-1.5">
        <span
          className={`truncate text-[14px] font-semibold ${
            isClosed ? "text-muted" : "text-title"
          }`}
        >
          {city.name}
        </span>
        <span className="font-mono text-[11px] text-dim">{city.uf}</span>
      </span>

      {/* Responsável */}
      <span className="flex-[20] truncate text-[13px] text-body">
        {city.collaboratorName ?? "—"}
      </span>

      {/* Estágio chip */}
      <span className="flex flex-[20]">
        <span
          className="inline-flex items-center gap-1.5 truncate rounded-[14px] px-2.5 py-[3px] font-mono text-[11px] font-medium"
          style={{ backgroundColor: tone.bg, color: tone.text }}
        >
          <span className="size-1.5 rounded-full" style={{ backgroundColor: tone.dot }} />
          {STAGE_LABELS[city.stage] ?? city.stage}
        </span>
      </span>

      {/* Receita */}
      <span className="flex-[18] truncate font-mono text-[13px] font-semibold tabular-nums text-title">
        {formatCurrency(city.estimatedAnnualRevenue)}
      </span>

      {/* Próximo Passo */}
      <span className="flex flex-[30] flex-col">
        <span className="truncate text-[13px] text-muted">
          {city.nextStepDescription ?? "Nenhum próximo passo registrado"}
        </span>
        {validDueDate && (
          <span
            className={`font-mono text-[11px] tabular-nums ${
              due !== null && due <= 7 ? "text-warning-dark" : "text-dim"
            }`}
          >
            {validDueDate.toLocaleDateString("pt-BR")}
          </span>
        )}
      </span>

      {/* Chevron */}
      <span className="flex w-6 justify-center">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-dim"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </span>
    </button>
  );
}
