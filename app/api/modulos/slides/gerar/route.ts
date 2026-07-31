import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/core/lib/auth";
import { generateSlidesPdf, isSlidesTemplateId } from "@/core/lib/slides-pdf";
import { getFundebReceitasOficiais, getFundebReceitasHistoricas, getFundebVaatContext } from "@/core/lib/fundeb-fnde";
import { getInepCensoMunicipalRecord } from "@/core/lib/inep-censo";
import { getIbgeCidadeIndicators } from "@/core/lib/ibge-cidade-indicators";
import { getIdebMunicipalRecord } from "@/core/lib/ideb-municipal";
import { getTsePrefeitoRecord } from "@/core/lib/tse-prefeitos";
import { getSiconfiFiscalRecord } from "@/core/lib/siconfi-fiscal";
import { registrarErro } from "@/core/lib/structured-log";

const TEMPLATES_REQUIRING_MUNICIPIO = new Set(["proposta-fundeb", "resumo-executivo"]);

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: "Nao autenticado." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { templateId, codigoIbge } = body as {
      templateId?: string;
      codigoIbge?: string;
    };

    if (!templateId || !isSlidesTemplateId(templateId)) {
      return NextResponse.json(
        { error: `templateId invalido: "${templateId}". Use: institucional | proposta-fundeb | resumo-executivo` },
        { status: 400 },
      );
    }

    const requiresMunicipio = TEMPLATES_REQUIRING_MUNICIPIO.has(templateId);

    if (requiresMunicipio && !codigoIbge) {
      return NextResponse.json(
        { error: "codigoIbge e obrigatorio para o template selecionado." },
        { status: 400 },
      );
    }

    let payload: Record<string, unknown> = { templateId };
    let municipioNome: string | undefined;

    if (requiresMunicipio && codigoIbge) {
      const exercicio = new Date().getFullYear();

      const [
        receitasAtuais,
        receitasHistoricas,
        vaatContext,
        censoRecord,
        idebRecord,
        prefeitoRecord,
        ibgeIndicators,
        siconfiFiscal,
      ] = await Promise.all([
        getFundebReceitasOficiais(codigoIbge, exercicio),
        getFundebReceitasHistoricas(codigoIbge, exercicio, { anosRetroativos: 4 }),
        getFundebVaatContext(codigoIbge, exercicio),
        getInepCensoMunicipalRecord(codigoIbge),
        getIdebMunicipalRecord(codigoIbge),
        getTsePrefeitoRecord(codigoIbge),
        receitasAtuais != null
          ? getIbgeCidadeIndicators(
              receitasAtuais?.municipio ?? "",
              receitasAtuais?.uf ?? "",
            )
          : Promise.resolve(null),
        getSiconfiFiscalRecord(codigoIbge, exercicio),
      ]);

      // Re-resolve IBGE indicators if receitasAtuais was null at promise creation
      let resolvedIbgeIndicators = ibgeIndicators;
      if (!resolvedIbgeIndicators && censoRecord) {
        resolvedIbgeIndicators = await getIbgeCidadeIndicators(
          censoRecord.municipio,
          censoRecord.uf,
        );
      }

      municipioNome =
        receitasAtuais?.municipio ?? censoRecord?.municipio ?? prefeitoRecord?.municipio;

      payload = {
        templateId,
        municipio: {
          nome: municipioNome ?? "Municipio",
          uf: receitasAtuais?.uf ?? censoRecord?.uf ?? prefeitoRecord?.uf ?? "",
          codigoIbge,
          populacao: resolvedIbgeIndicators?.populacaoEstimada ?? null,
          prefeito: prefeitoRecord?.prefeito ?? prefeitoRecord?.nomeCompleto ?? null,
          partido: prefeitoRecord?.partido ?? null,
          pibPerCapita: resolvedIbgeIndicators?.pibPerCapita ?? null,
          idhm: null,
        },
        fundeb: {
          receitas: receitasHistoricas,
          receitaAtual: receitasAtuais,
          vaaf: vaatContext?.vaatAnterior ?? null,
          vaat: vaatContext?.vaatComComplementacao ?? null,
          vaar: receitasAtuais?.complementacaoVAAR ?? null,
          habilitacaoVaat: vaatContext?.habilitacao ?? null,
          complementacaoVAAT: vaatContext?.complementacaoVAAT ?? null,
        },
        censo: {
          escolas: censoRecord?.escolasMunicipaisTotal ?? censoRecord?.escolasTotal ?? null,
          matriculas: censoRecord?.matriculasMunicipaisTotal ?? censoRecord?.matriculasBasicaTotal ?? null,
          docentes: censoRecord?.docentesMunicipaisTotal ?? censoRecord?.docentesTotal ?? null,
          anoReferencia: censoRecord?.anoReferencia ?? null,
          educacaoInfantil: censoRecord?.educacaoInfantilMunicipal ?? null,
          ensinoFundamental: censoRecord?.ensinoFundamentalMunicipal ?? null,
        },
        ideb: {
          anosIniciais: idebRecord?.anosIniciaisPublica ?? null,
          anosFinais: idebRecord?.anosFinaisPublica ?? null,
          anoReferencia: idebRecord?.anoReferencia ?? null,
        },
        fiscal: siconfiFiscal
          ? {
              rcl: siconfiFiscal.rcl,
              despesaPessoalTotal: siconfiFiscal.despesaPessoalTotal,
              percentualDespesaPessoal: siconfiFiscal.percentualDespesaPessoal,
              situacaoLrf: siconfiFiscal.situacaoLrf,
              anoReferencia: siconfiFiscal.anoReferencia,
            }
          : null,
      };
    }

    const { pdfBuffer, filename } = await generateSlidesPdf(payload, templateId, municipioNome);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=${filename}`,
      },
    });
  } catch (error) {
    registrarErro("Slides/Gerar", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha na geracao de slides." },
      { status: 500 },
    );
  }
}
