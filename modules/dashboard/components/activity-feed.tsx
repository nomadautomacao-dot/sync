"use client";

import { Clock3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAudit } from "@/core/hooks/use-audit";
import { formatDate } from "@/core/lib/utils";

export function ActivityFeed() {
  const { data: audit = [] } = useAudit(10);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Atividade recente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {audit.map((entry) => (
          <div
            key={entry.id}
            className="rounded-[var(--sync-radius-md)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] px-3 py-2"
          >
            <p className="text-sm text-[var(--sync-text-primary)]">{entry.action}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-[var(--sync-text-tertiary)]">
              <Clock3 className="h-3 w-3" />
              {formatDate(entry.createdAt)}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
