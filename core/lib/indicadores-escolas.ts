/**
 * Contexto de cada escola municipal — INSE, complexidade de gestão, distorção
 * idade-série, aprovação/abandono e adequação da formação docente.
 *
 * Os dados vêm de `data/inep/indicadores-escolas.json`, gerado offline por
 * `scripts/dados/gerar-indicadores-escolas.mjs` a partir de cinco publicações
 * do INEP (INSE 2023, ICG 2021, TDI 2024, rendimento 2024, AFD 2024).
 *
 * ## Por que entra num relatório de FUNDEB
 *
 * O IDEB sozinho pune a escola errada: a mesma nota vale coisas diferentes em
 * contextos diferentes. O cruzamento INSE × IDEB (`cruzarContextoResultado`)
 * separa a escola fraca da escola de contexto duro que performa — e o abandono
 * por escola é a Condicionalidade I do VAAR (indicador de fluxo) sendo
 * fabricada anos antes de aparecer na portaria de habilitação.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ARQUIVO = join("data", "inep", "indicadores-escolas.json");

export interface IndicadoresEscola {
  codigo: string;
  nome: string;
  /** Média INSE da escola (escala contínua do Saeb 2023). */
  inse: number | null;
  /** Nível INSE, 1 (mais vulnerável) a 8. */
  inseNivel: number | null;
  /** Alunos que responderam o questionário — peso da média da rede. */
  inseAlunos: number | null;
  /** Complexidade de gestão, 1 (simples) a 6 (porte/turnos/etapas máximos). */
  icg: number | null;
  /** Distorção idade-série no fundamental, %. */
  tdiFund: number | null;
  aprovacaoFund: number | null;
  abandonoFund: number | null;
  /** % de docentes do fundamental com formação adequada (Grupo 1). */
  docentesAdequadosFund: number | null;
}

export interface ResumoIndicadoresEscolas {
  total: number;
  /** Média INSE da rede, ponderada pelos respondentes de cada escola. */
  inseMedioRede: number | null;
  /** Escolas com abandono registrado no fundamental (> 0%). */
  comAbandono: number;
  piorAbandono: { nome: string; valor: number } | null;
  piorDistorcao: { nome: string; valor: number } | null;
  /** Média simples do % de docentes adequados entre as escolas com o dado. */
  mediaDocentesAdequados: number | null;
}

export interface CruzamentoContextoResultado {
  avaliadas: number;
  medianaInse: number;
  medianaIdeb: number;
  /** Contexto mais duro que a mediana, resultado acima dela. */
  resiliente: { nome: string; inse: number; ideb: number } | null;
  /** Contexto mais favorável que a mediana, resultado abaixo dela. */
  alerta: { nome: string; inse: number; ideb: number } | null;
}

export interface IndicadoresEscolasMunicipio {
  fonte: string;
  anos: { inse: number; icg: number; tdi: number; rendimento: number; afd: number };
  /** Ordenadas do sinal de fluxo mais grave: abandono, depois distorção. */
  escolas: IndicadoresEscola[];
  resumo: ResumoIndicadoresEscolas;
}

// ── Análise pura (testável com fixture) ─────────────────────────────────────

export function resumirIndicadores(escolas: IndicadoresEscola[]): ResumoIndicadoresEscolas {
  let somaInse = 0;
  let pesoInse = 0;
  for (const e of escolas) {
    if (e.inse !== null && e.inseAlunos !== null && e.inseAlunos > 0) {
      somaInse += e.inse * e.inseAlunos;
      pesoInse += e.inseAlunos;
    }
  }

  const comAbandono = escolas.filter((e) => (e.abandonoFund ?? 0) > 0);
  const piorAbandono = comAbandono.reduce<IndicadoresEscola | null>(
    (pior, e) => (pior === null || (e.abandonoFund ?? 0) > (pior.abandonoFund ?? 0) ? e : pior),
    null,
  );
  const comDistorcao = escolas.filter((e) => e.tdiFund !== null);
  const piorDistorcao = comDistorcao.reduce<IndicadoresEscola | null>(
    (pior, e) => (pior === null || (e.tdiFund ?? 0) > (pior.tdiFund ?? 0) ? e : pior),
    null,
  );
  const comAfd = escolas.filter((e) => e.docentesAdequadosFund !== null);

  return {
    total: escolas.length,
    inseMedioRede: pesoInse > 0 ? Math.round((somaInse / pesoInse) * 100) / 100 : null,
    comAbandono: comAbandono.length,
    piorAbandono: piorAbandono ? { nome: piorAbandono.nome, valor: piorAbandono.abandonoFund ?? 0 } : null,
    piorDistorcao: piorDistorcao ? { nome: piorDistorcao.nome, valor: piorDistorcao.tdiFund ?? 0 } : null,
    mediaDocentesAdequados:
      comAfd.length > 0
        ? Math.round((comAfd.reduce((t, e) => t + (e.docentesAdequadosFund ?? 0), 0) / comAfd.length) * 10) / 10
        : null,
  };
}

function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  const bruta = ordenados.length % 2 === 1 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2;
  return Math.round(bruta * 100) / 100;
}

/**
 * INSE × IDEB dos anos iniciais, escola a escola. A resiliente prova que o
 * contexto do município comporta resultado melhor; a de alerta mostra onde o
 * contexto favorável não está sendo convertido. Exige ao menos 5 pares para
 * as medianas significarem alguma coisa.
 */
export function cruzarContextoResultado(
  idebPorEscola: Map<string, number>,
  escolas: IndicadoresEscola[],
): CruzamentoContextoResultado | null {
  const pares = escolas
    .filter((e) => e.inse !== null && idebPorEscola.has(e.codigo))
    .map((e) => ({ nome: e.nome, inse: e.inse as number, ideb: idebPorEscola.get(e.codigo) as number }));
  if (pares.length < 5) return null;

  const medianaInse = mediana(pares.map((p) => p.inse));
  const medianaIdeb = mediana(pares.map((p) => p.ideb));

  const resiliente = pares
    .filter((p) => p.inse < medianaInse && p.ideb >= medianaIdeb)
    .sort((a, b) => b.ideb - a.ideb || a.inse - b.inse)[0] ?? null;
  const alerta = pares
    .filter((p) => p.inse > medianaInse && p.ideb < medianaIdeb)
    .sort((a, b) => a.ideb - b.ideb || b.inse - a.inse)[0] ?? null;

  return { avaliadas: pares.length, medianaInse, medianaIdeb, resiliente, alerta };
}

// ── Leitura do dataset ──────────────────────────────────────────────────────

interface ArquivoIndicadores {
  fonte?: string;
  anos?: { inse?: number; icg?: number; tdi?: number; rendimento?: number; afd?: number };
  municipios?: Record<string, { escolas?: Record<string, Record<string, unknown>> }>;
}

let cache: ArquivoIndicadores | null | undefined;

function carregar(): ArquivoIndicadores | null {
  if (cache !== undefined) return cache;
  try {
    cache = JSON.parse(readFileSync(join(process.cwd(), ARQUIVO), "utf8")) as ArquivoIndicadores;
  } catch {
    // Dataset ausente (clone sem `npm run dados:indicadores-escolas`): o bloco
    // some do relatório em vez de derrubar a geração inteira.
    cache = null;
  }
  return cache;
}

function num(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

export function getIndicadoresEscolas(codigoIBGE: string): IndicadoresEscolasMunicipio | null {
  const arquivo = carregar();
  const digits = codigoIBGE.replace(/\D/g, "");
  const registro = arquivo?.municipios?.[digits];
  if (!arquivo || !registro?.escolas) return null;

  const escolas: IndicadoresEscola[] = Object.entries(registro.escolas).map(([codigo, e]) => ({
    codigo,
    nome: typeof e.nome === "string" && e.nome ? e.nome : `Escola ${codigo}`,
    inse: num(e.inse),
    inseNivel: num(e.inseNivel),
    inseAlunos: num(e.inseAlunos),
    icg: num(e.icg),
    tdiFund: num(e.tdiFund),
    aprovacaoFund: num(e.aprovacaoFund),
    abandonoFund: num(e.abandonoFund),
    docentesAdequadosFund: num(e.docentesAdequadosFund),
  }));
  if (escolas.length === 0) return null;

  escolas.sort(
    (a, b) =>
      (b.abandonoFund ?? -1) - (a.abandonoFund ?? -1) || (b.tdiFund ?? -1) - (a.tdiFund ?? -1),
  );

  return {
    fonte: arquivo.fonte ?? "INEP — indicadores educacionais por escola",
    anos: {
      inse: arquivo.anos?.inse ?? 0,
      icg: arquivo.anos?.icg ?? 0,
      tdi: arquivo.anos?.tdi ?? 0,
      rendimento: arquivo.anos?.rendimento ?? 0,
      afd: arquivo.anos?.afd ?? 0,
    },
    escolas,
    resumo: resumirIndicadores(escolas),
  };
}
