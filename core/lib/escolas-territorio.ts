/**
 * Escolas municipais no território — coordenadas, localização diferenciada e
 * transporte público.
 *
 * Os dados vêm de `data/inep/escolas-territorio.json`, gerado offline por
 * `scripts/dados/gerar-escolas-territorio.mjs` a partir dos microdados do
 * Censo Escolar (Tabela_Escola + Tabela_Matricula, rede municipal ativa).
 *
 * ## Por que entra num relatório de FUNDEB
 *
 * - **Mapa da rede**: dispersão territorial é custo de oferta — transporte,
 *   merenda, manutenção — e o contorno da capa ganha as escolas plotadas.
 * - **Territórios de rio** (o exemplo de Manaus): a divulgação pós-LGPD
 *   removeu o tipo de veículo do transporte; o que a fonte sustenta é a
 *   escola em comunidade ribeirinha e o total de alunos em transporte
 *   público — a embarcação vira pergunta de campo com o dado embutido.
 * - Localização diferenciada declarada é fator de ponderação (campo +15%,
 *   indígena/quilombola 1,4–2,17) — o mapa mostra onde ela está declarada.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ARQUIVO = join("data", "inep", "escolas-territorio.json");

/** Códigos do dicionário do INEP para TP_LOCALIZACAO_DIFERENCIADA. */
export const ROTULOS_DIFERENCIADA: Record<number, string> = {
  1: "assentamento",
  2: "terra indígena",
  3: "quilombola",
  8: "comunidade ribeirinha",
};

export interface EscolaTerritorio {
  codigo: string;
  rural: boolean;
  /** Cru do dicionário: 0 = não diferenciada; ver ROTULOS_DIFERENCIADA. */
  dif: number;
  lat: number | null;
  lng: number | null;
  matriculas: number | null;
  /** Alunos da escola que usam transporte público. */
  transporte: number | null;
  /** Matrículas por cor/raça: [ND, branca, preta, parda, amarela, indígena]. */
  racas: number[] | null;
}

export interface CorRacaZona {
  matriculas: number;
  negraPct: number | null;
  indigenaPct: number | null;
  naoDeclaradaPct: number | null;
}

export interface ResumoTerritorio {
  total: number;
  comCoordenada: number;
  rurais: number;
  porDiferenciada: Record<number, number>;
  /** Soma de alunos em transporte público nas escolas com o dado. */
  alunosTransporte: number;
  /** % sobre as matrículas das mesmas escolas. */
  pctTransporte: number | null;
  /** Composição de cor/raça por zona — o recorte que o agregado esconde. */
  corRaca: { urbana: CorRacaZona; rural: CorRacaZona } | null;
  /**
   * Contagens absolutas de cor/raça na rede inteira. Existem separadas dos
   * percentuais por zona porque o cruzamento com a população do Censo
   * Demográfico precisa do número, não da fatia: derivar o absoluto de um
   * percentual arredondado a uma casa erra por dezenas de matrículas em rede
   * grande. Ver `core/lib/municipal-xray-template.ts`, página de declaração
   * étnica.
   */
  corRacaTotais: {
    /** Matrículas nas escolas que preencheram cor/raça — o denominador. */
    matriculas: number;
    indigena: number;
    negra: number;
    naoDeclarada: number;
  } | null;
}

export interface EscolasTerritorioMunicipio {
  fonte: string;
  ano: number;
  escolas: EscolaTerritorio[];
  resumo: ResumoTerritorio;
}

/** Análise pura, testável com fixture. */
export function resumirTerritorio(escolas: EscolaTerritorio[]): ResumoTerritorio {
  const porDiferenciada: Record<number, number> = {};
  let alunosTransporte = 0;
  let matriculasComDado = 0;
  for (const e of escolas) {
    if (e.dif > 0) porDiferenciada[e.dif] = (porDiferenciada[e.dif] ?? 0) + 1;
    if (e.transporte !== null && e.matriculas !== null) {
      alunosTransporte += e.transporte;
      matriculasComDado += e.matriculas;
    }
  }
  // [ND, branca, preta, parda, amarela, indígena] somados por zona.
  const somaZona = { urbana: [0, 0, 0, 0, 0, 0], rural: [0, 0, 0, 0, 0, 0] };
  for (const e of escolas) {
    if (!e.racas || e.racas.length !== 6) continue;
    const destino = e.rural ? somaZona.rural : somaZona.urbana;
    e.racas.forEach((v, i) => (destino[i] += v));
  }
  const zona = (v: number[]): CorRacaZona => {
    const total = v.reduce((t, x) => t + x, 0);
    const pctDe = (x: number) => (total > 0 ? Math.round((x / total) * 1000) / 10 : null);
    return {
      matriculas: total,
      negraPct: pctDe(v[2] + v[3]),
      indigenaPct: pctDe(v[5]),
      naoDeclaradaPct: pctDe(v[0]),
    };
  };
  const urbana = zona(somaZona.urbana);
  const rural = zona(somaZona.rural);

  // [ND, branca, preta, parda, amarela, indígena] somados nas duas zonas.
  const geral = somaZona.urbana.map((v, i) => v + somaZona.rural[i]);
  const totalRacas = geral.reduce((t, x) => t + x, 0);
  const corRacaTotais =
    totalRacas > 0
      ? {
          matriculas: totalRacas,
          indigena: geral[5],
          negra: geral[2] + geral[3],
          naoDeclarada: geral[0],
        }
      : null;

  return {
    total: escolas.length,
    comCoordenada: escolas.filter((e) => e.lat !== null && e.lng !== null).length,
    rurais: escolas.filter((e) => e.rural).length,
    porDiferenciada,
    alunosTransporte,
    pctTransporte:
      matriculasComDado > 0 ? Math.round((alunosTransporte / matriculasComDado) * 1000) / 10 : null,
    corRaca: urbana.matriculas + rural.matriculas > 0 ? { urbana, rural } : null,
    corRacaTotais,
  };
}

interface ArquivoTerritorio {
  fonte?: string;
  ano?: number;
  municipios?: Record<string, { escolas?: Record<string, Record<string, unknown>> }>;
}

let cache: ArquivoTerritorio | null | undefined;

function carregar(): ArquivoTerritorio | null {
  if (cache !== undefined) return cache;
  try {
    cache = JSON.parse(readFileSync(join(process.cwd(), ARQUIVO), "utf8")) as ArquivoTerritorio;
  } catch {
    // Dataset ausente: o bloco some do relatório em vez de derrubar a geração.
    cache = null;
  }
  return cache;
}

function num(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

export function getEscolasTerritorio(codigoIBGE: string): EscolasTerritorioMunicipio | null {
  const arquivo = carregar();
  const digits = codigoIBGE.replace(/\D/g, "");
  const registro = arquivo?.municipios?.[digits];
  if (!arquivo || !registro?.escolas) return null;

  const escolas: EscolaTerritorio[] = Object.entries(registro.escolas).map(([codigo, e]) => ({
    codigo,
    rural: e.rural === 1,
    dif: num(e.dif) ?? 0,
    lat: num(e.lat),
    lng: num(e.lng),
    matriculas: num(e.matriculas),
    transporte: num(e.transporte),
    racas:
      Array.isArray(e.racas) && e.racas.length === 6 && e.racas.every((v) => typeof v === "number")
        ? (e.racas as number[])
        : null,
  }));
  if (escolas.length === 0) return null;

  return {
    fonte: arquivo.fonte ?? "INEP — microdados do Censo Escolar",
    ano: arquivo.ano ?? 0,
    escolas,
    resumo: resumirTerritorio(escolas),
  };
}
