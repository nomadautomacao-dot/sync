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
  /**
   * O fator do **outro** denominador. A Portaria publica duas tabelas de
   * ponderação: a do VAAF, que rateia o fundo de origem estadual, e a do VAAT,
   * que rateia a complementação da União — e elas não são iguais. Creche
   * integral pública urbana vale 1,55 no VAAF e 1,90 no VAAT; anos iniciais
   * valem 1,00 nos dois. A diferença é deliberada: o VAAT sobrepesa a educação
   * infantil, que é onde a União quis induzir oferta.
   */
  fatorVaat: number | null;
  /** Matrículas × fator: a contribuição do segmento para o total ponderado. */
  equivalentes: number;
  /** Matrículas × `fatorVaat`. */
  equivalentesVaat: number;
  /** Participação do segmento no total ponderado da rede, em %. */
  participacao: number;
  /** Participação no total ponderado do VAAT, em %. */
  participacaoVaat: number;
}

export interface OportunidadePonderacao {
  chave: "creche-integral" | "aee";
  titulo: string;
  /** Matrículas hoje na condição de menor fator. É o **teto** da conferência. */
  matriculas: number;
  /** Ganho em matrículas-equivalentes se a condição fosse a de maior fator. */
  ganhoEquivalentes: number;
  /**
   * Indicador do município (0 a 1): fração da creche já em integral, ou
   * cobertura de AEE sobre a educação especial.
   */
  indicador: number;
  /** Mediana nacional do mesmo indicador, medida sobre as redes municipais. */
  mediana: number;
  /**
   * Matrículas que faltam para o município **alcançar a mediana nacional**.
   * Zero quando já está no nível dela ou acima.
   *
   * É este o número que o relatório monetiza. O teto (`matriculas`) supõe que
   * toda creche parcial vire integral e que todo aluno de educação especial
   * tenha AEE devido — supor isso produz cifras que a base não sustenta: em São
   * Paulo o teto do AEE dava R$ 173,9 milhões.
   */
  matriculasAteMediana: number;
  /** Ganho em equivalentes para fechar a distância até a mediana. */
  ganhoEquivalentesMediana: number;
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

const PADRAO_CRECHE_PARCIAL = /^Creche Parcial Pública/;
const PADRAO_CRECHE_INTEGRAL = /^Creche Integral Pública/;
const PADRAO_ESPECIAL = /^Educação Especial/;
const PADRAO_AEE = /^Atendimento Educacional Especializado/;

/**
 * Mediana nacional dos dois indicadores, medida sobre as próprias redes
 * municipais do dataset.
 *
 * Existe porque o teto não é um alvo honesto. Só 28% das redes declaram toda a
 * creche em integral e só 17% têm AEE igual ou maior que a educação especial —
 * cobrar de um município o teto é cobrar o que quatro em cada cinco não fazem.
 * A mediana é alvo verificável: metade do país já está lá.
 */
interface MedianasNacionais {
  /** Fração da creche pública declarada em tempo integral. */
  creche: number;
  /** Matrículas de AEE por matrícula de educação especial. */
  aee: number;
}

let medianas: MedianasNacionais | undefined;

function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0 ? (ordenados[meio - 1] + ordenados[meio]) / 2 : ordenados[meio];
}

function calcularMedianas(arquivo: ArquivoPonderacao): MedianasNacionais {
  const nomes = arquivo.segmentos ?? [];
  const crecheParcial = new Set<number>();
  const crecheIntegral = new Set<number>();
  const especial = new Set<number>();
  const aee = new Set<number>();

  nomes.forEach((nome, indice) => {
    if (PADRAO_CRECHE_PARCIAL.test(nome)) crecheParcial.add(indice);
    else if (PADRAO_CRECHE_INTEGRAL.test(nome)) crecheIntegral.add(indice);
    else if (PADRAO_ESPECIAL.test(nome)) especial.add(indice);
    else if (PADRAO_AEE.test(nome)) aee.add(indice);
  });

  const sharesCreche: number[] = [];
  const coberturasAee: number[] = [];

  for (const registro of Object.values(arquivo.municipios ?? {})) {
    let parcial = 0;
    let integral = 0;
    let comEspecial = 0;
    let comAee = 0;

    for (const [indice, matriculas] of registro.seg ?? []) {
      if (crecheParcial.has(indice)) parcial += matriculas;
      else if (crecheIntegral.has(indice)) integral += matriculas;
      else if (especial.has(indice)) comEspecial += matriculas;
      else if (aee.has(indice)) comAee += matriculas;
    }

    // Rede sem o denominador não informa nada sobre a distribuição — entrar com
    // zero puxaria a mediana para baixo e inflaria a lacuna de todo mundo.
    if (parcial + integral > 0) sharesCreche.push(integral / (parcial + integral));
    if (comEspecial > 0) coberturasAee.push(comAee / comEspecial);
  }

  return { creche: mediana(sharesCreche), aee: mediana(coberturasAee) };
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
  referencia: MedianasNacionais,
): OportunidadePonderacao[] {
  const oportunidades: OportunidadePonderacao[] = [];
  const pct = (valor: number) => `${(valor * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

  // Creche parcial → integral. O salto de 1,25 para 1,55 na rede pública urbana
  // é o maior ganho por matrícula disponível sem mudar o público atendido.
  const crecheParcial = somar(segmentos, PADRAO_CRECHE_PARCIAL);
  const crecheIntegral = somar(segmentos, PADRAO_CRECHE_INTEGRAL);
  const creche = crecheParcial + crecheIntegral;

  if (crecheParcial > 0 && creche > 0) {
    const parcial = fatorPorNome.get("Creche Parcial Pública Urbano") ?? 1.25;
    const integral = fatorPorNome.get("Creche Integral Pública Urbano") ?? 1.55;
    const delta = integral - parcial;

    const indicador = crecheIntegral / creche;
    // A distância até a mediana nunca pode exceder o que existe em parcial.
    const ateMediana = Math.min(crecheParcial, Math.max(0, referencia.creche * creche - crecheIntegral));

    oportunidades.push({
      chave: "creche-integral",
      titulo: "Creche em jornada parcial",
      matriculas: crecheParcial,
      ganhoEquivalentes: crecheParcial * delta,
      indicador,
      mediana: referencia.creche,
      matriculasAteMediana: ateMediana,
      ganhoEquivalentesMediana: ateMediana * delta,
      detalhe:
        `A creche pública parcial pondera ${parcial.toLocaleString("pt-BR")} e a integral ` +
        `${integral.toLocaleString("pt-BR")}. A rede declara ${pct(indicador)} da creche em tempo integral, ` +
        `contra mediana nacional de ${pct(referencia.creche)}. Tempo integral exige 35h semanais ou média ` +
        `de 7h diárias (Decreto 10.656/2021, art. 11) e a apuração soma os tempos diários informados por ` +
        `turma — escola que declara turno fixo subdeclara a jornada que já pratica.`,
    });
  }

  // AEE é ponderador **adicional** (+1,40 sobre o fator da etapa), condicionado
  // a registro como turma específica no Censo. Educação especial declarada sem
  // AEE correspondente é o sinal de que o adicional pode estar sendo perdido.
  const especial = somar(segmentos, PADRAO_ESPECIAL);
  const aee = somar(segmentos, PADRAO_AEE);

  if (especial > 0 && aee < especial) {
    const fatorAee = fatorPorNome.get("Atendimento Educacional Especializado") ?? 1.4;
    const indicador = aee / especial;
    const ateMediana = Math.max(0, referencia.aee * especial - aee);

    oportunidades.push({
      chave: "aee",
      titulo: "Educação especial sem AEE correspondente",
      matriculas: especial - aee,
      ganhoEquivalentes: (especial - aee) * fatorAee,
      indicador,
      mediana: referencia.aee,
      matriculasAteMediana: ateMediana,
      ganhoEquivalentesMediana: ateMediana * fatorAee,
      detalhe:
        `A rede declara ${especial.toLocaleString("pt-BR")} matrículas de educação especial e ` +
        `${aee.toLocaleString("pt-BR")} de atendimento educacional especializado — cobertura de ` +
        `${pct(indicador)}, contra mediana nacional de ${pct(referencia.aee)}. O AEE gera dupla ` +
        `matrícula (art. 8º, §3º, I da Lei 14.113/2020) e soma ${fatorAee.toLocaleString("pt-BR")} ao fator ` +
        `da etapa, mas só quando registrado como turma específica — inclusive no mesmo turno da ` +
        `escolarização. Conferir quantos desses alunos têm AEE devido e não registrado.`,
    });
  }

  return oportunidades;
}

export interface SegmentoCatalogo {
  nome: string;
  fatorVaaf: number | null;
  fatorVaat: number | null;
}

/**
 * Os 82 segmentos da Portaria, com ou sem matrícula em qualquer município.
 *
 * Serve para o inverso da leitura usual: em vez de listar o que a rede declara,
 * mostrar o que ela **não** declara. Segmento vazio quase sempre é oferta que
 * não existe — mas nem sempre, e a diferença vale dinheiro.
 */
export function getCatalogoSegmentos(): SegmentoCatalogo[] {
  const arquivo = carregar();
  if (!arquivo) return [];
  const vaaf = arquivo.fatores?.vaaf ?? [];
  const vaat = arquivo.fatores?.vaat ?? [];
  return (arquivo.segmentos ?? []).map((nome, i) => ({
    nome,
    fatorVaaf: vaaf[i] ?? null,
    fatorVaat: vaat[i] ?? null,
  }));
}

export function getPonderacaoMunicipal(codigoIBGE: string): PonderacaoMunicipal | null {
  const arquivo = carregar();
  const digits = codigoIBGE.replace(/\D/g, "");
  const registro = arquivo?.municipios?.[digits];
  if (!arquivo || !registro) return null;

  const nomes = arquivo.segmentos ?? [];
  const fatoresVaaf = arquivo.fatores?.vaaf ?? [];
  const fatoresVaat = arquivo.fatores?.vaat ?? [];
  const ponderadaVaaf = registro.vaaf ?? 0;
  const ponderadaVaat = registro.vaat ?? 0;

  const segmentos: SegmentoPonderado[] = (registro.seg ?? [])
    .map(([indice, matriculas]) => {
      const fator = fatoresVaaf[indice] ?? null;
      const fatorVaat = fatoresVaat[indice] ?? null;
      const equivalentes = matriculas * (fator ?? 1);
      const equivalentesVaat = matriculas * (fatorVaat ?? fator ?? 1);
      return {
        nome: nomes[indice] ?? `Segmento ${indice}`,
        matriculas,
        fatorVaaf: fator,
        fatorVaat,
        equivalentes,
        equivalentesVaat,
        participacao: ponderadaVaaf > 0 ? (equivalentes / ponderadaVaaf) * 100 : 0,
        participacaoVaat: ponderadaVaat > 0 ? (equivalentesVaat / ponderadaVaat) * 100 : 0,
      };
    })
    .sort((a, b) => b.equivalentes - a.equivalentes);

  const fatorPorNome = new Map<string, number | null>(
    nomes.map((nome, indice) => [nome, fatoresVaaf[indice] ?? null]),
  );

  const matriculas = registro.total ?? 0;

  // As medianas são as mesmas para todos os municípios: percorrer 5.569
  // registros a cada consulta de um lote seria desperdício puro.
  if (medianas === undefined) medianas = calcularMedianas(arquivo);

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
    oportunidades: derivarOportunidades(segmentos, fatorPorNome, medianas),
  };
}
