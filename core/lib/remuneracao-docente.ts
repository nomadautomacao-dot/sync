/**
 * Remuneração do magistério e adimplência ao **piso nacional**, por município.
 *
 * Os dados vêm de `data/fnde/remuneracao-docente.json`, gerado offline por
 * `scripts/dados/gerar-remuneracao-docente.mjs` a partir da API OData do
 * SIOPE. O gerador agrega no momento da coleta: a fonte publica registros
 * individuais com nome e escola, e nada disso é persistido aqui.
 *
 * ## Por que entra num relatório de FUNDEB
 *
 * O piso é o principal vetor de pressão sobre os 70% do fundo, e a Lei nº
 * 15.437/2026 mudou o jogo em dois pontos que quase ninguém absorveu:
 *
 * 1. A fórmula deixou de ser vinculada à variação do VAA/VAAF e passou a ser
 *    INPC do ano anterior mais metade da média quinquenal da variação da
 *    receita do fundo.
 * 2. O art. 4º da Lei nº 11.738/2008 — que previa **complementação da União**
 *    ao ente sem disponibilidade orçamentária — foi **revogado**. Esse direito
 *    deixou de existir, e o custo do piso passou a ser integralmente do
 *    município.
 *
 * Um levantamento que projeta receita sem medir a folha do magistério ignora
 * a despesa que mais cresce e que menos admite recuo.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ARQUIVO = join("data", "fnde", "remuneracao-docente.json");

/**
 * Teto de plausibilidade para a **mediana municipal** do magistério.
 *
 * O gerador já descarta registro a registro fora de faixa, mas isso não pega
 * o ente que declara um valor fixo e errado para a folha inteira: sobram
 * registros "válidos" e a mediana inteira sai deslocada. Taquaral de Goiás é
 * o caso — mediana cravada no teto do filtro sobre 14 registros.
 *
 * A distribuição nacional resolve: a mediana das medianas é ~R$ 5,3 mil e o
 * p90 é ~R$ 8,2 mil. Uma mediana municipal acima de R$ 25 mil, cerca de cinco
 * vezes o piso, não descreve nenhuma rede real do país — descreve um erro de
 * declaração. Marcar como não confiável é mais honesto que exibir.
 */
const MEDIANA_MAXIMA_PLAUSIVEL = 25_000;

export interface RemuneracaoMunicipal {
  fonte: string;
  ano: number;
  /** Piso vigente no exercício de referência, para jornada de 40h. */
  piso: number;
  jornadaReferencia: number;
  uf: string;
  nome: string;
  /** Profissionais do magistério declarados pelo ente, antes dos filtros. */
  magisterioDeclarado: number;
  /**
   * Subconjunto com jornada e salário em faixa inequívoca — a base da
   * mediana. Vários entes declaram a carga em unidade que não é a hora
   * semanal, e proporcionalizar esses registros produz cifras absurdas.
   */
  magisterio: number;
  /** Participação do subconjunto sobre o declarado, em %. */
  cobertura: number;
  /**
   * `false` quando a cobertura é baixa demais para a mediana descrever a
   * rede. O relatório deve omitir a cifra nesse caso, não exibi-la com
   * ressalva — número errado com asterisco continua sendo lido como número.
   */
  confiavel: boolean;
  /** Subconjunto em regência de classe. */
  docentes: number;
  efetivos: number;
  temporarios: number;
  /** Demais profissionais da educação — não alcançados pelo piso. */
  outros: number;
  /** Mediana proporcionalizada a 40h. */
  medianaMagisterio: number | null;
  medianaDocentes: number | null;
  abaixoDoPiso: number;
  abaixoDoPisoPct: number;
  /** Mediana sobre o piso: acima de 1 a rede paga além do mínimo legal. */
  razaoMedianaPiso: number | null;
  /** Participação de vínculos temporários no magistério, em %. */
  temporariosPct: number | null;
}

interface ArquivoRemuneracao {
  fonte?: string;
  anoReferencia?: number;
  pisoNacional?: number;
  jornadaReferencia?: number;
  municipios?: Record<
    string,
    {
      uf?: string;
      nome?: string;
      magisterioDeclarado?: number;
      magisterio?: number;
      cobertura?: number;
      confiavel?: boolean;
      docentes?: number;
      efetivos?: number;
      temporarios?: number;
      outros?: number;
      medianaMagisterio?: number | null;
      medianaDocentes?: number | null;
      abaixoDoPiso?: number;
      abaixoDoPisoPct?: number;
    }
  >;
}

let cache: ArquivoRemuneracao | null | undefined;

function carregar(): ArquivoRemuneracao | null {
  if (cache !== undefined) return cache;
  try {
    cache = JSON.parse(readFileSync(join(process.cwd(), ARQUIVO), "utf8")) as ArquivoRemuneracao;
  } catch {
    // Dataset ausente (clone sem `npm run dados:remuneracao`): o bloco some do
    // relatório em vez de derrubar a geração inteira.
    cache = null;
  }
  return cache;
}

export function getRemuneracaoMunicipal(codigoIBGE: string): RemuneracaoMunicipal | null {
  const arquivo = carregar();
  const digits = codigoIBGE.replace(/\D/g, "");
  if (!arquivo || digits.length < 6) return null;

  // O SIOPE indexa por código IBGE de 6 dígitos, sem o verificador.
  const registro = arquivo.municipios?.[digits.slice(0, 6)];
  if (!registro || !registro.magisterio) return null;

  const piso = arquivo.pisoNacional ?? 0;
  const mediana = registro.medianaMagisterio ?? null;

  return {
    fonte: arquivo.fonte ?? "FNDE — SIOPE",
    ano: arquivo.anoReferencia ?? 0,
    piso,
    jornadaReferencia: arquivo.jornadaReferencia ?? 40,
    uf: registro.uf ?? "",
    nome: registro.nome ?? "",
    magisterioDeclarado: registro.magisterioDeclarado ?? registro.magisterio,
    magisterio: registro.magisterio,
    cobertura: registro.cobertura ?? 100,
    confiavel:
      registro.confiavel !== false && mediana !== null && mediana <= MEDIANA_MAXIMA_PLAUSIVEL,
    docentes: registro.docentes ?? 0,
    efetivos: registro.efetivos ?? 0,
    temporarios: registro.temporarios ?? 0,
    outros: registro.outros ?? 0,
    medianaMagisterio: mediana,
    medianaDocentes: registro.medianaDocentes ?? null,
    abaixoDoPiso: registro.abaixoDoPiso ?? 0,
    abaixoDoPisoPct: registro.abaixoDoPisoPct ?? 0,
    razaoMedianaPiso: mediana !== null && piso > 0 ? Math.round((mediana / piso) * 1000) / 1000 : null,
    temporariosPct:
      registro.magisterio > 0
        ? Math.round(((registro.temporarios ?? 0) / registro.magisterio) * 10000) / 100
        : null,
  };
}
