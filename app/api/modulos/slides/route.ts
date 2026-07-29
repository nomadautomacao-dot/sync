import { NextResponse } from "next/server";
import { getSessionUser } from "@/core/lib/auth";

const TEMPLATES = [
  {
    id: "institucional",
    label: "Apresentacao Institucional",
    description:
      "Apresentacao padrao da Global Company Consultorias com servicos, diferenciais e cases.",
    slideCount: 16,
    requiresMunicipio: false,
  },
  {
    id: "proposta-fundeb",
    label: "Proposta FUNDEB Municipal",
    description:
      "Apresentacao com dados reais de receita FUNDEB, censo escolar e projecoes.",
    slideCount: 12,
    requiresMunicipio: true,
  },
  {
    id: "resumo-executivo",
    label: "Resumo Executivo",
    description:
      "Versao compacta com indicadores-chave e projecao financeira.",
    slideCount: 7,
    requiresMunicipio: true,
  },
] as const;

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: "Nao autenticado." },
        { status: 401 },
      );
    }

    return NextResponse.json(TEMPLATES);
  } catch (error) {
    console.error("[Slides] Erro ao listar templates:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 },
    );
  }
}
