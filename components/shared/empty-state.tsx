import { Inbox } from "lucide-react";
import { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
}

export function EmptyState({ title, description, icon }: EmptyStateProps) {
  return (
    <div className="sync-panel flex min-h-48 flex-col items-center justify-center gap-3 rounded-[var(--sync-radius-lg)] p-8 text-center">
      <div className="rounded-full border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] p-3">
        {icon || <Inbox className="h-5 w-5 text-[var(--sync-text-tertiary)]" />}
      </div>
      <h3 className="text-base font-semibold text-[var(--sync-text-primary)]">{title}</h3>
      <p className="max-w-sm text-sm text-[var(--sync-text-secondary)]">{description}</p>
    </div>
  );
}

