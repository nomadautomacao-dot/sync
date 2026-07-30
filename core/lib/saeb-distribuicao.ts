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

export interface ReferenciaSerie {
  /** Quantas redes municipais entraram na comparação desta série. */
  redes: number;
  medianaInsuficiente: number;
  medianaAvancado: number;
  /** Percentil 99 de avançado — acima dele a distribuição é atípica no país. */
  p99Avancado: number;
  /** Vetores ordenados, para posicionar um município na distribuição. */
  insuficiente: number[];
  avancado: number[];
}

let referencia: Partial<Record<SerieSaeb, ReferenciaSerie>> | undefined;

function quantil(ordenado: number[], p: number): number {
  if (ordenado.length === 0) return 0;
  return ordenado[Math.min(ordenado.length - 1, Math.floor(p * ordenado.length))];
}

/**
 * A distribuição das próprias redes municipais do país, por série.
 *
 * Existe por dois motivos. O primeiro é dar régua: "24% no insuficiente" não
 * significa nada sozinho, e significa muito ao lado da mediana nacional de 18,6%.
 *
 * O segundo é defensivo. Há uma cauda de redes com valores implausíveis — 57
 * municípios declaram mais de 60% dos alunos no nível avançado em Língua
 * Portuguesa do 5º ano, contra mediana nacional de 20%. Entregar isso a um
 * prefeito como conquista, sem dizer onde o número cai no país, é o tipo de
 * afirmação que derruba o documento inteiro quando alguém confere.
 *
 * Computada uma vez por processo: são 5.442 municípios × 4 séries.
 */
export function getReferenciaNacionalSaeb(): Partial<Record<SerieSaeb, ReferenciaSerie>> {
  if (referencia !== undefined) return referencia;

  const arquivo = carregar();
  referencia = {};
  if (!arquivo?.municipios) return referencia;

  for (const chave of SERIES) {
    const insuficiente: number[] = [];
    const avancado: number[] = [];

    for (const registro of Object.values(arquivo.municipios)) {
      const bruto = registro[chave];
      if (!bruto || !Array.isArray(bruto.niveis)) continue;
      const grupos = agruparNiveis(chave, bruto.niveis);
      insuficiente.push(grupos.insuficiente);
      avancado.push(grupos.avancado);
    }
    if (insuficiente.length === 0) continue;

    insuficiente.sort((a, b) => a - b);
    avancado.sort((a, b) => a - b);

    referencia[chave] = {
      redes: insuficiente.length,
      medianaInsuficiente: quantil(insuficiente, 0.5),
      medianaAvancado: quantil(avancado, 0.5),
      p99Avancado: quantil(avancado, 0.99),
      insuficiente,
      avancado,
    };
  }

  return referencia;
}

/** Posição de `valor` num vetor ordenado, em percentil de 0 a 100. */
export function percentilEm(ordenado: number[], valor: number): number | null {
  if (ordenado.length === 0) return null;
  let abaixo = 0;
  while (abaixo < ordenado.length && ordenado[abaixo] < valor) abaixo += 1;
  return Math.round((abaixo / ordenado.length) * 1000) / 10;
}

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
