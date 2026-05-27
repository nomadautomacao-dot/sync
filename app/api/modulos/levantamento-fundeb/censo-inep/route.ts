import { NextRequest, NextResponse } from "next/server";
import { getInepCensoMunicipalRecord, getInepCensoMunicipalHistory } from "@/core/lib/inep-censo";
import { getIdebMunicipalRecord } from "@/core/lib/ideb-municipal";
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
    const censoEscolar = buildCensoEscolarFromInep(inepRecord);

    // Fetch multi-year history for annual comparison (Parte IV)
    const censoHistory = getInepCensoMunicipalHistory(codigoIbge);

    if (!inepRecord && !idebRecord) {
      return NextResponse.json(
        { success: false, message: "Município não encontrado na base INEP/IDEB local.", data: null },
        { status: 200 },
      );
    }

    const idebAnosIniciais =
      idebRecord?.anosIniciaisPublica != null
        ? [
            {
              ano: idebRecord.anoReferencia,
              idebVerificado: idebRecord.anosIniciaisPublica,
              metaProjetada: 0,
            },
          ]
        : [];

    const idebAnosFinais =
      idebRecord?.anosFinaisPublica != null
        ? [
            {
              ano: idebRecord.anoReferencia,
              idebVerificado: idebRecord.anosFinaisPublica,
              metaProjetada: 0,
            },
          ]
        : [];

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
