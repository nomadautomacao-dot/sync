"use client";

import { useConsultoria } from "@/modules/consultoria/hooks/use-consultoria";

export function ProjectList() {
  const { data = [] } = useConsultoria();

  return (
    <div className="space-y-2">
      {data.map((project) => (
        <div
          key={project.id}
          className="rounded-[var(--sync-radius-md)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] px-3 py-2 text-sm"
        >
          <p className="font-medium text-[var(--sync-text-primary)]">{project.name}</p>
          <p className="text-xs text-[var(--sync-text-tertiary)]">Prazo: {project.dueDate}</p>
        </div>
      ))}
    </div>
  );
}
