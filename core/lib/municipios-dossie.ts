/**
 * O que a Global já sabe de um município, no instante em que se digita o nome.
 *
 * Tudo aqui sai de dataset **local** (`data/*.json`, bundlado no build): IBGE,
 * INEP, TSE. Nenhuma chamada de rede. Foi decisão de projeto: isto alimenta um
 * diálogo de cadastro, e diálogo que espera API pública de governo responder é
 * diálogo que trava — os relatórios do FUNDEB existem justamente para o caminho
 * lento, com as dezenas de fontes vivas.
 *
 * O que **não** entra aqui: qualquer indicador que exija rede (SICONFI, QEdu,
 * Portal da Transparência, FNDE). Se um dia fizer falta no cadastro, o caminho
 * é gerar o dataset em `scripts/dados/` e importar, não chamar a API daqui.
 */

import type { ReferenciaCenso } from "@/core/domain/sistemas";
import { getIdebMunicipalRecord } from "@/core/lib/ideb-municipal";
import { getInepCensoMunicipalRecord } from "@/core/lib/inep-censo";
import { getTsePrefeitoRecord } from "@/core/lib/tse-prefeitos";
import { searchGoviaMunicipios } from "@/core/lib/govia-compat";
import populacao2022 from "@/data/ibge-populacao-2022.json";

const populacaoPorIbge = populacao2022 as Record<string, number>;

export interface MunicipioEncontrado {
  codigoIbge: string;
  nome: string;
  uf: string;
  regiao?: string;
}

export interface DossieDoMunicipio {
  codigoIbge: string;
  nome: string;
  uf: string;
  regiao?: string;
  populacao?: number;
  prefeito?: string;
  partido?: string;
  censo?: ReferenciaCenso;
  ideb?: { anosIniciais: number | null; anosFinais: number | null; ano: number };
  /** Fontes que não tinham este município — a tela diz o que faltou. */
  semDados: string[];
}

export async function buscarMunicipios(
  termo: string,
  uf?: string,
): Promise<MunicipioEncontrado[]> {
  const achados = await searchGoviaMunicipios(termo, uf);
  return achados.map((m) => ({
    codigoIbge: String(m.codigo_ibge),
    nome: m.nome,
    uf: m.uf,
    regiao: m.regiao,
  }));
}

/** Normaliza número que pode vir ausente ou nulo do dataset. */
const num = (valor: number | null | undefined): number => (typeof valor === "number" ? valor : 0);

/**
 * Dossiê pelo código do IBGE.
 *
 * `identidade` é o que a busca já devolveu (nome, UF, região). Vem de fora de
 * propósito: reconsultar o IBGE só para redescobrir o nome de um município que
 * o usuário acabou de escolher numa lista é rede à toa, e uma fonte a mais para
 * ficar fora do ar no meio de um cadastro. Sem ela, cai no que os datasets
 * locais souberem.
 */
export function dossieDoMunicipio(
  codigoIbge: string,
  identidade?: { nome?: string; uf?: string; regiao?: string },
): DossieDoMunicipio | null {
  const digitos = codigoIbge.replace(/\D/g, "");
  if (digitos.length !== 7) return null;

  const censo = getInepCensoMunicipalRecord(digitos);
  const prefeito = getTsePrefeitoRecord(digitos);
  const ideb = getIdebMunicipalRecord(digitos);
  const populacao = populacaoPorIbge[digitos];

  // O censo traz a UF por extenso ("Bahia"); quem vale para cadastro e para o
  // Educacenso é a sigla, que vem da busca ou do TSE.
  const nome = identidade?.nome?.trim() || censo?.municipio || prefeito?.municipio;
  const uf = identidade?.uf?.trim().toUpperCase() || prefeito?.uf;
  if (!nome || !uf) return null;

  const semDados: string[] = [];
  if (!censo) semDados.push("Censo Escolar (INEP)");
  if (!prefeito) semDados.push("Prefeito eleito (TSE)");
  if (!ideb) semDados.push("IDEB (INEP)");
  if (populacao === undefined) semDados.push("População (IBGE)");

  return {
    codigoIbge: digitos,
    nome,
    uf,
    regiao: identidade?.regiao,
    populacao,
    prefeito: prefeito?.prefeito,
    partido: prefeito?.partido,
    censo: censo
      ? {
          ano: censo.anoReferencia,
          escolasMunicipais: num(censo.escolasMunicipaisTotal),
          escolasNoMunicipio: num(censo.escolasTotal),
          matriculasMunicipais: num(censo.matriculasMunicipaisTotal),
          docentesMunicipais: num(censo.docentesMunicipaisTotal),
          porEtapa: {
            creche: num(censo.crecheMunicipal),
            preEscola: num(censo.preEscolaMunicipal),
            anosIniciais: num(censo.anosIniciaisFundamentalMunicipal),
            anosFinais: num(censo.anosFinaisFundamentalMunicipal),
            eja: num(censo.ejaMunicipal),
            educacaoEspecial: num(censo.educacaoEspecialMunicipal),
          },
        }
      : undefined,
    ideb: ideb
      ? {
          anosIniciais: ideb.anosIniciaisPublica,
          anosFinais: ideb.anosFinaisPublica,
          ano: ideb.anoReferencia,
        }
      : undefined,
    semDados,
  };
}
