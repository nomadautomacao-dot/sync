"use client";

import type { ReactNode } from "react";
import { cn } from "@/core/lib/utils";
import { WizardProgress } from "@/components/forms/company-wizard/wizard-progress";
import type { WizardStep } from "@/components/forms/company-wizard/types";

interface WizardLayoutProps {
  steps: WizardStep[];
  currentStep: number;
  onSelectStep: (stepIndex: number) => void;
  progress: number;
  children: ReactNode;
  footer: ReactNode;
}

export function WizardLayout({
  steps,
  currentStep,
  onSelectStep,
  progress,
  children,
  footer,
}: WizardLayoutProps) {
  return (
    <div className="overflow-hidden rounded-[var(--sync-radius-xl)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-elevated)]">
      <div className="h-1 w-full bg-[var(--sync-bg-surface)]">
        <div
          className="h-full bg-[var(--sync-accent)] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="grid gap-0 md:grid-cols-[280px_1fr]">
        <aside className="border-b border-[var(--sync-border-subtle)] p-4 md:border-r md:border-b-0 md:p-5">
          <div className="md:hidden">
            <ol className="flex items-center gap-2 overflow-x-auto pb-1">
              {steps.map((step, index) => (
                <li key={step.id}>
                  <button
                    type="button"
                    onClick={() => onSelectStep(index)}
                    className={cn(
                      "whitespace-nowrap rounded-full border px-3 py-1 text-xs",
                      index === currentStep
                        ? "border-[var(--sync-accent)] text-[var(--sync-accent)]"
                        : index < currentStep
                          ? "border-[var(--sync-status-active)] text-[var(--sync-status-active)]"
                          : "border-[var(--sync-border-medium)] text-[var(--sync-text-tertiary)]",
                    )}
                  >
                    {index + 1}. {step.title}
                  </button>
                </li>
              ))}
            </ol>
          </div>

          <div className="hidden md:block">
            <WizardProgress
              steps={steps}
              currentStep={currentStep}
              onSelectStep={onSelectStep}
            />
          </div>
        </aside>

        <section className="flex min-h-[560px] flex-col">
          <div className="flex-1 p-4 md:p-6">{children}</div>
          <div className="border-t border-[var(--sync-border-subtle)] p-4 md:p-5">{footer}</div>
        </section>
      </div>
    </div>
  );
}
