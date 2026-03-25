"use client";

import { Check } from "lucide-react";
import { moduleCatalog, type ModuleKey } from "@/core/domain/module";
import { cn } from "@/core/lib/utils";

interface ModuleSelectorProps {
  value: ModuleKey[];
  onChange: (value: ModuleKey[]) => void;
}

export function ModuleSelector({ value, onChange }: ModuleSelectorProps) {
  const toggle = (moduleKey: ModuleKey) => {
    if (value.includes(moduleKey)) {
      onChange(value.filter((item) => item !== moduleKey));
      return;
    }
    onChange([...value, moduleKey]);
  };

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {moduleCatalog.map((module) => {
        const active = value.includes(module.key);
        return (
          <button
            key={module.key}
            type="button"
            onClick={() => toggle(module.key)}
            className={cn(
              "relative rounded-[var(--sync-radius-lg)] border p-4 text-left transition-all",
              active
                ? "border-[var(--sync-accent)] bg-[var(--sync-accent-muted)]"
                : "border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] hover:border-[var(--sync-border-medium)]",
            )}
          >
            <span
              className="mb-2 inline-flex h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: module.color }}
            />
            <p className="text-sm font-medium text-[var(--sync-text-primary)]">{module.label}</p>
            <p className="mt-1 text-xs text-[var(--sync-text-secondary)]">{module.description}</p>

            <span
              className={cn(
                "absolute top-3 right-3 inline-flex h-5 w-5 items-center justify-center rounded border",
                active
                  ? "border-[var(--sync-accent)] bg-[var(--sync-accent)] text-white"
                  : "border-[var(--sync-border-medium)] text-transparent",
              )}
            >
              <Check className="h-3.5 w-3.5" />
            </span>
          </button>
        );
      })}
    </div>
  );
}
