"use client";

import { Check } from "lucide-react";
import { cn } from "@/core/lib/utils";
import type { WizardStep } from "@/components/forms/company-wizard/types";

interface WizardProgressProps {
  steps: WizardStep[];
  currentStep: number;
  onSelectStep: (stepIndex: number) => void;
}

export function WizardProgress({ steps, currentStep, onSelectStep }: WizardProgressProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--sync-text-tertiary)]">
        Progresso
      </p>
      <ul className="space-y-2">
        {steps.map((step, index) => {
          const done = index < currentStep;
          const active = index === currentStep;

          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onSelectStep(index)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-[var(--sync-radius-md)] border px-3 py-2 text-left transition-colors",
                  active
                    ? "border-[var(--sync-accent)] bg-[var(--sync-accent-muted)]"
                    : "border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] hover:border-[var(--sync-border-medium)]",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                    done
                      ? "border-[var(--sync-status-active)] bg-[var(--sync-status-active)] text-white"
                      : active
                        ? "border-[var(--sync-accent)] text-[var(--sync-accent)]"
                        : "border-[var(--sync-border-medium)] text-[var(--sync-text-tertiary)]",
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span>
                  <p
                    className={cn(
                      "text-sm font-medium",
                      active || done ? "text-[var(--sync-text-primary)]" : "text-[var(--sync-text-secondary)]",
                    )}
                  >
                    {step.title}
                  </p>
                  <p className="text-xs text-[var(--sync-text-tertiary)]">{step.description}</p>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
