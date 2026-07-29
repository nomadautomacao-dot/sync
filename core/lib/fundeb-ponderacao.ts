/**
 * Matrícula **ponderada** do FUNDEB — o denominador que a receita realmente
 * usa.
 *
 * Os dados vêm de `data/fnde/matriculas-ponderadas-2026.json`, gerado offline
 * por `scripts/dados/gerar-matriculas-ponderadas.mjs` a partir da planilha de
 * matrículas ponderadas do FNDE.
 *
 * ## Por que entra num relatório de FUNDEB
 *
 * A receita é proporcional a Σ(matrícula × fator), não à matrícula. O fator vai
 * de 1,00 (anos iniciais urbano — a referência do art. 7º, §1º da Lei
 * 14.113/2020) a 2,17 (creche integral indígena ou quilombola). Duas redes com
 * o mesmo número de alunos podem valer receitas muito diferentes, e um
 * relatório que só mostra matrícula bruta não explica a própria receita que
 * apresenta duas páginas antes.
 *
 * É também onde mora a maior perda evitável do fundo: jornada, localização e
 * atendimento especializado declarados a menor no Censo rebaixam o fator, e o
 * erro se repete a cada exercício até ser corrigido na coleta.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ARQUIVO = join("data", "fnde", "matriculas-ponderadas-2026.json");

export interface SegmentoPonderado {
  nome: string;
  matriculas: number;
  fatorVaaf: number | null;
  /** Matrículas × fator: a contribuição do segmento para o total ponderado. */
  equivalentes: number;
  /** Participação do segmento no total ponderado da rede, em %. */
  participacao: number;
}

export interface OportunidadePonderacao {
  chave: "creche-integral" | "aee";
  titulo: string;
  /** Matrículas hoje na condição de menor fator. */
  matriculas: number;
  /** Ganho em matrículas-equivalentes se a condição fosse a de maior fator. */
  ganhoEquivalentes: number;
  detalhe: string;
}

export interface PonderacaoMunicipal {
  exercicio: number;
  fonte: string;
  uf: string;
  ente: string;
  /** Matrículas contadas pelo FNDE após a filtragem — não é o Censo bruto. */
  matriculas: number;
  ponderadaVaaf: number;
  ponderadaVaat: number;
  /**
   * Ponderada ÷ bruta. Acima de 1 a rede tem composição mais valiosa que a
   * referência; abaixo, menos. É o número que explica por que duas redes do
   * mesmo tamanho recebem valores diferentes.
   */
  fatorMedio: number | null;
  /** Segmentos com matrícula, do mais para o menos relevante em equivalentes. */
  segmentos: SegmentoPonderado[];
  oportunidades: OportunidadePonderacao[];
}

interface ArquivoPonderacao {
  exercicio?: number;
  fonte?: string;
  segmentos?: string[];
  fatores?: { vaaf?: (number | null)[]; vaat?: (number | null)[] };
  municipios?: Record<
    string,
    { uf?: string; ente?: string; total?: number; vaaf?: number; vaat?: number; seg?: [number, number][] }
  >;
}

let cache: ArquivoPonderacao | null | undefined;

function carregar(): ArquivoPonderacao | null {
  if (cache !== undefined) return cache;
  try {
    cache = JSON.parse(readFileSync(join(process.cwd(), ARQUIVO), "utf8")) as ArquivoPonderacao;
  } catch {
    // Dataset ausente (clone sem `npm run dados:ponderadas`): o bloco some do
    // relatório em vez de derrubar a geração inteira.
    cache = null;
  }
  return cache;
}

/** Soma as matrículas dos segmentos cujo nome casa com o padrão. */
function somar(segmentos: SegmentoPonderado[], padrao: RegExp): number {
  return segmentos.reduce((total, s) => (padrao.test(s.nome) ? total + s.matriculas : total), 0);
}

/**
 * As duas perdas de ponderação que se lê direto da planilha, sem inferir nada
 * sobre a realidade da rede.
 *
 * Ambas são *conferências*, não acusações: a creche pode ser legitimamente
 * parcial, e o AEE pode não ser devido. O relatório apresenta o valor em jogo
 * e manda conferir — é diferente de afirmar que há erro.
 */
function derivarOportunidades(
  segmentos: SegmentoPonderado[],
  fatorPorNome: Map<string, number | null>,
): OportunidadePonderacao[] {
  const oportunidades: OportunidadePonderacao[] = [];

  // Creche parcial → integral. O salto de 1,25 para 1,55 na rede pública urbana
  // é o maior ganho por matrícula disponível sem mudar o público atendido.
  const crecheParcial = somar(segmentos, /^Creche Parcial Pública/);
  if (crecheParcial > 0) {
    const parcial = fatorPorNome.get("Creche Parcial Pública Urbano") ?? 1.25;
    const integral = fatorPorNome.get("Creche Integral Pública Urbano") ?? 1.55;
    const delta = integral - parcial;
    oportunidades.push({
      chave: "creche-integral",
      titulo: "Creche em jornada parcial",
      matriculas: crecheParcial,
      ganhoEquivalentes: crecheParcial * delta,
      detalhe:
        `A creche pública parcial pondera ${parcial.toLocaleString("pt-BR")} e a integral ` +
        `${integral.toLocaleString("pt-BR")}. Tempo integral exige 35h semanais ou média de 7h diárias ` +
        `(Decreto 10.656/2021, art. 11) e a apuração soma os tempos diários informados por turma — ` +
        `escola que declara turno fixo subdeclara a jornada que já pratica.`,
    });
  }

  // AEE é ponderador **adicional** (+1,40 sobre o fator da etapa), condicionado
  // a registro como turma específica no Censo. Educação especial declarada sem
  // AEE correspondente é o sinal de que o adicional pode estar sendo perdido.
  const especial = somar(segmentos, /^Educação Especial/);
  const aee = somar(segmentos, /^Atendimento Educacional Especializado/);
  if (especial > 0 && aee < especial) {
    const fatorAee = fatorPorNome.get("Atendimento Educacional Especializado") ?? 1.4;
    const lacuna = especial - aee;
    oportunidades.push({
      chave: "aee",
      titulo: "Educação especial sem AEE correspondente",
      matriculas: lacuna,
      ganhoEquivalentes: lacuna * fatorAee,
      detalhe:
        `A rede declara ${especial.toLocaleString("pt-BR")} matrículas de educação especial e ` +
        `${aee.toLocaleString("pt-BR")} de atendimento educacional especializado. O AEE gera dupla ` +
        `matrícula (art. 8º, §3º, I da Lei 14.113/2020) e soma ${fatorAee.toLocaleString("pt-BR")} ao fator ` +
        `da etapa, mas só quando registrado como turma específica — inclusive no mesmo turno da ` +
        `escolarização. Conferir quantos desses alunos têm AEE devido e não registrado.`,
    });
  }

  return oportunidades;
}

export function getPonderacaoMunicipal(codigoIBGE: string): PonderacaoMunicipal | null {
  const arquivo = carregar();
  const digits = codigoIBGE.replace(/\D/g, "");
  const registro = arquivo?.municipios?.[digits];
  if (!arquivo || !registro) return null;

  const nomes = arquivo.segmentos ?? [];
  const fatoresVaaf = arquivo.fatores?.vaaf ?? [];
  const ponderadaVaaf = registro.vaaf ?? 0;

  const segmentos: SegmentoPonderado[] = (registro.seg ?? [])
    .map(([indice, matriculas]) => {
      const fator = fatoresVaaf[indice] ?? null;
      const equivalentes = matriculas * (fator ?? 1);
      return {
        nome: nomes[indice] ?? `Segmento ${indice}`,
        matriculas,
        fatorVaaf: fator,
        equivalentes,
        participacao: ponderadaVaaf > 0 ? (equivalentes / ponderadaVaaf) * 100 : 0,
      };
    })
    .sort((a, b) => b.equivalentes - a.equivalentes);

  const fatorPorNome = new Map<string, number | null>(
    nomes.map((nome, indice) => [nome, fatoresVaaf[indice] ?? null]),
  );

  const matriculas = registro.total ?? 0;

  return {
    exercicio: arquivo.exercicio ?? 0,
    fonte: arquivo.fonte ?? "FNDE — matrículas ponderadas do FUNDEB",
    uf: registro.uf ?? "",
    ente: registro.ente ?? "",
    matriculas,
    ponderadaVaaf,
    ponderadaVaat: registro.vaat ?? 0,
    fatorMedio: matriculas > 0 ? ponderadaVaaf / matriculas : null,
    segmentos,
    oportunidades: derivarOportunidades(segmentos, fatorPorNome),
  };
}
