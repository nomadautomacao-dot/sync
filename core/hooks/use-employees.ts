"use client";

import { useQuery } from "@tanstack/react-query";
import type { Employee } from "@/core/domain/organization";
import { apiClient } from "@/core/lib/api-client";

interface EmployeesFilter {
  companyId?: string;
  search?: string;
}

export function useEmployees(filters: EmployeesFilter = {}) {
  const params = new URLSearchParams();
  if (filters.companyId) {
    params.set("companyId", filters.companyId);
  }
  if (filters.search) {
    params.set("search", filters.search);
  }

  return useQuery({
    queryKey: ["employees", filters.companyId ?? "", filters.search ?? ""],
    queryFn: () =>
      apiClient.get<Employee[]>(
        `/api/employees${params.size ? `?${params.toString()}` : ""}`,
      ),
    staleTime: 5 * 60 * 1000,
  });
}
