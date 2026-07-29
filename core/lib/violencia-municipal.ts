/**
 * Violência letal no território — o contexto que as bases educacionais
 * mostram sem explicar.
 *
 * Os dados vêm de `data/ipea/violencia-municipios.json`, gerado offline por
 * `scripts/dados/gerar-violencia-municipios.mjs` a partir do Atlas da
 * Violência (IPEA/FBSP, base SIM/DataSUS) via IPEADATA.
 *
 * ## Por que entra num relatório de FUNDEB
 *
 * Território conflagrado explica sinais que já estão nas outras páginas:
 * escola com participação retida no Saeb (Cond. II do VAAR), abandono
 * concentrado nos anos finais, evasão masculina no 9º ano. Os jovens de 15 a
 * 29 anos são exatamente a faixa do EJA e do ensino médio.
 *
 * Regra de projeto (roadmap): indicador sensível entra como **contexto
 * explicativo, nunca como rótulo do município** — a análise vira pergunta de
 * campo, não manchete.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ARQUIVO = join("data", "ipea", "violencia-municipios.json");

export interface PontoViolencia {
  ano: number;
  total: number | null;
  jovens: number | null;
  taxa: number | null;
}

export interface ViolenciaMunicipal {
  fonte: string;
  /** Taxa nacional do mesmo ano do último dado municipal. */
  brasil: { ano: number; taxa: number } | null;
  /** Janela disponível, do mais antigo para o mais recente. */
  serie: PontoViolencia[];
  ultimo: PontoViolencia;
  /** % dos homicídios do último ano que são de jovens de 15 a 29 anos. */
  participacaoJovensPct: number | null;
  /** Variação da taxa entre a primeira e a última observação da janela. */
  tendenciaTaxaPct: number | null;
  /** true = taxa municipal acima da nacional do mesmo ano. */
  acimaDaNacional: boolean | null;
}

interface RegistroBruto {
  total?: Record<string, number>;
  jovens?: Record<string, number>;
  taxa?: Record<string, number>;
}

/**
 * Análise pura, separada da leitura para ser testável com fixture. O erro
 * caro seria de recorte: comparar a taxa municipal de um ano com a nacional
 * de outro, ou tratar ausência de dado como zero homicídio.
 */
export function interpretarViolencia(
  registro: RegistroBruto,
  anos: number[],
  brasil: { ano: number; taxa: number } | null,
): Omit<ViolenciaMunicipal, "fonte"> | null {
  const em = (mapa: Record<string, number> | undefined, ano: number): number | null => {
    const v = mapa?.[String(ano)];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };

  const serie: PontoViolencia[] = anos
    .map((ano) => ({
      ano,
      total: em(registro.total, ano),
      jovens: em(registro.jovens, ano),
      taxa: em(registro.taxa, ano),
    }))
    .filter((p) => p.total !== null || p.jovens !== null || p.taxa !== null);
  if (serie.length === 0) return null;

  const ultimo = serie[serie.length - 1];
  const primeiraTaxa = serie.find((p) => p.taxa !== null)?.taxa ?? null;

  return {
    brasil,
    serie,
    ultimo,
    participacaoJovensPct:
      ultimo.jovens !== null && ultimo.total !== null && ultimo.total > 0
        ? Math.round((ultimo.jovens / ultimo.total) * 1000) / 10
        : null,
    tendenciaTaxaPct:
      ultimo.taxa !== null && primeiraTaxa !== null && primeiraTaxa > 0 && ultimo.taxa !== primeiraTaxa
        ? Math.round(((ultimo.taxa - primeiraTaxa) / primeiraTaxa) * 1000) / 10
        : ultimo.taxa !== null && primeiraTaxa !== null
          ? 0
          : null,
    acimaDaNacional:
      ultimo.taxa !== null && brasil !== null && brasil.ano === ultimo.ano ? ultimo.taxa > brasil.taxa : null,
  };
}

interface ArquivoViolencia {
  fonte?: string;
  anos?: number[];
  brasil?: { ano?: number; taxa?: number } | null;
  municipios?: Record<string, RegistroBruto>;
}

let cache: ArquivoViolencia | null | undefined;

function carregar(): ArquivoViolencia | null {
  if (cache !== undefined) return cache;
  try {
    cache = JSON.parse(readFileSync(join(process.cwd(), ARQUIVO), "utf8")) as ArquivoViolencia;
  } catch {
    // Dataset ausente: o bloco some do relatório em vez de derrubar a geração.
    cache = null;
  }
  return cache;
}

export function getViolenciaMunicipal(codigoIBGE: string): ViolenciaMunicipal | null {
  const arquivo = carregar();
  const digits = codigoIBGE.replace(/\D/g, "");
  const registro = arquivo?.municipios?.[digits];
  if (!arquivo || !registro || !Array.isArray(arquivo.anos)) return null;

  const brasil =
    arquivo.brasil && typeof arquivo.brasil.ano === "number" && typeof arquivo.brasil.taxa === "number"
      ? { ano: arquivo.brasil.ano, taxa: arquivo.brasil.taxa }
      : null;
  const analise = interpretarViolencia(registro, arquivo.anos, brasil);
  if (!analise) return null;

  return {
    fonte: arquivo.fonte ?? "Atlas da Violência (IPEA/FBSP), via IPEADATA",
    ...analise,
  };
}
