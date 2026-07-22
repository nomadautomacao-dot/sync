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

  // FUNDEB/QEdu alignment: prioritize Rede Pública (Municipal + Estadual) totals 
  // to match the standard QEdu "Visão Geral" that clients use as benchmark.
  const totalEscolas = record.escolasPublicasTotal ?? record.escolasMunicipaisTotal ?? record.escolasTotal;
  const totalMatriculas = record.matriculasPublicasTotal ?? record.matriculasMunicipaisTotal ?? record.matriculasBasicaTotal;
  const totalDocentes = record.docentesPublicosTotal ?? record.docentesMunicipaisTotal ?? record.docentesTotal;
  const educacaoInfantil = record.educacaoInfantilMunicipal ?? record.educacaoInfantilPublica ?? record.educacaoInfantilTotal;
  const creche = record.crecheMunicipal ?? record.crechePublica ?? record.crecheTotal;
  const preEscola = record.preEscolaMunicipal ?? record.preEscolaPublica ?? record.preEscolaTotal;
  let anosIniciais = record.anosIniciaisFundamentalMunicipal ?? record.anosIniciaisFundamentalPublica ?? record.anosIniciaisFundamentalTotal ?? 0;
  let anosFinais = record.anosFinaisFundamentalMunicipal ?? record.anosFinaisFundamentalPublica ?? record.anosFinaisFundamentalTotal ?? 0;
  // When AI/AF breakdown is unavailable but total fundamental exists,
  // assign all to anos iniciais (typical for municipal networks that don't operate AF)
  const ensinoFundamentalRaw =
    record.ensinoFundamentalMunicipal ??
    record.ensinoFundamentalPublica ??
    record.ensinoFundamentalTotal ?? 0;
  if (anosIniciais === 0 && anosFinais === 0 && ensinoFundamentalRaw > 0) {
    anosIniciais = ensinoFundamentalRaw;
  }
  const ensinoFundamental =
    record.ensinoFundamentalMunicipal ??
    record.ensinoFundamentalPublica ??
    record.ensinoFundamentalTotal ??
    Math.max(
      0,
      totalMatriculas -
        educacaoInfantil -
        (record.ensinoMedioMunicipal ?? record.ensinoMedioPublica ?? record.ensinoMedioTotal ?? 0) -
        (record.ejaMunicipal ?? record.ejaPublica ?? record.ejaTotal ?? 0),
    );
  // Ensino Médio municipal é tipicamente 0 (competência estadual)
  const ensinoMedio = record.ensinoMedioMunicipal ?? 0;
  const eja = record.ejaMunicipal ?? record.ejaPublica ?? record.ejaTotal ?? 0;
  const educacaoEspecial = record.educacaoEspecialMunicipal ?? record.educacaoEspecialPublica ?? record.educacaoEspecialTotal ?? 0;
  const tempoIntegralCreche = record.tempoIntegralCrecheMunicipal ?? record.tempoIntegralCrechePublica ?? record.tempoIntegralCrecheTotal ?? null;
  const tempoIntegralPreEscola = record.tempoIntegralPreEscolaMunicipal ?? record.tempoIntegralPreEscolaPublica ?? record.tempoIntegralPreEscolaTotal ?? null;
  const tempoIntegralAnosIniciais =
    record.tempoIntegralAnosIniciaisMunicipal ?? record.tempoIntegralAnosIniciaisPublica ?? record.tempoIntegralAnosIniciaisTotal ?? null;
  const tempoIntegralAnosFinais =
    record.tempoIntegralAnosFinaisMunicipal ?? record.tempoIntegralAnosFinaisPublica ?? record.tempoIntegralAnosFinaisTotal ?? null;
  const tempoIntegralEducacaoInfantil =
    record.tempoIntegralEducacaoInfantilMunicipal ?? record.tempoIntegralEducacaoInfantilPublica ?? record.tempoIntegralEducacaoInfantilTotal ?? null;
  const tempoIntegralEnsinoFundamental =
    record.tempoIntegralEnsinoFundamentalMunicipal ?? record.tempoIntegralEnsinoFundamentalPublica ?? record.tempoIntegralEnsinoFundamentalTotal ?? null;

  return {
    totalEscolas,
    totalMatriculas,
    totalDocentes,
    fonte: "INEP/Censo Escolar consolidado — rede municipal",
    anoReferencia: record.anoReferencia,
    recorte: "municipal",
    matriculasEtapa: {
      educacaoInfantil,
      ensinoFundamental,
      ensinoMedio,
      ensinoMedioPublica: record.ensinoMedioPublica ?? null,
      ensinoMedioTotal: record.ensinoMedioTotal ?? null,
      eja,
      educacaoEspecial,
    },
    matriculasDetalhadas: {
      creche,
      preEscola,
      anosIniciais,
      anosFinais,
      anosFinaisPublica: record.anosFinaisFundamentalPublica ?? null,
    },
    tempoIntegral: {
      total: record.tempoIntegralBasicaMunicipal ?? record.tempoIntegralBasicaPublica ?? record.tempoIntegralBasicaTotal ?? null,
      educacaoInfantil: tempoIntegralEducacaoInfantil,
      creche: tempoIntegralCreche,
      preEscola: tempoIntegralPreEscola,
      anosIniciais: tempoIntegralAnosIniciais,
      anosFinais: tempoIntegralAnosFinais,
      anosFinaisPublica: record.tempoIntegralAnosFinaisPublica ?? null,
      ensinoFundamental: tempoIntegralEnsinoFundamental,
      ensinoMedio: record.tempoIntegralEnsinoMedioMunicipal ?? 0,
      ensinoMedioPublica: record.tempoIntegralEnsinoMedioPublica ?? null,
      eja: record.tempoIntegralEjaMunicipal ?? record.tempoIntegralEjaPublica ?? record.tempoIntegralEjaTotal ?? null,
      educacaoEspecial:
        record.tempoIntegralEducacaoEspecialMunicipal ?? record.tempoIntegralEducacaoEspecialPublica ?? record.tempoIntegralEducacaoEspecialTotal ?? null,
    },
    docentesCiclo: {
      fundamentalIniciaisFinais: totalDocentes,
      ensinoMedio: 0,
    },
    dadosPublicosTotal: {
      totalEscolas: record.escolasPublicasTotal ?? record.escolasTotal ?? 0,
      totalMatriculas: record.matriculasPublicasTotal ?? record.matriculasBasicaTotal ?? 0,
      totalDocentes: record.docentesPublicosTotal ?? record.docentesTotal ?? 0,
      infantil: record.educacaoInfantilPublica ?? 0,
      fundamentalMedio: (record.ensinoFundamentalPublica ?? 0) + (record.ensinoMedioPublica ?? 0),
      eja: record.ejaPublica ?? 0,
      especial: record.educacaoEspecialPublica ?? 0,
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
