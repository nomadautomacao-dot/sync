import { NextRequest, NextResponse } from "next/server";
import {
  normalizarIBGE,
  validarCodigoIBGE,
} from "@/modules/levantamento-fundeb/utils/calculos";
import { buildGoviaMunicipioCompleto } from "@/core/lib/govia-compat";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ codigoIbge: string }> },
) {
  const { codigoIbge } = await params;
  const exercicioParam = Number(request.nextUrl.searchParams.get("exercicio"));
  const exercicio = Number.isFinite(exercicioParam) && exercicioParam > 2000 ? exercicioParam : new Date().getFullYear();

  if (!validarCodigoIBGE(codigoIbge)) {
    return NextResponse.json({ error: "Código IBGE inválido. Informe 6 ou 7 dígitos." }, { status: 400 });
  }

  try {
    const payload = await buildGoviaMunicipioCompleto({
      codigo_ibge: codigoIbge,
      exercicio,
    });

    if (!payload) {
      return NextResponse.json({ error: "Município não encontrado." }, { status: 404 });
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Erro ao montar levantamento FUNDEB:", error);
    return NextResponse.json(
      {
        error:
          normalizarIBGE(codigoIbge).length === 6
            ? "Falha ao consultar os dados do município. Tente novamente."
            : "Falha ao consultar o IBGE pelo código informado.",
      },
      { status: 500 },
    );
  }
}
