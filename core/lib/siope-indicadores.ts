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
  /**
   * Nem todo indicador do SIOPE é percentual. O 4.8 e o 4.10 são valores por
   * aluno e o 7.3 é saldo — todos em reais. Formatá-los com `%` produzia
   * "investimento por aluno: 13.466,12%" no relatório.
   */
  unidade: "percentual" | "reais";
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
  /**
   * Indicadores do catálogo que este município **não declarou**.
   *
   * Antes eles simplesmente não viravam linha, e a tabela passava a impressão
   * de estar completa. Não está: numa emissão real do Recife, 5 dos 14
   * indicadores faltaram, e o leitor não tinha como saber. Ausência de
   * declaração é achado — o registro é obrigatório (art. 38, §1º).
   */
  naoDeclarados: { cod: string; rotulo: string }[];
}

interface MetaIndicador {
  cod?: string;
  unidade?: "percentual" | "reais";
  chave?: string;
  rotulo?: string;
  limite?: number | null;
  sentido?: "min" | "max" | null;
  base?: string | null;
  /**
   * `"estadual"` marca indicador que **não se aplica a município**.
   *
   * O 1.8 ("Destinação de impostos ao FUNDEB") entrou no catálogo como se
   * fosse vinculação municipal, com mín. 20% e base na CF art. 212-A, II.
   * Consultando a API: ele vem com `TIPO: "Estadual"` e `COD_MUNI: null`, e o
   * próprio nome do FNDE diz "mínimo de 20% **para estados e DF**". Resultado:
   * presente em 0 dos 5.564 municípios — metadado morto carregando um
   * parâmetro legal que ninguém iria cumprir.
   *
   * Marcado em vez de removido porque a posição no array **é** a chave dos
   * valores de cada município; tirar do meio deslocaria todo o resto.
   */
  escopo?: "estadual" | "municipal";
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

  const declarados = new Set<number>();

  for (const [posicao, valor] of Object.entries(registro.v ?? {})) {
    const definicao = meta[Number(posicao)];
    if (!definicao || typeof valor !== "number") continue;
    if (definicao.escopo === "estadual") continue;
    declarados.add(Number(posicao));

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
      unidade: definicao.unidade ?? "percentual",
      limite,
      sentido,
      base: definicao.base ?? null,
      conforme,
      folga: folga === null ? null : Math.round(folga * 100) / 100,
    });
  }

  if (indicadores.length === 0) return null;

  // O art. 28 não impõe um percentual igual para todo município: os 50% são
  // meta agregada nacional, e o mínimo individual é o próprio IEI (art. 16,
  // VII). Sem cruzar os dois, as duas linhas apareciam no relatório como
  // "sem parâmetro" — quando uma é exatamente o parâmetro da outra.
  const iei = indicadores.find((i) => i.chave === "iei");
  const aplicadoInfantil = indicadores.find((i) => i.chave === "infantilVaat");

  if (iei && aplicadoInfantil) {
    aplicadoInfantil.limite = iei.valor;
    aplicadoInfantil.sentido = "min";
    aplicadoInfantil.conforme = aplicadoInfantil.valor >= iei.valor;
    aplicadoInfantil.folga = Math.round((aplicadoInfantil.valor - iei.valor) * 100) / 100;
  }

  // A mesma ideia, na outra ponta: o 1.3 é o **complemento aritmético** do 1.2.
  // O FUNDEB se reparte entre remuneração (1.2), outras despesas de MDE (1.3) e
  // o que sobrou sem aplicar (1.4) — as três somam 100%. Se a lei exige no
  // mínimo 70% em remuneração, o 1.3 tem teto de 30% pelo mesmo artigo.
  //
  // Sem isto ele saía como "sem parâmetro" ao lado de uma linha que traz
  // mín. 70% — duas leituras da mesma regra, uma delas mostrando régua e a
  // outra não. O teto é derivado do piso do 1.2, e não escrito à mão, para que
  // acompanhe a lei se o percentual mudar.
  const remuneracao = indicadores.find((i) => i.chave === "remuneracao");
  const outrasMde = indicadores.find((i) => i.chave === "fundebOutrasMde");

  if (remuneracao?.limite !== null && remuneracao?.limite !== undefined && remuneracao.sentido === "min" && outrasMde && outrasMde.limite === null) {
    const teto = Math.round((100 - remuneracao.limite) * 100) / 100;
    outrasMde.limite = teto;
    outrasMde.sentido = "max";
    outrasMde.conforme = outrasMde.valor <= teto;
    outrasMde.folga = Math.round((teto - outrasMde.valor) * 100) / 100;
  }

  indicadores.sort((a, b) => a.cod.localeCompare(b.cod, undefined, { numeric: true }));

  // O que o catálogo prevê e o município não declarou. Só indicadores
  // municipais entram: cobrar de uma prefeitura um indicador estadual seria
  // inventar achado.
  const naoDeclarados = meta
    .map((definicao, posicao) => ({ definicao, posicao }))
    .filter(({ definicao, posicao }) => definicao && definicao.escopo !== "estadual" && !declarados.has(posicao))
    .map(({ definicao }) => ({ cod: definicao.cod ?? "", rotulo: definicao.rotulo ?? "" }));

  const ano = registro.ano ?? arquivo.anoReferencia ?? 0;

  return {
    fonte: arquivo.fonte ?? "FNDE — SIOPE",
    ano,
    defasado: ano > 0 && arquivo.anoReferencia !== undefined && ano < arquivo.anoReferencia,
    uf: registro.uf ?? "",
    nome: registro.nome ?? "",
    indicadores,
    descumpridas: indicadores.filter((i) => i.conforme === false),
    naoDeclarados,
  };
}
