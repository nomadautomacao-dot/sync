"use client";

import { useQuery } from "@tanstack/react-query";
import type { FundebConsultingWorkspaceData } from "@/core/domain/fundeb-consulting";
import { apiClient } from "@/core/lib/api-client";

export function useFundebConsultingWorkspace(year: number) {
  return useQuery({
    queryKey: ["fundeb-consulting-workspace", year],
    queryFn: () => apiClient.get<FundebConsultingWorkspaceData>(`/api/fundeb-consulting?year=${year}`),
    staleTime: 60 * 1000,
  });
}
