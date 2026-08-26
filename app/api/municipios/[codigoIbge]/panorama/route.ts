import { NextResponse } from "next/server";

import { getSessionUser } from "@/core/lib/auth";
import { podeVer } from "@/core/domain/rbac";
import { dossieDoMunicipio } from "@/core/lib/municipios-dossie";
import { getIdebMunicipalHistorico } from "@/core/lib/ideb-municipal";
import { registrarErro } from "@/core/lib/structured-log";

/**
 * Os números do município para o Panorama da cidade.
 *
 * **Nada aqui vai à rede.** Tudo sai dos JSON de `data/` — população do IBGE,
 * prefeito do TSE, Censo Escolar do INEP, série do IDEB. É a diferença entre um
 * painel que abre em 200ms e um que faz a consultora esperar uma dúzia de APIs
 * de governo na frente do secretário, com a chance de metade delas responder
 * "N/D". Fonte viva é para relatório emitido, não para tela que se abre o dia
 * inteiro.
 *
 * Rota própria porque `dossieDoMunicipio` é server-side: ela lê arquivo do
 * disco. A que já existia (`/api/sistemas/municipios/[codigoIbge]`) serve o
 * console de outros produtos e exige `admin` — usá-la aqui esconderia o
 * Panorama de quem só trabalha com cidades.
 */
export async function GET(
  _request: Request,
  contexto: { params: Promise<{ codigoIbge: string }> },
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!podeVer(sessionUser.permissoes, "cidades")) {
    return NextResponse.json(
      { error: "Sem acesso à área de Cidades.", code: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const { codigoIbge } = await contexto.params;

  try {
    const dossie = dossieDoMunicipio(codigoIbge);
    if (!dossie) {
      return NextResponse.json(
        { error: "Município não encontrado nos dados locais.", code: "NAO_ENCONTRADO" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      dossie,
      // A série inteira, não só o último ponto: um IDEB de 4,8 não diz nada
      // sozinho — dizer que veio de 3,9 em três edições, sim.
      historicoIdeb: getIdebMunicipalHistorico(codigoIbge.replace(/\D/g, "")),
    });
  } catch (error) {
    registrarErro("Panorama do município", error, { codigoIbge });
    return NextResponse.json(
      { error: "Não foi possível montar o panorama.", code: "PANORAMA_ERROR" },
      { status: 500 },
    );
  }
}
