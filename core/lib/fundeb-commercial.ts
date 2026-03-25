import type { CensoEscolar, ReceitasFundeb } from "@/modules/levantamento-fundeb/types";
import {
  calcularPerfilComercialFundeb,
  calcularProjecaoPorMultiplicador,
  createEmptyCensoEscolar,
} from "@/modules/levantamento-fundeb/utils/calculos";
import type { PerfilComercialFundeb, ProjecaoRochaPrime } from "@/modules/levantamento-fundeb/types";
import type { FndeVaatContext } from "@/core/lib/fundeb-fnde";
import type { IbgeCidadeIndicators } from "@/core/lib/ibge-cidade-indicators";
import type { InepCensoMunicipalRecord } from "@/core/lib/inep-censo";

export function buildCensoEscolarFromInep(record: InepCensoMunicipalRecord | null): CensoEscolar {
  if (!record) {
    return createEmptyCensoEscolar();
  }

  const totalEscolas = record.escolasPublicasTotal ?? record.escolasTotal;
  const totalMatriculas = record.matriculasPublicasTotal ?? record.matriculasBasicaTotal;
  const totalDocentes = record.docentesPublicosTotal ?? record.docentesTotal;
  const educacaoInfantil = record.educacaoInfantilPublica ?? record.educacaoInfantilTotal;
  const creche = record.crechePublica ?? record.crecheTotal;
  const preEscola = record.preEscolaPublica ?? record.preEscolaTotal;
  const anosIniciais = record.anosIniciaisFundamentalPublica ?? record.anosIniciaisFundamentalTotal ?? 0;
  const anosFinais = record.anosFinaisFundamentalPublica ?? record.anosFinaisFundamentalTotal ?? 0;
  const ensinoFundamental =
    record.ensinoFundamentalPublica ??
    record.ensinoFundamentalTotal ??
    Math.max(
      0,
      totalMatriculas -
        educacaoInfantil -
        (record.ensinoMedioPublica ?? record.ensinoMedioTotal ?? 0) -
        (record.ejaPublica ?? record.ejaTotal ?? 0),
    );
  const ensinoMedio = record.ensinoMedioPublica ?? record.ensinoMedioTotal ?? 0;
  const eja = record.ejaPublica ?? record.ejaTotal ?? 0;
  const educacaoEspecial = record.educacaoEspecialPublica ?? record.educacaoEspecialTotal ?? 0;
  const tempoIntegralCreche = record.tempoIntegralCrechePublica ?? record.tempoIntegralCrecheTotal ?? null;
  const tempoIntegralPreEscola = record.tempoIntegralPreEscolaPublica ?? record.tempoIntegralPreEscolaTotal ?? null;
  const tempoIntegralAnosIniciais =
    record.tempoIntegralAnosIniciaisPublica ?? record.tempoIntegralAnosIniciaisTotal ?? null;
  const tempoIntegralAnosFinais =
    record.tempoIntegralAnosFinaisPublica ?? record.tempoIntegralAnosFinaisTotal ?? null;
  const tempoIntegralEducacaoInfantil =
    record.tempoIntegralEducacaoInfantilPublica ?? record.tempoIntegralEducacaoInfantilTotal ?? null;
  const tempoIntegralEnsinoFundamental =
    record.tempoIntegralEnsinoFundamentalPublica ?? record.tempoIntegralEnsinoFundamentalTotal ?? null;

  return {
    totalEscolas,
    totalMatriculas,
    totalDocentes,
    fonte: "INEP/Censo Escolar consolidado — rede pública",
    anoReferencia: record.anoReferencia,
    recorte: "publica",
    matriculasEtapa: {
      educacaoInfantil,
      ensinoFundamental,
      ensinoMedio,
      eja,
      educacaoEspecial,
    },
    matriculasDetalhadas: {
      creche,
      preEscola,
      anosIniciais,
      anosFinais,
    },
    tempoIntegral: {
      total: record.tempoIntegralBasicaPublica ?? record.tempoIntegralBasicaTotal ?? null,
      educacaoInfantil: tempoIntegralEducacaoInfantil,
      creche: tempoIntegralCreche,
      preEscola: tempoIntegralPreEscola,
      anosIniciais: tempoIntegralAnosIniciais,
      anosFinais: tempoIntegralAnosFinais,
      ensinoFundamental: tempoIntegralEnsinoFundamental,
      ensinoMedio: record.tempoIntegralEnsinoMedioPublica ?? record.tempoIntegralEnsinoMedioTotal ?? null,
      eja: record.tempoIntegralEjaPublica ?? record.tempoIntegralEjaTotal ?? null,
      educacaoEspecial:
        record.tempoIntegralEducacaoEspecialPublica ?? record.tempoIntegralEducacaoEspecialTotal ?? null,
    },
    docentesCiclo: {
      fundamentalIniciaisFinais: totalDocentes,
      ensinoMedio: 0,
    },
  };
}

export function buildPerfilEProjecaoComercial(params: {
  receitas: ReceitasFundeb;
  ibgeIndicators: IbgeCidadeIndicators | null;
  inepRecord: InepCensoMunicipalRecord | null;
  vaatContext: FndeVaatContext | null;
}): { perfil: PerfilComercialFundeb; projecao: ProjecaoRochaPrime } {
  const perfil = calcularPerfilComercialFundeb({
    uf: params.vaatContext?.uf ?? params.inepRecord?.uf ?? "UF",
    totalReceitas: params.receitas.totalReceitas,
    complementacaoVAAT: params.receitas.complementacaoVAAT,
    populacaoEstimada:
      params.ibgeIndicators?.populacaoEstimada ?? params.ibgeIndicators?.populacaoUltimoCenso ?? null,
    receitasBrutasMunicipais: params.ibgeIndicators?.receitasBrutasMunicipais ?? null,
    matriculasMunicipais: params.inepRecord?.matriculasMunicipaisTotal ?? 0,
    escolasMunicipais: params.inepRecord?.escolasMunicipaisTotal ?? 0,
    educacaoInfantilMunicipal: params.inepRecord?.educacaoInfantilMunicipal ?? 0,
    crecheMunicipal: params.inepRecord?.crecheMunicipal ?? 0,
    preEscolaMunicipal: params.inepRecord?.preEscolaMunicipal ?? 0,
    habilitacaoVaat: params.vaatContext?.habilitacao ?? "Nao informado",
    pendenciaVaat: params.vaatContext?.pendencia ?? null,
    ieiPercentual: params.vaatContext?.ieiPercentual ?? null,
  });

  const projecao = calcularProjecaoPorMultiplicador(
    params.receitas,
    perfil.multiplicador,
    `Benchmark comercial Rocha Prime (${perfil.faixa}) baseado em score ${perfil.score.toFixed(2)}.`,
    { perfilComercial: perfil },
  );

  return { perfil, projecao };
}
