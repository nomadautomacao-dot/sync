import { getFndeObrasEnrichment } from "@/core/lib/fnde-obras";

interface IbgeMunicipioResponse {
  id: number;
  nome: string;
  microrregiao?: {
    mesorregiao?: {
      UF?: {
        sigla?: string;
      };
    };
  };
}

export interface SimecObrasRecord {
  codigoIBGE: string;
  municipio: string;
  uf: string;
  obrasPAC2: Awaited<ReturnType<typeof getFndeObrasEnrichment>>["obrasPAC2"];
  observacoes: string[];
  fontes: string[];
  totalObras: number;
  valorEstimadoRepactuacao: number | null;
  valorPagoInfraestrutura: number | null;
  situacao: "publico_parcial" | "indisponivel";
}

async function resolveMunicipio(codigoIBGE: string): Promise<IbgeMunicipioResponse | null> {
  const digits = codigoIBGE.replace(/\D/g, "");
  const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${digits}`, {
    next: { revalidate: 60 * 60 * 12 },
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as IbgeMunicipioResponse;
}

export async function getSimecObrasRecord(codigoIBGE: string): Promise<SimecObrasRecord | null> {
  const municipio = await resolveMunicipio(codigoIBGE);

  if (!municipio) {
    return null;
  }

  const uf = municipio.microrregiao?.mesorregiao?.UF?.sigla ?? "";
  const enrichment = await getFndeObrasEnrichment({
    municipio: municipio.nome,
    uf,
  });

  return {
    codigoIBGE: String(municipio.id),
    municipio: municipio.nome,
    uf,
    obrasPAC2: enrichment.obrasPAC2,
    observacoes: enrichment.observacoes,
    fontes: enrichment.fontes,
    totalObras: enrichment.totalObras,
    valorEstimadoRepactuacao: enrichment.valorEstimadoRepactuacao,
    valorPagoInfraestrutura: enrichment.valorPagoInfraestrutura,
    situacao: enrichment.totalObras > 0 || enrichment.valorPagoInfraestrutura ? "publico_parcial" : "indisponivel",
  };
}
