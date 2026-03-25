"use client";

import { useQuery } from "@tanstack/react-query";
import type { ExecutiveDashboardData } from "@/core/domain/collaboration";
import { apiClient } from "@/core/lib/api-client";

export function useExecutiveDashboard(year: number) {
  return useQuery({
    queryKey: ["executive-dashboard", year],
    queryFn: () => apiClient.get<ExecutiveDashboardData>(`/api/dashboard/executive?year=${year}`),
    staleTime: 60 * 1000,
  });
}
