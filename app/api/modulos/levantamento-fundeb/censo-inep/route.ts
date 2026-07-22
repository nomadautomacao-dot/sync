import { NextRequest, NextResponse } from "next/server";
import { getInepCensoMunicipalRecord, getInepCensoMunicipalHistory } from "@/core/lib/inep-censo";
import { getIdebMunicipalRecord, getIdebMetasNacionais, getIdebMunicipalHistorico } from "@/core/lib/ideb-municipal";
import { buildCensoEscolarFromInep } from "@/core/lib/fundeb-commercial";

/**
 * GET /api/modulos/levantamento-fundeb/censo-inep?codigoIbge=XXXXXXX
 *
 * Retorna os dados do Censo Escolar (INEP) e IDEB para um município.
 * Inclui histórico multi-ano para enriquecer o comparativo anual (Parte IV).
 *
 * Usado pelo Flutter no modo SICONFI direto (fallback) para enriquecer o
 * RelatorioFundeb com dados educacionais locais, sem depender do FNDE.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const codigoIbge = (searchParams.get("codigoIbge") ?? "").replace(/\D/g, "");

    if (!codigoIbge || (codigoIbge.length !== 6 && codigoIbge.length !== 7)) {
      return NextResponse.json(
        { error: "Informe um codigoIbge válido (6 ou 7 dígitos)." },
        { status: 400 },
      );
    }

    const inepRecord = getInepCensoMunicipalRecord(codigoIbge);
    const idebRecord = getIdebMunicipalRecord(codigoIbge);
    const localHistorico = getIdebMunicipalHistorico(codigoIbge);
    const censoEscolar = buildCensoEscolarFromInep(inepRecord);
    const metasNacionais = getIdebMetasNacionais();

    // Fetch multi-year history for annual comparison (Parte IV)
    const censoHistory = getInepCensoMunicipalHistory(codigoIbge);

    if (!inepRecord && !idebRecord) {
      return NextResponse.json(
        { success: false, message: "Município não encontrado na base INEP/IDEB local.", data: null },
        { status: 200 },
      );
    }

    // Build IDEB arrays merged with national metas AND full historical series
    const localAnoRef = idebRecord?.anoReferencia ?? 2023;
    const localVerificadoIniciais = idebRecord?.anosIniciaisPublica ?? null;
    const localVerificadoFinais = idebRecord?.anosFinaisPublica ?? null;
    const localVerificadoEM = idebRecord?.ensinoMedioPublica ?? null;

    const idebAnosIniciais = metasNacionais.anosIniciais.map((entry) => {
      // Try historical dataset first, then fall back to latest value for reference year
      const histEntry = localHistorico?.anosIniciais?.find((h) => h.ano === entry.ano);
      return {
        ano: entry.ano,
        metaProjetada: entry.meta,
        idebVerificado: histEntry?.ideb ?? (entry.ano === localAnoRef ? localVerificadoIniciais : null),
      };
    });

    const idebAnosFinais = metasNacionais.anosFinais.map((entry) => {
      const histEntry = localHistorico?.anosFinais?.find((h) => h.ano === entry.ano);
      return {
        ano: entry.ano,
        metaProjetada: entry.meta,
        idebVerificado: histEntry?.ideb ?? (entry.ano === localAnoRef ? localVerificadoFinais : null),
      };
    });

    const idebEnsinoMedio = metasNacionais.ensinoMedio.map((entry) => ({
      ano: entry.ano,
      metaProjetada: entry.meta,
      idebVerificado: entry.ano === localAnoRef ? localVerificadoEM : null,
    }));

    // Build per-year school base for annual comparison
    const censoHistoricoAnual = censoHistory.map((record) => {
      // Fallback: when tempoIntegralBasicaTotal is null (2023/2024 datasets),
      // calculate from subtypes (infantil + fundamental + médio + EJA + ed. especial)
      const tempoIntegral = record.tempoIntegralBasicaTotal
        ?? record.tempoIntegralBasicaPublica
        ?? ((
          (record.tempoIntegralEducacaoInfantilPublica ?? record.tempoIntegralEducacaoInfantilTotal ?? 0) +
          (record.tempoIntegralEnsinoFundamentalPublica ?? record.tempoIntegralEnsinoFundamentalTotal ?? 0) +
          (record.tempoIntegralEnsinoMedioPublica ?? record.tempoIntegralEnsinoMedioTotal ?? 0) +
          (record.tempoIntegralEjaPublica ?? record.tempoIntegralEjaTotal ?? 0) +
          (record.tempoIntegralEducacaoEspecialPublica ?? record.tempoIntegralEducacaoEspecialTotal ?? 0)
        ) || 0);

      return {
        ano: record.anoReferencia,
        totalEscolas: record.escolasMunicipaisTotal ?? 0,
        totalMatriculas: record.matriculasMunicipaisTotal ?? 0,
        tempoIntegral,
        educacaoEspecial: record.educacaoEspecialTotal ?? 0,
        eja: record.ejaTotal ?? 0,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        censoEscolar,
        idebAnosIniciais,
        idebAnosFinais,
        idebEnsinoMedio,
        inepAnoReferencia: inepRecord?.anoReferencia ?? null,
        idebAnoReferencia: idebRecord?.anoReferencia ?? null,
        // Indicadores para perfilComercial
        matriculasMunicipaisTotal: inepRecord?.matriculasMunicipaisTotal ?? 0,
        educacaoInfantilMunicipal: inepRecord?.educacaoInfantilMunicipal ?? 0,
        crecheMunicipal: inepRecord?.crecheMunicipal ?? 0,
        preEscolaMunicipal: inepRecord?.preEscolaMunicipal ?? 0,
        escolasMunicipaisTotal: inepRecord?.escolasMunicipaisTotal ?? 0,
        // Histórico multi-ano para Parte IV (Comparativo por Ano)
        censoHistoricoAnual,
      },
    });
  } catch (error) {
    console.error("[censo-inep] Erro:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao consultar dados INEP." },
      { status: 500 },
    );
  }
}
