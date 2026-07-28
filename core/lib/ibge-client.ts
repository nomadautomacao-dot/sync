export interface IbgeMunicipio {
  codigoIbge: string;
  nome: string;
  uf: string;
  regiao: string;
}

export async function searchMunicipios(queryStr: string, uf?: string): Promise<IbgeMunicipio[]> {
  const q = queryStr.trim();
  if (q.length < 2) return [];

  try {
    const params = new URLSearchParams({ q });
    if (uf && uf.trim()) {
      params.set("uf", uf.trim());
    }

    const res = await fetch(`/api/municipios/buscar?${params.toString()}`);
    if (!res.ok) return [];

    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) return [];

    return json.data.map((m: Record<string, unknown>, idx: number) => ({
      codigoIbge: String(m.codigo_ibge ?? m.codigoIbge ?? m.ibgeCode ?? m.id ?? `unknown-${idx}`),
      nome: String(m.nome ?? m.municipioNome ?? m.name ?? ""),
      uf: String(m.uf ?? m.state ?? ""),
      regiao: String(m.regiao ?? "Brasil"),
    }));
  } catch (err) {
    console.error("Erro ao buscar municípios via API local:", err);
    return [];
  }
}

export function preloadMunicipios(): void {
  // Preload por proxy do servidor — executado sob demanda no backend
}
