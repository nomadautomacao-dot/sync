"use client";

import { useQuery } from "@tanstack/react-query";
import { listConsultoriaProjects } from "@/modules/consultoria/services/consultoria-service";

export function useConsultoria() {
  return useQuery({
    queryKey: ["consultoria-projects"],
    queryFn: async () => listConsultoriaProjects(),
  });
}
