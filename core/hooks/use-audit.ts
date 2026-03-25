"use client";

import { useQuery } from "@tanstack/react-query";
import type { AuditLogEntry } from "@/core/domain/organization";
import { apiClient } from "@/core/lib/api-client";

export function useAudit(limit = 20) {
  return useQuery({
    queryKey: ["audit", limit],
    queryFn: () => apiClient.get<AuditLogEntry[]>(`/api/audit?limit=${limit}`),
    staleTime: 60 * 1000,
  });
}
