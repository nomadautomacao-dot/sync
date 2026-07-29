/**
 * Saeb e IDEB **por escola** da rede municipal.
 *
 * Os dados vêm de `data/inep/ideb-escolas-2023.json`, gerado offline por
 * `scripts/dados/gerar-ideb-escolas.mjs` a partir das planilhas de divulgação
 * do INEP — a via **identificada** oficial. O microdado do Saeb é anonimizado
 * (máscaras no lugar dos códigos IBGE e INEP, verificado em 2026-07-29), então
 * a divulgação do IDEB é o único caminho público até o nome da escola.
 *
 * ## Por que entra num relatório de FUNDEB
 *
 * A Condicionalidade II do VAAR exige 80% de participação no Saeb, e a marca
 * `nd` deste dataset é o resultado **retido pelo critério de divulgação do
 * INEP** — participação abaixo de 80% naquela escola. A condicionalidade
 * reprova a rede, mas quem falta à prova é a escola: 356 municípios reprovados
 * na Cond. II em 2026 têm escolas `nd`, e esta é a página que as nomeia.
 *
 * A média municipal também esconde amplitude: redes com o mesmo IDEB agregado
 * escondem diferenças de 2+ pontos entre a melhor e a pior escola.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ARQUIVO = join("data", "inep", "ideb-escolas-2023.json");

export interface EtapaEscola {
  aprovacao: number | null;
  rendimento: number | null;
  lp: number | null;
  mt: number | null;
  media: number | null;
  ideb: number | null;
  /** Última meta projetada pelo INEP — não há projeção após 2021. */
  meta2021: number | null;
  /** Resultado retido: participação abaixo de 80% no Saeb desta escola. */
  nd: boolean;
}

export interface EscolaIdeb {
  codigo: string;
  nome: string;
  ai: EtapaEscola | null;
  af: EtapaEscola | null;
}

export interface IdebEscolasMunicipio {
  fonte: string;
  ano: number;
  uf: string;
  /** ND primeiro (é o sinal da Cond. II), depois do pior IDEB para o melhor. */
  escolas: EscolaIdeb[];
  resumo: {
    total: number;
    /** Escolas com resultado retido por participação < 80% em alguma etapa. */
    semResultadoPorParticipacao: number;
    comIdebAi: number;
    comIdebAf: number;
    piorIdebAi: number | null;
    melhorIdebAi: number | null;
    /** Distância entre a melhor e a pior escola — o que a média esconde. */
    amplitudeAi: number | null;
  };
}

interface ArquivoIdebEscolas {
  fonte?: string;
  ano?: number;
  municipios?: Record<
    string,
    { uf?: string; escolas?: Record<string, { nome?: string; ai?: EtapaEscola; af?: EtapaEscola }> }
  >;
}

let cache: ArquivoIdebEscolas | null | undefined;

function carregar(): ArquivoIdebEscolas | null {
  if (cache !== undefined) return cache;
  try {
    cache = JSON.parse(readFileSync(join(process.cwd(), ARQUIVO), "utf8")) as ArquivoIdebEscolas;
  } catch {
    // Dataset ausente (clone sem `npm run dados:ideb-escolas`): o bloco some
    // do relatório em vez de derrubar a geração inteira.
    cache = null;
  }
  return cache;
}

function temNd(escola: EscolaIdeb): boolean {
  return escola.ai?.nd === true || escola.af?.nd === true;
}

/** IDEB de ordenação: o pior das duas etapas; sem IDEB vai para o fim. */
function idebOrdenacao(escola: EscolaIdeb): number {
  const valores = [escola.ai?.ideb, escola.af?.ideb].filter((v): v is number => typeof v === "number");
  return valores.length ? Math.min(...valores) : Number.POSITIVE_INFINITY;
}

export function getIdebEscolas(codigoIBGE: string): IdebEscolasMunicipio | null {
  const arquivo = carregar();
  const digits = codigoIBGE.replace(/\D/g, "");
  const registro = arquivo?.municipios?.[digits];
  if (!arquivo || !registro?.escolas) return null;

  const escolas: EscolaIdeb[] = Object.entries(registro.escolas).map(([codigo, e]) => ({
    codigo,
    nome: e.nome ?? `Escola ${codigo}`,
    ai: e.ai ?? null,
    af: e.af ?? null,
  }));
  if (escolas.length === 0) return null;

  escolas.sort((a, b) => {
    const ndA = temNd(a) ? 0 : 1;
    const ndB = temNd(b) ? 0 : 1;
    if (ndA !== ndB) return ndA - ndB;
    return idebOrdenacao(a) - idebOrdenacao(b);
  });

  const idebsAi = escolas.map((e) => e.ai?.ideb).filter((v): v is number => typeof v === "number");
  const idebsAf = escolas.filter((e) => typeof e.af?.ideb === "number").length;

  return {
    fonte: arquivo.fonte ?? "INEP — divulgação do IDEB por escola",
    ano: arquivo.ano ?? 0,
    uf: registro.uf ?? "",
    escolas,
    resumo: {
      total: escolas.length,
      semResultadoPorParticipacao: escolas.filter(temNd).length,
      comIdebAi: idebsAi.length,
      comIdebAf: idebsAf,
      piorIdebAi: idebsAi.length ? Math.min(...idebsAi) : null,
      melhorIdebAi: idebsAi.length ? Math.max(...idebsAi) : null,
      amplitudeAi: idebsAi.length >= 2 ? Math.round((Math.max(...idebsAi) - Math.min(...idebsAi)) * 10) / 10 : null,
    },
  };
}
