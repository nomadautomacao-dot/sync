import { readFile } from "node:fs/promises";
import path from "node:path";

import { getTabelasVaat, vaatInabilitado } from "@/core/lib/fundeb-fnde";
import { getPonderacaoMunicipal } from "@/core/lib/fundeb-ponderacao";
import { getValorAlunoAno } from "@/core/lib/fundeb-valor-aluno";
import { getInepCensoMunicipalRecord } from "@/core/lib/inep-censo";
import { padraoGlobal } from "@/core/lib/fundeb-padrao-global";

/**
 * Prospecção pelo VAAT — quem está perto de entrar na faixa da complementação.
 *
 * Um município habilitado acima do VAAT-MIN não recebe complementação, e cada
 * matrícula ponderada a mais vale só o fundo do estado. Mas cada uma também
 * puxa o VAAT próprio para baixo, e cruzado o piso a União passa a completar a
 * rede: dali em diante a matrícula vale o mínimo inteiro. Quanto menos falta
 * para cruzar, mais a consultoria de matrícula rende — e mais cedo.
 *
 * Para cada município:
 *
 *   faltam = ponderadas VAAT × (VAAT próprio − mínimo) ÷ (mínimo − fundo por equivalente)
 *
 * e o tempo até lá no ritmo dos municípios atendidos (`fundeb-padrao-global.ts`).
 * É um retrato do exercício: se a arrecadação própria crescer mais rápido que a
 * matrícula, a rede se afasta do piso. O VAAT usa tabela de ponderação própria;
 * aqui a matrícula nova entra pelos pesos do fundo comum, o que erra para baixo
 * em quem cresce creche.
 */

export interface LinhaProspeccao {
  codigoIbge: string;
  municipio: string;
  uf: string;
  /** Matrículas da rede municipal no Censo mais recente. */
  rede: number | null;
  ponderadasVaat: number;
  vaatProprio: number;
  vaatMinimo: number;
  /** Quanto o VAAT próprio está acima do mínimo, em %. */
  acimaDoPiso: number;
  /** Matrículas-equivalentes que faltam para entrar na faixa. */
  faltam: number;
  /** `faltam` sobre a rede municipal, em fração. */
  fracaoDaRede: number | null;
  /** Anos no Padrão Global até cruzar o piso. */
  anos: number | null;
  /** O que o fundo do estado paga por matrícula-equivalente. */
  fundoPorEquivalente: number;
  /** O que cada matrícula-equivalente passa a render a mais depois do piso. */
  premioPorEquivalente: number;
  receitaFundeb: number | null;
}

export interface ResumoProspeccao {
  exercicio: number;
  vaatMinimo: number;
  recebem: number;
  inabilitados: number;
  semDado: number;
  acimaDoPiso: number;
  emUmAno: number;
  emTresAnos: number;
  ritmoPadraoGlobal: number;
}

export interface Prospeccao {
  resumo: ResumoProspeccao;
  linhas: LinhaProspeccao[];
}

function numeroBr(texto: string | undefined): number {
  const t = (texto ?? "").trim();
  return !t || t === "-" ? 0 : Number(t.replace(/\./g, "").replace(",", ".")) || 0;
}

async function receitasDoExercicio(exercicio: number): Promise<Map<string, { nome: string; total: number }>> {
  const mapa = new Map<string, { nome: string; total: number }>();
  try {
    const csv = await readFile(path.join(process.cwd(), "data", "fnde", `receitas-${exercicio}.csv`), "utf8");
    for (const linha of csv.split(/\r?\n/)) {
      const c = linha.split(";");
      if (/^\d{7}$/.test((c[1] ?? "").trim())) mapa.set(c[1].trim(), { nome: (c[2] ?? "").trim(), total: numeroBr(c[8]) });
    }
  } catch {
    // Sem a receita a prospecção sai mesmo assim; a coluna fica em branco.
  }
  return mapa;
}

/** Calcula uma linha. Pura e exportada para teste. */
export function distanciaAoPiso(p: {
  ponderadasVaat: number;
  vaatProprio: number;
  vaatMinimo: number;
  fundoPorEquivalente: number;
}): number | null {
  const { ponderadasVaat: n, vaatProprio: proprio, vaatMinimo: minimo, fundoPorEquivalente: v } = p;
  if (!(n > 0) || !(minimo > v) || !(proprio > minimo)) return null;
  return (n * (proprio - minimo)) / (minimo - v);
}

const cache = new Map<number, Promise<Prospeccao | null>>();

export function listarProspeccaoVaat(exercicio: number): Promise<Prospeccao | null> {
  const emCurso = cache.get(exercicio);
  if (emCurso) return emCurso;
  const promessa = montar(exercicio).catch((erro) => {
    cache.delete(exercicio);
    throw erro;
  });
  cache.set(exercicio, promessa);
  return promessa;
}

async function montar(exercicio: number): Promise<Prospeccao | null> {
  const tabelas = await getTabelasVaat(exercicio);
  if (!tabelas?.minimo) return null;
  const receitas = await receitasDoExercicio(exercicio);
  const ritmo = padraoGlobal()?.porAno ?? null;
  const minimo = tabelas.minimo;

  let recebem = 0;
  let inabilitados = 0;
  let semDado = 0;
  const linhas: LinhaProspeccao[] = [];
  const codigos = new Set([...tabelas.valores.keys(), ...tabelas.habilitacao.keys()]);

  for (const codigo of codigos) {
    const hab = tabelas.habilitacao.get(codigo);
    if (vaatInabilitado(hab?.habilitacao)) {
      inabilitados++;
      continue;
    }
    const valores = tabelas.valores.get(codigo);
    if (!valores || !(valores.vaatAnterior > 0)) {
      semDado++;
      continue;
    }
    if (valores.complementacaoVAAT > 0 || valores.vaatAnterior <= minimo) {
      recebem++;
      continue;
    }
    const ponderacao = getPonderacaoMunicipal(codigo);
    const fundo = getValorAlunoAno(valores.uf)?.fundamentalParcialAnosIniciais ?? 0;
    const faltam = distanciaAoPiso({
      ponderadasVaat: ponderacao?.ponderadaVaat ?? 0,
      vaatProprio: valores.vaatAnterior,
      vaatMinimo: minimo,
      fundoPorEquivalente: fundo,
    });
    if (faltam === null) {
      semDado++;
      continue;
    }
    const rede = getInepCensoMunicipalRecord(codigo)?.matriculasMunicipaisTotal ?? null;
    const receita = receitas.get(codigo);
    linhas.push({
      codigoIbge: codigo,
      municipio: receita?.nome || valores.ente,
      uf: valores.uf,
      rede,
      ponderadasVaat: ponderacao?.ponderadaVaat ?? 0,
      vaatProprio: valores.vaatAnterior,
      vaatMinimo: minimo,
      acimaDoPiso: (valores.vaatAnterior / minimo - 1) * 100,
      faltam,
      fracaoDaRede: rede && rede > 0 ? faltam / rede : null,
      anos: rede && rede > 0 && ritmo ? faltam / (ritmo * rede) : null,
      fundoPorEquivalente: fundo,
      premioPorEquivalente: minimo - fundo,
      receitaFundeb: receita?.total ?? null,
    });
  }

  linhas.sort((a, b) => (a.anos ?? Infinity) - (b.anos ?? Infinity) || a.faltam - b.faltam);
  return {
    resumo: {
      exercicio,
      vaatMinimo: minimo,
      recebem,
      inabilitados,
      semDado,
      acimaDoPiso: linhas.length,
      emUmAno: linhas.filter((l) => l.anos !== null && l.anos <= 1).length,
      emTresAnos: linhas.filter((l) => l.anos !== null && l.anos <= 3).length,
      ritmoPadraoGlobal: ritmo ?? 0,
    },
    linhas,
  };
}
