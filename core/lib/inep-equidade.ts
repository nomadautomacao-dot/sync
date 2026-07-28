/**
 * Recorte de equidade da rede: matrícula por **cor/raça** e escolas em
 * **localização diferenciada** (terra indígena, remanescente de quilombo,
 * assentamento) e no **campo**.
 *
 * Os dados vêm de `data/inep-equidade-municipal.json`, gerado offline por
 * `scripts/dados/gerar-equidade-censo-municipal.mjs` a partir dos microdados
 * do Censo Escolar. O recorte não existe em nenhuma API do INEP por município:
 * cor/raça está na tabela de matrícula, que não tem município, e o município
 * está na tabela de escolas, que não tem cor/raça — só a junção produz isto.
 *
 * ## Por que entra num relatório de FUNDEB
 *
 * A ponderação do fundo distingue educação escolar indígena e quilombola e a
 * matrícula do campo. Rede que não declara essas condições no Censo recebe
 * menos do que teria direito, e o erro só aparece no ano seguinte, quando a
 * portaria já saiu. O percentual de **cor/raça não declarada** é o termômetro
 * dessa qualidade cadastral — e é alto o suficiente, em muitos municípios,
 * para invalidar qualquer leitura de equidade feita sobre a base.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ARQUIVO = join("data", "inep-equidade-municipal.json");

export interface MatriculaPorCorRaca {
  total: number;
  branca: number;
  preta: number;
  parda: number;
  amarela: number;
  indigena: number;
  naoDeclarada: number;
}

export interface EscolasPorCondicao {
  municipaisTotal: number;
  municipaisRurais: number;
  municipaisTerraIndigena: number;
  municipaisQuilombolas: number;
  municipaisAssentamento: number;
  municipaisEducacaoIndigena: number;
}

export interface EquidadeMunicipal {
  anoCenso: number;
  fonte: string;
  municipal: MatriculaPorCorRaca;
  publica: MatriculaPorCorRaca;
  escolas: EscolasPorCondicao | null;
  /** Soma de preta e parda, como o IBGE e o IPEA classificam população negra. */
  negraMunicipal: number;
  /** Participação de cor/raça não declarada na rede municipal, em %. */
  naoDeclaradaPct: number | null;
  /**
   * `true` quando a não declaração passa de um terço da rede — acima disso, a
   * distribuição por cor/raça descreve mais o preenchimento do Censo do que a
   * composição real dos alunos, e o relatório precisa dizer isso.
   */
  cadastroFragil: boolean;
}

interface ArquivoEquidade {
  anoCenso?: number;
  fonte?: string;
  municipios?: Record<
    string,
    {
      municipal?: Partial<MatriculaPorCorRaca>;
      publica?: Partial<MatriculaPorCorRaca>;
      escolas?: EscolasPorCondicao | null;
    }
  >;
}

/** Acima disto, a distribuição por cor/raça deixa de ser informativa. */
const LIMIAR_CADASTRO_FRAGIL = 33;

let cache: ArquivoEquidade | null | undefined;

function carregar(): ArquivoEquidade | null {
  if (cache !== undefined) return cache;
  try {
    cache = JSON.parse(readFileSync(join(process.cwd(), ARQUIVO), "utf8")) as ArquivoEquidade;
  } catch {
    // Dataset ausente (clone sem `npm run dados:equidade`): o bloco simplesmente
    // não aparece no relatório, em vez de derrubar a geração inteira.
    cache = null;
  }
  return cache;
}

function normalizar(bruto: Partial<MatriculaPorCorRaca> | undefined): MatriculaPorCorRaca {
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    total: n(bruto?.total),
    branca: n(bruto?.branca),
    preta: n(bruto?.preta),
    parda: n(bruto?.parda),
    amarela: n(bruto?.amarela),
    indigena: n(bruto?.indigena),
    naoDeclarada: n(bruto?.naoDeclarada),
  };
}

export function getEquidadeMunicipal(codigoIBGE: string): EquidadeMunicipal | null {
  const arquivo = carregar();
  const digits = codigoIBGE.replace(/\D/g, "");
  const registro = arquivo?.municipios?.[digits];
  if (!registro) return null;

  const municipal = normalizar(registro.municipal);
  const publica = normalizar(registro.publica);
  if (municipal.total === 0 && publica.total === 0) return null;

  const naoDeclaradaPct =
    municipal.total > 0 ? (municipal.naoDeclarada / municipal.total) * 100 : null;

  return {
    anoCenso: arquivo?.anoCenso ?? 0,
    fonte: arquivo?.fonte ?? "INEP — Microdados do Censo Escolar",
    municipal,
    publica,
    escolas: registro.escolas ?? null,
    negraMunicipal: municipal.preta + municipal.parda,
    naoDeclaradaPct,
    cadastroFragil: naoDeclaradaPct !== null && naoDeclaradaPct > LIMIAR_CADASTRO_FRAGIL,
  };
}
