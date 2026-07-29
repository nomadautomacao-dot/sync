/**
 * Vinculações constitucionais e legais da educação, por município, como o
 * SIOPE as apura.
 *
 * Os dados vêm de `data/fnde/siope-indicadores.json`, gerado offline por
 * `scripts/dados/gerar-siope-indicadores.mjs` a partir da API OData de dados
 * abertos do FNDE.
 *
 * ## Por que entra num relatório de FUNDEB
 *
 * Receber o recurso e poder usá-lo são coisas diferentes. O repasse do FUNDEB
 * é automático e nenhuma pendência administrativa o suspende (art. 21), mas as
 * seis vinculações abaixo entram no extrato do CAUC desde 2025 (IN STN/MF nº
 * 8/2025, art. 12, XIX a XXII) e viciam a prestação de contas no tribunal:
 *
 * - 25% de impostos em MDE (CF art. 212)
 * - 70% do fundo em remuneração dos profissionais (art. 26) — profissionais da
 *   educação básica, não apenas magistério: inclui apoio e administrativo
 * - 15% da complementação VAAT em despesas de capital (art. 27)
 * - o percentual da educação infantil, individualizado pelo IEI (art. 28)
 * - teto de 10% de recursos não aplicados no exercício (art. 25, §3º)
 * - 20% de destinação de impostos ao fundo (CF art. 212-A, II)
 *
 * Um relatório que projeta receita sem verificar essas travas descreve dinheiro
 * que o município pode não conseguir executar nem aprovar.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ARQUIVO = join("data", "fnde", "siope-indicadores.json");

export interface IndicadorSiope {
  cod: string;
  chave: string;
  rotulo: string;
  valor: number;
  /** Parâmetro legal, quando existe. */
  limite: number | null;
  sentido: "min" | "max" | null;
  base: string | null;
  /** `true` cumpre, `false` descumpre, `null` quando não há parâmetro fixo. */
  conforme: boolean | null;
  /**
   * Distância até o parâmetro, com sinal. Positivo é folga, negativo é a
   * lacuna a cobrir. `null` quando não há parâmetro.
   */
  folga: number | null;
}

export interface ConformidadeSiope {
  fonte: string;
  /** Exercício da declaração deste município — pode ser anterior ao geral. */
  ano: number;
  /** `true` quando o município não declarou o exercício de referência. */
  defasado: boolean;
  uf: string;
  nome: string;
  indicadores: IndicadorSiope[];
  /** Só as vinculações com parâmetro legal descumprido. */
  descumpridas: IndicadorSiope[];
}

interface MetaIndicador {
  cod?: string;
  chave?: string;
  rotulo?: string;
  limite?: number | null;
  sentido?: "min" | "max" | null;
  base?: string | null;
}

interface ArquivoSiope {
  fonte?: string;
  anoReferencia?: number;
  indicadores?: MetaIndicador[];
  municipios?: Record<string, { uf?: string; nome?: string; ano?: number; v?: Record<string, number> }>;
}

let cache: ArquivoSiope | null | undefined;

function carregar(): ArquivoSiope | null {
  if (cache !== undefined) return cache;
  try {
    cache = JSON.parse(readFileSync(join(process.cwd(), ARQUIVO), "utf8")) as ArquivoSiope;
  } catch {
    // Dataset ausente (clone sem `npm run dados:siope`): o bloco some do
    // relatório em vez de derrubar a geração inteira.
    cache = null;
  }
  return cache;
}

export function getConformidadeSiope(codigoIBGE: string): ConformidadeSiope | null {
  const arquivo = carregar();
  const digits = codigoIBGE.replace(/\D/g, "");
  if (!arquivo || digits.length < 6) return null;

  // O SIOPE indexa por código IBGE de 6 dígitos, sem o verificador. O resto do
  // projeto usa 7 — truncar aqui mantém o dataset fiel à fonte.
  const registro = arquivo.municipios?.[digits.slice(0, 6)];
  if (!registro) return null;

  const meta = arquivo.indicadores ?? [];
  const indicadores: IndicadorSiope[] = [];

  for (const [posicao, valor] of Object.entries(registro.v ?? {})) {
    const definicao = meta[Number(posicao)];
    if (!definicao || typeof valor !== "number") continue;

    const limite = definicao.limite ?? null;
    const sentido = definicao.sentido ?? null;

    // Sem parâmetro fixo não há conformidade a declarar. O IEI, por exemplo, é
    // individualizado por município: o mínimo é o próprio indicador 1.7, não
    // um número igual para todos.
    const conforme = limite === null || sentido === null ? null : sentido === "min" ? valor >= limite : valor <= limite;
    const folga = limite === null || sentido === null ? null : sentido === "min" ? valor - limite : limite - valor;

    indicadores.push({
      cod: definicao.cod ?? "",
      chave: definicao.chave ?? "",
      rotulo: definicao.rotulo ?? "",
      valor,
      limite,
      sentido,
      base: definicao.base ?? null,
      conforme,
      folga: folga === null ? null : Math.round(folga * 100) / 100,
    });
  }

  if (indicadores.length === 0) return null;

  indicadores.sort((a, b) => a.cod.localeCompare(b.cod, undefined, { numeric: true }));

  const ano = registro.ano ?? arquivo.anoReferencia ?? 0;

  return {
    fonte: arquivo.fonte ?? "FNDE — SIOPE",
    ano,
    defasado: ano > 0 && arquivo.anoReferencia !== undefined && ano < arquivo.anoReferencia,
    uf: registro.uf ?? "",
    nome: registro.nome ?? "",
    indicadores,
    descumpridas: indicadores.filter((i) => i.conforme === false),
  };
}
