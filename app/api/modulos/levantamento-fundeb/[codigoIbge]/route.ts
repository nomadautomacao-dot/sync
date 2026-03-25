import { NextRequest, NextResponse } from "next/server";
import {
  createDefaultFontes,
  hydrateRelatorioFundeb,
  normalizarIBGE,
  validarCodigoIBGE,
} from "@/modules/levantamento-fundeb/utils/calculos";
import type { LevantamentoFundebPayload, MunicipioIdentificacao } from "@/modules/levantamento-fundeb/types";

interface IbgeMunicipioResponse {
  id: number;
  nome: string;
  microrregiao?: {
    nome?: string;
    mesorregiao?: {
      nome?: string;
      UF?: {
        sigla?: string;
        nome?: string;
        regiao?: {
          nome?: string;
        };
      };
    };
  };
  ["regiao-imediata"]?: {
    ["regiao-intermediaria"]?: {
      nome?: string;
    };
  };
}

async function resolveIbgeMunicipio(codigo: string): Promise<IbgeMunicipioResponse | null> {
  const digits = codigo.replace(/\D/g, "");

  if (digits.length === 7) {
    const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${digits}`, {
      next: { revalidate: 60 * 60 * 12 },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as IbgeMunicipioResponse;
  }

  const response = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios", {
    next: { revalidate: 60 * 60 * 12 },
  });

  if (!response.ok) {
    return null;
  }

  const municipios = (await response.json()) as IbgeMunicipioResponse[];
  return municipios.find((municipio) => String(municipio.id).startsWith(digits)) ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ codigoIbge: string }> },
) {
  const { codigoIbge } = await params;
  const exercicioParam = Number(request.nextUrl.searchParams.get("exercicio"));
  const exercicio = Number.isFinite(exercicioParam) && exercicioParam > 2000 ? exercicioParam : new Date().getFullYear();

  if (!validarCodigoIBGE(codigoIbge)) {
    return NextResponse.json({ error: "Codigo IBGE invalido. Informe 6 ou 7 digitos." }, { status: 400 });
  }

  try {
    const municipio = await resolveIbgeMunicipio(codigoIbge);

    if (!municipio) {
      return NextResponse.json({ error: "Municipio nao encontrado no IBGE." }, { status: 404 });
    }

    const uf = municipio.microrregiao?.mesorregiao?.UF?.sigla ?? "UF";
    const identificacao: MunicipioIdentificacao = {
      municipio: `${municipio.nome} - ${uf}`,
      municipioNome: municipio.nome,
      uf,
      codigoIBGE: String(municipio.id),
      prefeito: "Nao informado",
      partido: "Nao informado",
      exercicio,
      fonte: `Portaria FNDE / MEC - FUNDEB ${exercicio}`,
      mesorregiao: municipio.microrregiao?.mesorregiao?.nome ?? "Nao informado",
      microrregiao: municipio.microrregiao?.nome ?? "Nao informado",
      regiaoIntermediaria: municipio["regiao-imediata"]?.["regiao-intermediaria"]?.nome ?? "Nao informado",
      regiao: municipio.microrregiao?.mesorregiao?.UF?.regiao?.nome ?? "Nao informado",
    };

    const payload: LevantamentoFundebPayload = {
      relatorio: hydrateRelatorioFundeb({
        identificacao,
      }),
      fontes: createDefaultFontes(),
    };

    payload.fontes = payload.fontes.map((fonte) =>
      fonte.id === "ibge"
        ? {
            ...fonte,
            descricao: `Dados territoriais carregados automaticamente para ${municipio.nome}.`,
          }
        : fonte,
    );

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Erro ao montar levantamento FUNDEB:", error);
    return NextResponse.json(
      {
        error:
          normalizarIBGE(codigoIbge).length === 6
            ? "Falha ao consultar o IBGE. Tente novamente em instantes."
            : "Falha ao consultar o IBGE pelo codigo informado.",
      },
      { status: 500 },
    );
  }
}
