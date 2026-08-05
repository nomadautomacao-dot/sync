import { NextResponse, type NextRequest } from "next/server";

import { dossieDoMunicipio } from "@/core/lib/municipios-dossie";
import { erro, falha, operador } from "@/core/lib/sistemas-http";

/**
 * O que a Global já sabe do município: população, prefeito, censo da rede
 * municipal e IDEB. Tudo de dataset local — responde na hora.
 *
 * `nome`, `uf` e `regiao` chegam por query porque a busca já os devolveu; ver
 * o comentário em `dossieDoMunicipio`.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ codigoIbge: string }> },
) {
  const guarda = await operador();
  if ("resposta" in guarda) return guarda.resposta;

  const { codigoIbge } = await params;
  const busca = request.nextUrl.searchParams;

  try {
    const dossie = dossieDoMunicipio(codigoIbge, {
      nome: busca.get("nome") ?? undefined,
      uf: busca.get("uf") ?? undefined,
      regiao: busca.get("regiao") ?? undefined,
    });

    if (!dossie) {
      return erro(
        404,
        "MUNICIPIO_DESCONHECIDO",
        `Não há dados para o código IBGE "${codigoIbge}".`,
      );
    }
    return NextResponse.json(dossie);
  } catch (e) {
    return falha(`dossiê do município ${codigoIbge}`, e);
  }
}
