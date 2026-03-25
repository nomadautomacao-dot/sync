"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { useAudit } from "@/core/hooks/use-audit";
import { formatDate } from "@/core/lib/utils";

export default function InboxPage() {
  const { data: audit = [] } = useAudit(30);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inbox"
        description="Notificacoes e eventos recentes de todas as empresas."
      />
      <Card>
        <CardContent className="space-y-2 p-4">
          {audit.map((entry) => (
            <div
              key={entry.id}
              className="rounded-[var(--sync-radius-md)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] px-3 py-2"
            >
              <p className="text-sm text-[var(--sync-text-primary)]">{entry.action}</p>
              <p className="text-xs text-[var(--sync-text-tertiary)]">
                {formatDate(entry.createdAt)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
