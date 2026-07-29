/**
 * Distribuição de proficiência do Saeb — a cauda que a média esconde.
 *
 * Os dados vêm de `data/inep/saeb-distribuicao.json`, gerado offline por
 * `scripts/dados/gerar-saeb-distribuicao.mjs` a partir da planilha oficial de
 * resultados do Saeb 2023 (aba Municípios, rede municipal). O microdado é
 * mascarado pós-LGPD; esta divulgação municipal é identificada.
 *
 * ## Por que entra num relatório de FUNDEB
 *
 * Duas redes com a mesma média podem ter 10% ou 35% dos alunos abaixo do
 * básico — e é essa cauda que a Condicionalidade III do VAAR observa (redução
 * das desigualdades de aprendizagem). O % abaixo do básico é o número que
 * transforma "melhorar o IDEB" em "quantos alunos, em qual etapa, em qual
 * disciplina".
 *
 * ## Agrupamento dos níveis
 *
 * O INEP publica a escala em níveis de 25 pontos sem rótulo qualitativo; o
 * agrupamento abaixo é a convenção consolidada por Todos Pela Educação/QEdu:
 *
 * | Série | Insuficiente | Básico | Proficiente | Avançado |
 * |---|---|---|---|---|
 * | LP 5º | < 150 (nív. 0–1) | 150–200 (2–3) | 200–250 (4–5) | ≥ 250 (6+) |
 * | MT 5º | < 175 (nív. 0–2) | 175–225 (3–4) | 225–275 (5–6) | ≥ 275 (7+) |
 * | LP 9º | < 200 (nív. 0) | 200–275 (1–3) | 275–325 (4–5) | ≥ 325 (6+) |
 * | MT 9º | < 225 (nív. 0) | 225–300 (1–3) | 300–350 (4–5) | ≥ 350 (6+) |
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ARQUIVO = join("data", "inep", "saeb-distribuicao.json");

export type SerieSaeb = "lp5" | "mt5" | "lp9" | "mt9";

export interface GruposProficiencia {
  insuficiente: number;
  basico: number;
  proficiente: number;
  avancado: number;
}

export interface DistribuicaoSerie {
  media: number;
  grupos: GruposProficiencia;
}

export interface SaebDistribuicaoMunicipio {
  fonte: string;
  ano: number;
  series: Partial<Record<SerieSaeb, DistribuicaoSerie>>;
}

/** Última posição de nível (inclusiva) de cada grupo, por série. */
const CORTES: Record<SerieSaeb, { insuficiente: number; basico: number; proficiente: number }> = {
  lp5: { insuficiente: 1, basico: 3, proficiente: 5 },
  mt5: { insuficiente: 2, basico: 4, proficiente: 6 },
  lp9: { insuficiente: 0, basico: 3, proficiente: 5 },
  mt9: { insuficiente: 0, basico: 3, proficiente: 5 },
};

/**
 * Agrupa o vetor de % por nível nos quatro grupos qualitativos. Puro de
 * propósito: o erro caro seria deslocar um corte e mandar um quarto da rede
 * para o grupo errado.
 */
export function agruparNiveis(serie: SerieSaeb, niveis: number[]): GruposProficiencia {
  const corte = CORTES[serie];
  const soma = (de: number, ate: number) =>
    Math.round(niveis.slice(de, ate + 1).reduce((t, v) => t + (Number.isFinite(v) ? v : 0), 0) * 10) / 10;
  return {
    insuficiente: soma(0, corte.insuficiente),
    basico: soma(corte.insuficiente + 1, corte.basico),
    proficiente: soma(corte.basico + 1, corte.proficiente),
    avancado: soma(corte.proficiente + 1, niveis.length - 1),
  };
}

interface ArquivoSaeb {
  fonte?: string;
  ano?: number;
  municipios?: Record<string, Partial<Record<SerieSaeb, { media?: number; niveis?: number[] }>>>;
}

let cache: ArquivoSaeb | null | undefined;

function carregar(): ArquivoSaeb | null {
  if (cache !== undefined) return cache;
  try {
    cache = JSON.parse(readFileSync(join(process.cwd(), ARQUIVO), "utf8")) as ArquivoSaeb;
  } catch {
    // Dataset ausente: o bloco some do relatório em vez de derrubar a geração.
    cache = null;
  }
  return cache;
}

const SERIES: SerieSaeb[] = ["lp5", "mt5", "lp9", "mt9"];

export function getSaebDistribuicao(codigoIBGE: string): SaebDistribuicaoMunicipio | null {
  const arquivo = carregar();
  const digits = codigoIBGE.replace(/\D/g, "");
  const registro = arquivo?.municipios?.[digits];
  if (!arquivo || !registro) return null;

  const series: Partial<Record<SerieSaeb, DistribuicaoSerie>> = {};
  for (const chave of SERIES) {
    const bruto = registro[chave];
    if (!bruto || typeof bruto.media !== "number" || !Array.isArray(bruto.niveis)) continue;
    series[chave] = { media: bruto.media, grupos: agruparNiveis(chave, bruto.niveis) };
  }
  if (Object.keys(series).length === 0) return null;

  return {
    fonte: arquivo.fonte ?? "INEP — planilha de resultados do Saeb, rede municipal",
    ano: arquivo.ano ?? 0,
    series,
  };
}
