"use client";

import { useQuery } from "@tanstack/react-query";
import type { FundebEvolution } from "../types/case-sucesso";

export function useCaseSucessoMunicipios() {
    return useQuery({
        queryKey: ["case-sucesso", "municipios"],
        queryFn: async () => {
            const response = await fetch("/api/modulos/case-de-sucesso");
            if (!response.ok) throw new Error("Failed to fetch municipios");
            return response.json() as Promise<string[]>;
        },
    });
}

export function useCaseSucessoData(municipio: string | null) {
    return useQuery({
        queryKey: ["case-sucesso", "data", municipio],
        queryFn: async () => {
            if (!municipio) return null;
            const response = await fetch(`/api/modulos/case-de-sucesso/${encodeURIComponent(municipio)}`);
            if (!response.ok) throw new Error("Failed to fetch data");
            return response.json() as Promise<FundebEvolution>;
        },
        enabled: !!municipio,
    });
}
