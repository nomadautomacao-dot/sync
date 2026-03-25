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
      data: {
        codigo_ibge: data.payload.dados_basicos.codigo_ibge,
        nome: data.payload.dados_basicos.nome,
        uf: data.payload.dados_basicos.uf,
        regiao: data.payload.dados_basicos.regiao,
        populacao: data.payload.demografia.populacao,
        idh: data.payload.demografia.idh,
        educacao: {
          total_escolas: data.payload.educacao.total_escolas,
          total_matriculas: data.payload.educacao.total_matriculas,
          ideb_anos_iniciais: data.payload.educacao.ideb_anos_iniciais,
          ideb_anos_finais: data.payload.educacao.ideb_anos_finais,
          lista_escolas: [],
        },
        fiscal: {
          receita_total: data.payload.fiscal.receita_total,
          despesa_pessoal: data.payload.fiscal.despesa_pessoal,
          situacao_lrf: data.payload.fiscal.situacao_lrf,
        },
        analise_ia: data.payload.analise_ia.diagnostico_executivo,
        fontes_utilizadas: data.payload.fontes_utilizadas,
        score_viabilidade: data.payload.score_viabilidade,
      },
    });
  } catch (error) {
    console.error("Erro no endpoint agents/populate-municipality:", error);
    return NextResponse.json({ success: false, error: "Falha ao popular municipio." }, { status: 500 });
  }
}
