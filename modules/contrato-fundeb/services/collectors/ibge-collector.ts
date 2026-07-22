/**
 * IBGE Collector — Resolve município via API IBGE
 * Reutiliza a infraestrutura existente em govia-compat.ts
 */
import { findGoviaMunicipio } from "@/core/lib/govia-compat";

interface IbgeCollectorResult {
  codigoIBGE: string;
  municipioNome: string;
  municipioUF: string;
  mesorregiao: string;
  microrregiao: string;
  regiaoIntermediaria: string;
  regiao: string;
}

/**
 * Resolve os dados oficiais do município via API IBGE.
 * Aceita nome+UF ou código IBGE direto.
 */
export async function collectIbgeData(params: {
  municipioNome?: string;
  uf?: string;
  codigoIBGE?: string;
}): Promise<IbgeCollectorResult | null> {
  try {
    const municipio = await findGoviaMunicipio({
      codigo_ibge: params.codigoIBGE,
      nome: params.municipioNome,
      uf: params.uf,
    });

    if (!municipio) {
      return null;
    }

    const uf =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (municipio as any).microrregiao?.mesorregiao?.UF?.sigla ??
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (municipio as any)["regiao-imediata"]?.["regiao-intermediaria"]?.UF?.sigla ??
      params.uf ??
      "";

    const regiao =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (municipio as any).microrregiao?.mesorregiao?.UF?.regiao?.nome ??
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (municipio as any)["regiao-imediata"]?.["regiao-intermediaria"]?.UF?.regiao?.nome ??
      "Não informado";

    return {
      codigoIBGE: String(municipio.id),
      municipioNome: municipio.nome ?? "",
      municipioUF: uf,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mesorregiao: (municipio as any).microrregiao?.mesorregiao?.nome ?? "Não informado",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      microrregiao: (municipio as any).microrregiao?.nome ?? "Não informado",
      regiaoIntermediaria:
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (municipio as any)["regiao-imediata"]?.["regiao-intermediaria"]?.nome ?? "Não informado",
      regiao,
    };
  } catch (error) {
    console.error("[ibge-collector] Erro ao resolver município:", error);
    return null;
  }
}
