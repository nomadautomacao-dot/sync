"use client";

import { useQuery } from "@tanstack/react-query";
import type { Company } from "@/core/domain/organization";
import { apiClient } from "@/core/lib/api-client";

export function useCompanies(search?: string, status?: string) {
  const params = new URLSearchParams();
  if (search) {
    params.set("search", search);
  }
  if (status && status !== "all") {
    params.set("status", status);
  }

  return useQuery({
    queryKey: ["companies", search ?? "", status ?? "all"],
    queryFn: () =>
      apiClient.get<Company[]>(
        `/api/companies${params.size ? `?${params.toString()}` : ""}`,
      ),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCompany(companyId: string) {
  return useQuery({
    queryKey: ["companies", companyId],
    queryFn: () => apiClient.get<Company>(`/api/companies/${companyId}`),
    enabled: Boolean(companyId),
  });
}
