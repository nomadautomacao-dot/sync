"use client";

import { listFundebIndicators } from "@/modules/fundeb/services/fundeb-service";

export function IndicatorList() {
  const indicators = listFundebIndicators();

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {indicators.map((indicator) => (
        <div
          key={indicator.id}
          className="rounded-[var(--sync-radius-md)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] p-3"
        >
          <p className="text-xs uppercase tracking-wider text-[var(--sync-text-tertiary)]">
            {indicator.label}
          </p>
          <p className="mt-1 text-lg font-semibold text-[var(--sync-text-primary)]">
            {indicator.value}
          </p>
        </div>
      ))}
    </div>
  );
}
