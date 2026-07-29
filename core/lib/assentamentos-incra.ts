/**
 * Assentamentos da reforma agrária por município (INCRA, acervo fundiário).
 *
 * Dataset local gerado por `scripts/dados/gerar-assentamentos-incra.mjs` a
 * partir da tabela de atributos do shapefile nacional do INCRA.
 *
 * ## Por que entra num relatório de FUNDEB
 *
 * Escola que atende assentamento é educação do **campo** (fator +15% sobre a
 * etapa), e aluno residente em assentamento conta para a regra da escola
 * urbana com metade dos alunos de residência rural — a captura pouco usada
 * que a planilha do FNDE prevê. Famílias assentadas às centenas com zero
 * escolas declaradas em assentamento é a conferência clássica: a condição
 * pode estar por declarar na coleta do Censo.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ARQUIVO = join("data", "incra", "assentamentos.json");

export interface AssentamentosMunicipio {
  fonte: string;
  qtd: number;
  familias: number;
  capacidade: number;
  areaHa: number;
}

interface ArquivoIncra {
  fonte?: string;
  municipios?: Record<string, { qtd?: number; familias?: number; capacidade?: number; areaHa?: number }>;
}

let cache: ArquivoIncra | null | undefined;

function carregar(): ArquivoIncra | null {
  if (cache !== undefined) return cache;
  try {
    cache = JSON.parse(readFileSync(join(process.cwd(), ARQUIVO), "utf8")) as ArquivoIncra;
  } catch {
    // Dataset ausente (clone sem `npm run dados:assentamentos`): o bloco some
    // do relatório em vez de derrubar a geração.
    cache = null;
  }
  return cache;
}

export function getAssentamentos(codigoIBGE: string): AssentamentosMunicipio | null {
  const arquivo = carregar();
  const registro = arquivo?.municipios?.[codigoIBGE.replace(/\D/g, "")];
  if (!arquivo || !registro) return null;

  return {
    fonte: arquivo.fonte ?? "INCRA — acervo fundiário",
    qtd: registro.qtd ?? 0,
    familias: registro.familias ?? 0,
    capacidade: registro.capacidade ?? 0,
    areaHa: registro.areaHa ?? 0,
  };
}
