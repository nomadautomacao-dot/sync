/**
 * Densidade e dispersão da rede — o custo geográfico de ofertar.
 *
 * Duas metades, uma local e uma viva:
 *
 * - **Dispersão** (análise pura sobre `escolas-territorio.json`): a coordenada
 *   que cada escola declara ao Censo já está no repositório. Daí saem escolas
 *   por 100 km², a distância das escolas rurais ao núcleo urbano da rede e a
 *   envergadura — a maior distância entre duas escolas quaisquer.
 * - **População rural** (SIDRA, agregado 10211, Censo 2022): a fatia da
 *   população que mora fora da área urbana, consultada ao vivo na geração.
 *
 * ## Por que entra num relatório de FUNDEB
 *
 * Dispersão é o custo que não aparece no valor-aluno. Duas redes com a mesma
 * matrícula e o mesmo VAAF custam diferente se uma cabe em 40 km² e a outra se
 * espalha por 8 mil: transporte, merenda, supervisão pedagógica e reposição de
 * professor faltante são todos função da distância. O fator de ponderação do
 * campo (+15%) reconhece isso de forma achatada — paga igual para a escola a
 * 6 km e para a que está a 90 km da sede.
 *
 * O cruzamento que a página faz é o ponto: **% da população que é rural × % das
 * escolas que são rurais × % das matrículas que estão nelas.** Quando a fatia
 * de matrícula rural é muito menor que a fatia de população rural, ou a rede
 * não alcança o território, ou a criança do campo está sendo transportada para
 * a escola urbana — e transporte é despesa que o VAAF não cobre. Os dois casos
 * são achados de campo, e a página faz a pergunta com o número dentro.
 *
 * Nada aqui é rótulo do município: distância é geografia, não gestão.
 */

/**
 * O mínimo que a dispersão precisa de uma escola.
 *
 * Declarado aqui em vez de importar `EscolaTerritorio` inteiro porque o
 * modelo do template carrega só o subconjunto geográfico (sem transporte nem
 * cor/raça) — e exigir o tipo completo obrigaria a inventar campos vazios só
 * para satisfazer o compilador. `EscolaTerritorio` continua atribuível a este
 * tipo por estrutura, então o leitor do dataset serve sem conversão.
 */
export interface EscolaGeo {
  codigo: string;
  lat: number | null;
  lng: number | null;
  rural: boolean;
  matriculas: number | null;
}

const BASE = "https://servicodados.ibge.gov.br/api/v3/agregados";

/**
 * Agregado 10211 — "População residente, segundo localização e situação do
 * domicílio" (Censo 2022, disponível em N6/município).
 *
 * Classificação 1 = situação do domicílio (1 urbana, 2 rural);
 * classificação 2661 = localização (32776 = total, para não recortar por
 * unidade de conservação). Colchetes e barra vertical vão percent-encoded: a
 * API devolve corpo vazio quando recebe os caracteres crus.
 */
const TABELA_SITUACAO = "10211";
const VARIAVEL_POPULACAO = "93";
const CLASSIFICACAO = "1%5B1,2%5D%7C2661%5B32776%5D";
const ANO_CENSO = 2022;
const FONTE_SIDRA = "IBGE — Censo Demográfico 2022 (SIDRA, tabela 10211)";

const RAIO_TERRA_KM = 6371;

/** Uma casa decimal, o padrão dos demais indicadores do relatório. */
function umaCasa(valor: number): number {
  return Math.round(valor * 10) / 10;
}

/**
 * Distância de grande círculo entre dois pontos, em km.
 *
 * Haversine e não uma aproximação planar porque municípios amazônicos passam
 * de 150 km de envergadura, onde o erro do plano já é grosseiro.
 */
export function distanciaKm(
  latA: number,
  lngA: number,
  latB: number,
  lngB: number,
): number {
  const rad = Math.PI / 180;
  const dLat = (latB - latA) * rad;
  const dLng = (lngB - lngA) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(latA * rad) * Math.cos(latB * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface DispersaoRede {
  /** Escolas da rede, com e sem coordenada. */
  total: number;
  comCoordenada: number;
  /** Escolas por 100 km² de território. `null` sem a área do IBGE. */
  porCemKm2: number | null;
  /**
   * Núcleo urbano da rede — média das coordenadas das escolas urbanas. É o
   * proxy da sede: de onde saem as rotas de transporte e a supervisão.
   */
  centro: { lat: number; lng: number } | null;
  /** Distância média das escolas rurais ao núcleo urbano, em km. */
  mediaRuralKm: number | null;
  /** A escola mais afastada do núcleo urbano. */
  maisDistante: { codigo: string; km: number; matriculas: number | null } | null;
  /** Maior distância entre duas escolas quaisquer — a envergadura da rede. */
  envergaduraKm: number | null;
  /** % das escolas em zona rural (sobre o total, não só as com coordenada). */
  escolasRuraisPct: number | null;
  /** % das matrículas que estão em escolas rurais. */
  matriculasRuraisPct: number | null;
}

/**
 * Análise pura, testável com fixture: recebe as escolas já lidas do dataset
 * local e a área territorial do IBGE, e não toca a rede.
 */
export function analisarDispersao(
  escolas: EscolaGeo[],
  areaKm2: number | null,
): DispersaoRede | null {
  if (escolas.length === 0) return null;

  const comCoord = escolas.filter(
    (e): e is EscolaGeo & { lat: number; lng: number } =>
      e.lat !== null && e.lng !== null,
  );

  // O núcleo é a média das urbanas; sem nenhuma urbana georreferenciada, cai
  // para a média de todas — melhor um centro aproximado que nenhum.
  const baseCentro = comCoord.filter((e) => !e.rural);
  const paraCentro = baseCentro.length > 0 ? baseCentro : comCoord;
  const centro =
    paraCentro.length > 0
      ? {
          lat: paraCentro.reduce((t, e) => t + e.lat, 0) / paraCentro.length,
          lng: paraCentro.reduce((t, e) => t + e.lng, 0) / paraCentro.length,
        }
      : null;

  let mediaRuralKm: number | null = null;
  let maisDistante: DispersaoRede["maisDistante"] = null;
  if (centro) {
    const rurais = comCoord.filter((e) => e.rural);
    if (rurais.length > 0) {
      const soma = rurais.reduce(
        (t, e) => t + distanciaKm(centro.lat, centro.lng, e.lat, e.lng),
        0,
      );
      mediaRuralKm = umaCasa(soma / rurais.length);
    }
    for (const e of comCoord) {
      const km = distanciaKm(centro.lat, centro.lng, e.lat, e.lng);
      if (!maisDistante || km > maisDistante.km) {
        maisDistante = { codigo: e.codigo, km: umaCasa(km), matriculas: e.matriculas };
      }
    }
  }

  // Envergadura: par mais distante. O(n²) sobre as georreferenciadas — a maior
  // rede municipal do país fica na casa do milhar, o que é trivial aqui.
  let envergaduraKm: number | null = null;
  for (let i = 0; i < comCoord.length; i += 1) {
    for (let j = i + 1; j < comCoord.length; j += 1) {
      const km = distanciaKm(
        comCoord[i].lat,
        comCoord[i].lng,
        comCoord[j].lat,
        comCoord[j].lng,
      );
      if (envergaduraKm === null || km > envergaduraKm) envergaduraKm = km;
    }
  }

  const rurais = escolas.filter((e) => e.rural).length;
  const comMatricula = escolas.filter((e) => e.matriculas !== null);
  const matriculasTotal = comMatricula.reduce((t, e) => t + (e.matriculas ?? 0), 0);
  const matriculasRurais = comMatricula
    .filter((e) => e.rural)
    .reduce((t, e) => t + (e.matriculas ?? 0), 0);

  return {
    total: escolas.length,
    comCoordenada: comCoord.length,
    porCemKm2: areaKm2 && areaKm2 > 0 ? umaCasa((escolas.length / areaKm2) * 100) : null,
    centro,
    mediaRuralKm,
    maisDistante,
    envergaduraKm: envergaduraKm === null ? null : umaCasa(envergaduraKm),
    escolasRuraisPct: umaCasa((rurais / escolas.length) * 100),
    matriculasRuraisPct:
      matriculasTotal > 0 ? umaCasa((matriculasRurais / matriculasTotal) * 100) : null,
  };
}

export interface PopulacaoRural {
  fonte: string;
  ano: number;
  urbana: number;
  rural: number;
  total: number;
  /** % da população residente que mora em área rural. */
  pctRural: number;
}

interface SerieAgregado {
  resultados?: Array<{
    classificacoes?: Array<{ id?: string; categoria?: Record<string, string> }>;
    series?: Array<{ serie?: Record<string, string> }>;
  }>;
}

/**
 * Análise pura da resposta do SIDRA, separada do `fetch` para ser testável.
 *
 * A resposta traz um resultado por categoria da classificação 1; a chave da
 * categoria é "1" (urbana) ou "2" (rural).
 */
export function lerPopulacaoRural(payload: unknown): PopulacaoRural | null {
  if (!Array.isArray(payload)) return null;

  let urbana: number | null = null;
  let rural: number | null = null;

  for (const variavel of payload as SerieAgregado[]) {
    for (const resultado of variavel.resultados ?? []) {
      const situacao = resultado.classificacoes?.find((c) => c.id === "1");
      const chave = Object.keys(situacao?.categoria ?? {})[0];
      if (chave !== "1" && chave !== "2") continue;

      for (const serie of resultado.series ?? []) {
        const bruto = Object.values(serie.serie ?? {})[0];
        const valor = Number(bruto);
        // O SIDRA usa "-" e "..." para sem-dado; Number("-") vira NaN.
        if (!Number.isFinite(valor)) continue;
        if (chave === "1") urbana = valor;
        else rural = valor;
      }
    }
  }

  if (urbana === null || rural === null) return null;
  const total = urbana + rural;
  if (total <= 0) return null;

  return {
    fonte: FONTE_SIDRA,
    ano: ANO_CENSO,
    urbana,
    rural,
    total,
    pctRural: umaCasa((rural / total) * 100),
  };
}

export async function getPopulacaoRural(
  codigoIBGE: string,
  fetcher: typeof fetch = fetch,
): Promise<PopulacaoRural | null> {
  const digits = codigoIBGE.replace(/\D/g, "");
  if (digits.length !== 7) return null;

  try {
    const url =
      `${BASE}/${TABELA_SITUACAO}/periodos/${ANO_CENSO}` +
      `/variaveis/${VARIAVEL_POPULACAO}` +
      `?localidades=N6%5B${digits}%5D&classificacao=${CLASSIFICACAO}`;

    const resposta = await fetcher(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!resposta.ok) return null;
    return lerPopulacaoRural(await resposta.json());
  } catch {
    // Fonte viva fora do ar não derruba o relatório: o bloco degrada.
    return null;
  }
}
