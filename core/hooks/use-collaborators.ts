"use client";

import { useQuery } from "@tanstack/react-query";
import type { CollaboratorDashboardData, CollaboratorListItem } from "@/core/domain/collaboration";
import { apiClient } from "@/core/lib/api-client";

interface CollaboratorFilters {
  search?: string;
  status?: string;
  type?: string;
  year?: number;
}

export function useCollaborators(filters: CollaboratorFilters = {}) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.type && filters.type !== "all") params.set("type", filters.type);
  if (filters.year) params.set("year", String(filters.year));

  return useQuery({
    queryKey: ["collaborators", filters.search ?? "", filters.status ?? "all", filters.type ?? "all", filters.year ?? ""],
    queryFn: () =>
      apiClient.get<CollaboratorListItem[]>(
        `/api/collaborators${params.size ? `?${params.toString()}` : ""}`,
      ),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCollaboratorDashboard(collaboratorId: string, year: number) {
  return useQuery({
    queryKey: ["collaborator-dashboard", collaboratorId, year],
    queryFn: () => apiClient.get<CollaboratorDashboardData>(`/api/collaborators/${collaboratorId}/dashboard?year=${year}`),
    enabled: Boolean(collaboratorId),
    staleTime: 60 * 1000,
  });
}
