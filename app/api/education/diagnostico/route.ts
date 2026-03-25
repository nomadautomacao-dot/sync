import { NextRequest, NextResponse } from "next/server";
import { buildGoviaMunicipioCompleto } from "@/core/lib/govia-compat";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await buildGoviaMunicipioCompleto({
      codigo_ibge: body.codigo_ibge,
      nome: body.nome,
      uf: body.uf,
      exercicio: body.exercicio,
    });

    if (!data) {
      return NextResponse.json({ success: false, error: "Municipio nao encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      municipio: {
        codigo_ibge: data.payload.dados_basicos.codigo_ibge,
        nome: data.payload.dados_basicos.nome,
        uf: data.payload.dados_basicos.uf,
        regiao: data.payload.dados_basicos.regiao,
        populacao: data.payload.demografia.populacao,
        populacao_0_17: data.payload.demografia.populacao_0_17,
        idh: data.payload.demografia.idh,
        prefeito: data.payload.prefeito,
        partido: data.payload.partido,
        secretario_educacao: data.payload.secretario_educacao,
        educacao: data.payload.educacao,
        oportunidades: data.payload.oportunidades,
        pendencias_fnde: [],
        historico_repasses: [],
        score_viabilidade: data.payload.score_viabilidade,
        analise_ia: data.payload.analise_ia.diagnostico_executivo,
        data_atualizacao: data.payload.metadata.data_coleta,
        fontes_utilizadas: data.payload.fontes_utilizadas,
        fontes: data.payload.fontes_utilizadas,
      },
    });
  } catch (error) {
    console.error("Erro no endpoint education/diagnostico:", error);
    return NextResponse.json({ success: false, error: "Falha ao montar diagnostico." }, { status: 500 });
  }
}
