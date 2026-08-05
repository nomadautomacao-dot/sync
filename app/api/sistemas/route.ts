import { NextResponse } from "next/server";

import { CATALOGO_DE_SISTEMAS, paraTela } from "@/core/domain/sistemas";
import { resumoDoSistema } from "@/core/lib/sistemas-admin";
import { falha, operador } from "@/core/lib/sistemas-http";

/**
 * Catálogo dos produtos Global, com contagem e estado de conexão de cada um.
 *
 * O resumo de cada sistema é tolerante a falha de propósito: banco fora do ar
 * ou `databaseId` errado viram um aviso no card daquele produto, e os demais
 * continuam operáveis.
 */
export async function GET() {
  const guarda = await operador();
  if ("resposta" in guarda) return guarda.resposta;

  try {
    const sistemas = await Promise.all(
      CATALOGO_DE_SISTEMAS.map(async (sistema) => ({
        ...paraTela(sistema),
        ...(await resumoDoSistema(sistema)),
      })),
    );
    return NextResponse.json({ sistemas });
  } catch (e) {
    return falha("catálogo", e);
  }
}
