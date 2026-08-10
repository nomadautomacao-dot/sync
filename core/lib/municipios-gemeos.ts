/**
 * Gêmeos estatísticos — onde o município está entre os seus **iguais**.
 *
 * Comparar Serra do Ramalho com a média nacional é comparar com São Paulo.
 * A comparação que convence o gestor é com os municípios de rede do mesmo
 * porte: "entre os 80 municípios do país com rede do seu tamanho, você está
 * no décimo pior em cobertura de AEE" não tem contra-argumento de contexto.
 *
 * ## Como a coorte é montada
 *
 * O critério de semelhança é o **porte da rede** (matrículas da filtragem do
 * FNDE) — não população nem PIB, porque tudo o que este módulo compara é
 * produzido pela rede de ensino, e é o tamanho da rede que define o que é
 * operacionalmente comparável. Duas coortes:
 *
 * - `porte`: os N mais próximos em matrículas no país inteiro;
 * - `uf`: os N mais próximos dentro da mesma UF.
 *
 * ## De onde vêm os indicadores
 *
 * Exclusivamente dos datasets locais já versionados (ponderadas, VAAR, SIOPE,
 * remuneração). Nada é buscado na rede: a coorte inteira precisa ter o mesmo
 * dado, na mesma apuração, ou o percentil compara coisas diferentes.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { lerJsonDeDados } from "./dados-arquivo";
import { agruparNiveis } from "./saeb-distribuicao";

const ARQUIVO_PONDERADAS = join("data", "fnde", "matriculas-ponderadas-2026.json");
const ARQUIVO_VAAR = join("data", "fnde", "vaar-2026.json");
const ARQUIVO_SIOPE = join("data", "fnde", "siope-indicadores.json");
const ARQUIVO_REMUNERACAO = join("data", "fnde", "remuneracao-docente.json");
const ARQUIVO_RENDIMENTO = join("data", "inep-rendimento-municipal-2023.json");
const ARQUIVO_SAEB = join("data", "inep", "saeb-distribuicao.json");
const ARQUIVO_ALFABETIZACAO = join("data", "inep", "alfabetizacao-municipios.json");
const ARQUIVO_EQUIDADE = join("data", "inep-equidade-municipal.json");

/** Tamanho-alvo de cada coorte. */
const COORTE_PORTE = 80;
const COORTE_UF = 20;

export type SentidoGemeos = "maior-melhor" | "menor-melhor" | "neutro";

export interface IndicadorGemeos {
  chave: string;
  rotulo: string;
  /** `indice` é escala de uma casa decimal, como o IDEB — `fator` é a ponderação do FUNDEB, que precisa de três. */
  unidade: "percentual" | "reais" | "fator" | "indice";
  valor: number;
  medianaPorte: number;
  medianaUf: number | null;
  /**
   * Posição do município na coorte de porte, 0–100: percentil 80 significa
   * valor maior ou igual ao de 80% dos semelhantes. A leitura boa/ruim
   * depende do `sentido`.
   */
  percentil: number;
  sentido: SentidoGemeos;
  /** Quantos semelhantes têm o dado — percentil sobre coorte rala não vale. */
  comparaveis: number;
  grupo: GrupoIndicador;
}

export interface MunicipiosGemeos {
  matriculas: number;
  uf: string;
  /** Faixa de matrículas da coorte nacional de porte, para o leitor calibrar. */
  faixaPorte: { minimo: number; maximo: number; tamanho: number };
  coorteUf: number;
  /** % da coorte de porte habilitada ao VAAR — e o município capta ou não. */
  vaar: { habilitadoCoortePct: number; municipioHabilitado: boolean | null } | null;
  indicadores: IndicadorGemeos[];
}

interface MetricasMunicipio {
  codigo: string;
  uf: string;
  matriculas: number;
  valores: Map<string, number>;
  vaarHabilitado: boolean | null;
}

/**
 * Grupo temático do indicador — organiza o painel e nada mais.
 *
 * Existe porque quinze réguas numa folha só viram parede: o gestor lê "onde eu
 * estou pior" por assunto, não por ordem de dataset.
 */
export type GrupoIndicador = "fundo" | "resultado" | "financiamento" | "cadastro";

interface DefinicaoIndicador {
  chave: string;
  rotulo: string;
  /** `indice` é escala de uma casa decimal, como o IDEB — `fator` é a ponderação do FUNDEB, que precisa de três. */
  unidade: "percentual" | "reais" | "fator" | "indice";
  sentido: SentidoGemeos;
  grupo: GrupoIndicador;
}

export const ROTULO_GRUPO_INDICADOR: Record<GrupoIndicador, string> = {
  fundo: "Composição do fundo",
  resultado: "Resultado e fluxo",
  financiamento: "Financiamento e pessoal",
  cadastro: "Qualidade do cadastro",
};

const INDICADORES: DefinicaoIndicador[] = [
  { chave: "fatorMedio", rotulo: "Fator médio de ponderação da rede", unidade: "fator", sentido: "maior-melhor", grupo: "fundo" },
  { chave: "crecheIntegral", rotulo: "Creche pública em tempo integral", unidade: "percentual", sentido: "maior-melhor", grupo: "fundo" },
  { chave: "coberturaAee", rotulo: "Cobertura de AEE na educação especial", unidade: "percentual", sentido: "maior-melhor", grupo: "fundo" },
  { chave: "idebAnosIniciais", rotulo: "IDEB dos anos iniciais", unidade: "indice", sentido: "maior-melhor", grupo: "resultado" },
  { chave: "idebAnosFinais", rotulo: "IDEB dos anos finais", unidade: "indice", sentido: "maior-melhor", grupo: "resultado" },
  { chave: "distorcaoFundamental", rotulo: "Distorção idade-série no fundamental", unidade: "percentual", sentido: "menor-melhor", grupo: "resultado" },
  { chave: "abandonoFundamental", rotulo: "Abandono no fundamental", unidade: "percentual", sentido: "menor-melhor", grupo: "resultado" },
  { chave: "insuficienteLp5", rotulo: "Nível insuficiente em Português do 5º ano", unidade: "percentual", sentido: "menor-melhor", grupo: "resultado" },
  { chave: "insuficienteMt5", rotulo: "Nível insuficiente em Matemática do 5º ano", unidade: "percentual", sentido: "menor-melhor", grupo: "resultado" },
  { chave: "alfabetizacao", rotulo: "Alfabetizados ao fim do 2º ano", unidade: "percentual", sentido: "maior-melhor", grupo: "resultado" },
  { chave: "mde", rotulo: "Aplicação em MDE", unidade: "percentual", sentido: "maior-melhor", grupo: "financiamento" },
  { chave: "remuneracao70", rotulo: "FUNDEB em remuneração dos profissionais", unidade: "percentual", sentido: "maior-melhor", grupo: "financiamento" },
  { chave: "naoAplicado", rotulo: "FUNDEB não aplicado no exercício", unidade: "percentual", sentido: "menor-melhor", grupo: "financiamento" },
  { chave: "investimentoPorAluno", rotulo: "Investimento por aluno", unidade: "reais", sentido: "neutro", grupo: "financiamento" },
  { chave: "medianaMagisterio", rotulo: "Mediana salarial do magistério (40h)", unidade: "reais", sentido: "neutro", grupo: "financiamento" },
  { chave: "naoDeclarada", rotulo: "Cor/raça não declarada na matrícula", unidade: "percentual", sentido: "menor-melhor", grupo: "cadastro" },
];

let tabela: MetricasMunicipio[] | null | undefined;
let porCodigo: Map<string, MetricasMunicipio> | undefined;

function lerJson(caminho: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), caminho), "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Constrói a tabela nacional uma única vez. ~5,5 mil municípios × 8 métricas
 * cabem em memória sem esforço; o custo real seria refazer isso a cada
 * consulta de um lote.
 */
function construirTabela(): MetricasMunicipio[] | null {
  const ponderadas = lerJson(ARQUIVO_PONDERADAS) as {
    segmentos?: string[];
    fatores?: { vaaf?: (number | null)[] };
    municipios?: Record<string, { uf?: string; total?: number; seg?: [number, number][] }>;
  } | null;
  if (!ponderadas?.municipios) return null;

  const vaar = lerJson(ARQUIVO_VAAR) as {
    municipios?: Record<string, { habilitado?: boolean }>;
  } | null;

  const siope = lerJson(ARQUIVO_SIOPE) as {
    indicadores?: Array<{ chave?: string }>;
    municipios?: Record<string, { v?: Record<string, number> }>;
  } | null;

  const remuneracao = lerJson(ARQUIVO_REMUNERACAO) as {
    municipios?: Record<string, { confiavel?: boolean; medianaMagisterio?: number | null }>;
  } | null;

  // Os quatro datasets de resultado e cadastro. Todos locais e completos para o
  // país: a coorte inteira precisa da mesma apuração, senão o percentil compara
  // municípios que têm o dado com municípios que não têm.
  const rendimento = lerJson(ARQUIVO_RENDIMENTO) as {
    municipios?: Record<
      string,
      {
        distorcao?: Record<string, { fundamentalTotal?: number }>;
        rendimento?: Record<string, { abandono?: { total?: number } }>;
      }
    >;
  } | null;

  // O IDEB sai da divulgação atual do INEP (o mesmo dataset do resto do app,
  // já cacheado por `lerJsonDeDados`), não do dataset de rendimento de 2023 —
  // a coorte inteira compara a mesma edição.
  const ideb = lerJsonDeDados<
    Record<string, { anosIniciaisPublica?: number | null; anosFinaisPublica?: number | null }>
  >("data/ideb-municipal-2025.json");

  const saeb = lerJson(ARQUIVO_SAEB) as {
    municipios?: Record<string, Record<string, { niveis?: number[] }>>;
  } | null;

  const alfabetizacao = lerJson(ARQUIVO_ALFABETIZACAO) as {
    municipios?: Record<string, { resultados?: Record<string, number> }>;
  } | null;

  const equidade = lerJson(ARQUIVO_EQUIDADE) as {
    municipios?: Record<string, { municipal?: { total?: number; naoDeclarada?: number } }>;
  } | null;

  /** Precedência de rede do dataset de rendimento: municipal > pública > total. */
  const doRecorte = <T,>(bloco: Record<string, T> | undefined): T | undefined =>
    bloco?.municipal ?? bloco?.publica ?? bloco?.total;

  // Índices de segmento por padrão de nome — o mesmo recorte usado em
  // `fundeb-ponderacao.ts`, para que o percentil compare a mesma conta.
  const nomes = ponderadas.segmentos ?? [];
  const fatores = ponderadas.fatores?.vaaf ?? [];
  const crecheParcial = new Set<number>();
  const crecheIntegral = new Set<number>();
  const especial = new Set<number>();
  const aee = new Set<number>();
  nomes.forEach((nome, indice) => {
    if (/^Creche Parcial Pública/.test(nome)) crecheParcial.add(indice);
    else if (/^Creche Integral Pública/.test(nome)) crecheIntegral.add(indice);
    else if (/^Educação Especial/.test(nome)) especial.add(indice);
    else if (/^Atendimento Educacional Especializado/.test(nome)) aee.add(indice);
  });

  // Posição de cada indicador do SIOPE dentro do vetor `v` de cada município.
  const ordemSiope = new Map<string, number>();
  (siope?.indicadores ?? []).forEach((ind, ordem) => {
    if (ind.chave) ordemSiope.set(ind.chave, ordem);
  });
  const doSiope = (codigo7: string, chave: string): number | null => {
    const ordem = ordemSiope.get(chave);
    if (ordem === undefined) return null;
    const valor = siope?.municipios?.[codigo7.slice(0, 6)]?.v?.[ordem];
    return typeof valor === "number" ? valor : null;
  };

  const linhas: MetricasMunicipio[] = [];

  for (const [codigo, registro] of Object.entries(ponderadas.municipios)) {
    const matriculas = registro.total ?? 0;
    if (matriculas <= 0) continue;

    const valores = new Map<string, number>();

    let ponderada = 0;
    let cParcial = 0;
    let cIntegral = 0;
    let esp = 0;
    let comAee = 0;
    for (const [indice, qtd] of registro.seg ?? []) {
      ponderada += qtd * (fatores[indice] ?? 1);
      if (crecheParcial.has(indice)) cParcial += qtd;
      else if (crecheIntegral.has(indice)) cIntegral += qtd;
      else if (especial.has(indice)) esp += qtd;
      else if (aee.has(indice)) comAee += qtd;
    }

    valores.set("fatorMedio", ponderada / matriculas);
    if (cParcial + cIntegral > 0) valores.set("crecheIntegral", (cIntegral / (cParcial + cIntegral)) * 100);
    if (esp > 0) valores.set("coberturaAee", Math.min(100, (comAee / esp) * 100));

    for (const chave of ["mde", "naoAplicado", "investimentoPorAluno"] as const) {
      const valor = doSiope(codigo, chave);
      if (valor !== null) valores.set(chave, valor);
    }
    const rem70 = doSiope(codigo, "remuneracao");
    if (rem70 !== null) valores.set("remuneracao70", rem70);

    // A remuneração vem do SIOPE e herda a chave de 6 dígitos, sem o
    // verificador — o mesmo truncamento de `remuneracao-docente.ts`.
    const salario = remuneracao?.municipios?.[codigo.slice(0, 6)];
    if (salario && salario.confiavel !== false && typeof salario.medianaMagisterio === "number") {
      valores.set("medianaMagisterio", salario.medianaMagisterio);
    }

    const idebLocal = ideb[codigo];
    if (typeof idebLocal?.anosIniciaisPublica === "number") valores.set("idebAnosIniciais", idebLocal.anosIniciaisPublica);
    if (typeof idebLocal?.anosFinaisPublica === "number") valores.set("idebAnosFinais", idebLocal.anosFinaisPublica);

    const rend = rendimento?.municipios?.[codigo];
    if (rend) {
      const tdi = doRecorte(rend.distorcao)?.fundamentalTotal;
      const abandono = doRecorte(rend.rendimento)?.abandono?.total;
      if (typeof tdi === "number") valores.set("distorcaoFundamental", tdi);
      if (typeof abandono === "number") valores.set("abandonoFundamental", abandono);
    }

    const provas = saeb?.municipios?.[codigo];
    for (const [chave, serie] of [
      ["insuficienteLp5", "lp5"],
      ["insuficienteMt5", "mt5"],
    ] as const) {
      const niveis = provas?.[serie]?.niveis;
      if (Array.isArray(niveis)) {
        valores.set(chave, agruparNiveis(serie, niveis).insuficiente);
      }
    }

    // Último ano publicado do Indicador Criança Alfabetizada.
    const resultados = alfabetizacao?.municipios?.[codigo]?.resultados;
    if (resultados) {
      const anos = Object.keys(resultados)
        .map(Number)
        .filter(Number.isFinite)
        .sort((a, b) => b - a);
      const ultimo = anos.length > 0 ? resultados[String(anos[0])] : undefined;
      if (typeof ultimo === "number") valores.set("alfabetizacao", ultimo);
    }

    const cadastro = equidade?.municipios?.[codigo]?.municipal;
    if (cadastro && typeof cadastro.total === "number" && cadastro.total > 0) {
      valores.set("naoDeclarada", ((cadastro.naoDeclarada ?? 0) / cadastro.total) * 100);
    }

    linhas.push({
      codigo,
      uf: registro.uf ?? "",
      matriculas,
      valores,
      vaarHabilitado: typeof vaar?.municipios?.[codigo]?.habilitado === "boolean"
        ? (vaar!.municipios![codigo]!.habilitado as boolean)
        : null,
    });
  }

  // Ordenada por porte: a coorte de cada município é uma janela nesta lista.
  linhas.sort((a, b) => a.matriculas - b.matriculas);
  return linhas;
}

function tabelaNacional(): MetricasMunicipio[] | null {
  if (tabela === undefined) {
    tabela = construirTabela();
    porCodigo = new Map((tabela ?? []).map((linha) => [linha.codigo, linha]));
  }
  return tabela;
}

/** Os `quantidade` vizinhos mais próximos em matrículas dentro de `universo`. */
function vizinhos(
  universo: MetricasMunicipio[],
  alvo: MetricasMunicipio,
  quantidade: number,
): MetricasMunicipio[] {
  return universo
    .filter((linha) => linha.codigo !== alvo.codigo)
    .sort((a, b) => Math.abs(a.matriculas - alvo.matriculas) - Math.abs(b.matriculas - alvo.matriculas))
    .slice(0, quantidade);
}

function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0 ? (ordenados[meio - 1] + ordenados[meio]) / 2 : ordenados[meio];
}

export function getMunicipiosGemeos(codigoIBGE: string): MunicipiosGemeos | null {
  const nacional = tabelaNacional();
  const digits = codigoIBGE.replace(/\D/g, "");
  const alvo = porCodigo?.get(digits);
  if (!nacional || !alvo) return null;

  const coortePorte = vizinhos(nacional, alvo, COORTE_PORTE);
  const coorteUf = vizinhos(nacional.filter((linha) => linha.uf === alvo.uf), alvo, COORTE_UF);

  const indicadores: IndicadorGemeos[] = [];

  for (const definicao of INDICADORES) {
    const valor = alvo.valores.get(definicao.chave);
    if (valor === undefined) continue;

    const daCoorte = coortePorte
      .map((linha) => linha.valores.get(definicao.chave))
      .filter((v): v is number => v !== undefined);
    // Percentil sobre meia dúzia de vizinhos é ruído com cara de estatística.
    if (daCoorte.length < 20) continue;

    const daUf = coorteUf
      .map((linha) => linha.valores.get(definicao.chave))
      .filter((v): v is number => v !== undefined);

    const abaixoOuIgual = daCoorte.filter((v) => v <= valor).length;

    indicadores.push({
      chave: definicao.chave,
      rotulo: definicao.rotulo,
      unidade: definicao.unidade,
      valor,
      medianaPorte: mediana(daCoorte),
      medianaUf: daUf.length >= 8 ? mediana(daUf) : null,
      percentil: Math.round((abaixoOuIgual / daCoorte.length) * 100),
      sentido: definicao.sentido,
      comparaveis: daCoorte.length,
      grupo: definicao.grupo,
    });
  }

  const comVaar = coortePorte.filter((linha) => linha.vaarHabilitado !== null);
  const habilitadas = comVaar.filter((linha) => linha.vaarHabilitado === true).length;

  return {
    matriculas: alvo.matriculas,
    uf: alvo.uf,
    faixaPorte: {
      minimo: Math.min(...coortePorte.map((linha) => linha.matriculas)),
      maximo: Math.max(...coortePorte.map((linha) => linha.matriculas)),
      tamanho: coortePorte.length,
    },
    coorteUf: coorteUf.length,
    vaar: comVaar.length >= 20
      ? {
          habilitadoCoortePct: Math.round((habilitadas / comVaar.length) * 100),
          municipioHabilitado: alvo.vaarHabilitado,
        }
      : null,
    indicadores,
  };
}
