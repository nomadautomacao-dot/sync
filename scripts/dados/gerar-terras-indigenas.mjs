#!/usr/bin/env node
/**
 * Gera `data/funai/terras-indigenas.json` — as aldeias indígenas por município
 * e a terra indígena a que cada uma pertence, direto do GeoServer da FUNAI.
 *
 * ## Por que este dataset existe
 *
 * O relatório já contava a corrente de três elos da declaração étnica:
 * população indígena (IBGE) → matrícula com cor/raça declarada (Censo Escolar)
 * → matrícula no segmento indígena do FUNDEB (ponderação 1,40 a 2,17). Faltava
 * o elo de cima, o único que é **cadastro oficial e não autodeclaração**: onde
 * a FUNAI registra que há aldeia.
 *
 * Com ele a pergunta de campo deixa de ser genérica. Paulo Afonso/BA, por
 * exemplo, tem **3 aldeias registradas pela FUNAI** e **nenhuma escola
 * municipal declarada em terra indígena** no Censo. Isso não é acusação — a
 * escola pode ser estadual, ou as crianças podem estudar fora da aldeia — mas
 * é exatamente a conferência que ninguém faz, e o segmento indígena é o de
 * maior ponderação da tabela do FUNDEB.
 *
 * ## A fonte
 *
 * `geoserver.funai.gov.br` fala WFS, aberto e sem chave. Duas camadas:
 *
 * - `Funai:aldeias_pontos` — 4.718 aldeias ativas, cada uma com
 *   **`cod_municipio` de 7 dígitos** (chave exata, sem casar nome) e `cod_ti`.
 * - `Funai:tis_poligonais` — as terras, com nome, etnia, fase do processo
 *   demarcatório, modalidade e área.
 *
 * O join é `cod_ti` → `terrai_codigo`. O `municipio_nome` da camada de
 * polígonos é uma lista de nomes por extenso e **não** é usado como chave:
 * casar por nome erraria em homônimo, e a camada de aldeias já traz o código.
 *
 * ## Armadilhas da fonte
 *
 * - Baixar a camada de aldeias inteira numa tacada devolve **HTTP 403**. É
 *   preciso paginar (`count` + `startIndex`, WFS 2.0.0).
 * - `propertyName` **não funciona na WFS 2.0.0** deste GeoServer (HTTP 400).
 *   Para trazer os polígonos sem a geometria — que é o que interessa aqui e
 *   evita megabytes — a chamada precisa ser WFS **1.1.0**, com `typeName` no
 *   singular e `maxFeatures` no lugar de `count`.
 * - `flag_ativo` separa aldeia ativa de inativa; só a ativa entra.
 *
 * ## Uso
 *
 *     npm run dados:terras-indigenas
 *
 * A FUNAI atualiza mensalmente. Regerar quando houver notícia de homologação.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const WFS = "https://geoserver.funai.gov.br/geoserver/ows";
const DESTINO = join(process.cwd(), "data", "funai", "terras-indigenas.json");
const PAGINA = 500;
const CABECALHO = { "User-Agent": "Mozilla/5.0", Accept: "application/json" };

function log(mensagem) {
  console.log(`[terras-indigenas] ${mensagem}`);
}

async function buscarJson(url) {
  const resposta = await fetch(url, { headers: CABECALHO, signal: AbortSignal.timeout(180_000) });
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status} em ${url}`);
  return resposta.json();
}

/** Aldeias — WFS 2.0.0, paginada. A camada inteira de uma vez devolve 403. */
async function baixarAldeias() {
  const todas = [];
  for (let inicio = 0; inicio < 20_000; inicio += PAGINA) {
    const url =
      `${WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=Funai:aldeias_pontos` +
      `&outputFormat=application/json&count=${PAGINA}&startIndex=${inicio}`;
    const corpo = await buscarJson(url);
    const lote = corpo.features ?? [];
    todas.push(...lote);
    log(`aldeias: ${todas.length}`);
    if (lote.length < PAGINA) break;
  }
  return todas;
}

/**
 * Terras — WFS 1.1.0 porque só nela o `propertyName` corta a geometria. Sem
 * isso a resposta vem em megabytes de polígono que este dataset não usa.
 */
async function baixarTerras() {
  const campos = [
    "terrai_codigo",
    "terrai_nome",
    "etnia_nome",
    "uf_sigla",
    "superficie_perimetro_ha",
    "fase_ti",
    "modalidade_ti",
    "faixa_fronteira",
  ].join(",");

  // Sem paginação: a 1.1.0 deste GeoServer rejeita `startIndex` com uma
  // ExceptionReport em XML. Como `propertyName` já tirou a geometria, as ~660
  // terras cabem em ~210 KB numa única resposta.
  const url =
    `${WFS}?service=WFS&version=1.1.0&request=GetFeature&typeName=Funai:tis_poligonais` +
    `&outputFormat=application/json&maxFeatures=5000&propertyName=${campos}`;
  const corpo = await buscarJson(url);
  const todas = corpo.features ?? [];
  log(`terras: ${todas.length}`);
  return todas;
}

function arredondar(valor, casas) {
  const f = 10 ** casas;
  return Math.round(valor * f) / f;
}

async function main() {
  const [aldeias, terras] = await Promise.all([baixarAldeias(), baixarTerras()]);

  const catalogo = {};
  for (const t of terras) {
    const p = t.properties ?? {};
    const codigo = p.terrai_codigo;
    if (codigo === null || codigo === undefined) continue;
    catalogo[String(codigo)] = {
      nome: p.terrai_nome ?? "",
      etnia: p.etnia_nome ?? "",
      uf: p.uf_sigla ?? "",
      fase: p.fase_ti ?? "",
      modalidade: p.modalidade_ti ?? "",
      hectares: Number.isFinite(p.superficie_perimetro_ha)
        ? arredondar(p.superficie_perimetro_ha, 1)
        : null,
      // "Sim"/"Não" na fonte; guardado como booleano.
      fronteira: String(p.faixa_fronteira ?? "").trim().toLowerCase() === "sim",
    };
  }

  const municipios = {};
  let ativas = 0;
  let semCoordenada = 0;

  for (const a of aldeias) {
    const p = a.properties ?? {};
    if (p.flag_ativo !== "A") continue;
    const ibge = String(p.cod_municipio ?? "").trim();
    if (!/^\d{7}$/.test(ibge)) continue;

    const coords = a.geometry?.coordinates;
    const lng = Array.isArray(coords) ? Number(coords[0]) : Number(p.coord_long);
    const lat = Array.isArray(coords) ? Number(coords[1]) : Number(p.coord_lat);
    const temPonto = Number.isFinite(lat) && Number.isFinite(lng);
    if (!temPonto) semCoordenada += 1;

    const registro = { nome: String(p.nome_aldeia ?? "").trim(), ti: String(p.cod_ti ?? "") };
    if (temPonto) {
      registro.lat = arredondar(lat, 5);
      registro.lng = arredondar(lng, 5);
    }

    (municipios[ibge] ??= { aldeias: [] }).aldeias.push(registro);
    ativas += 1;
  }

  if (ativas < 3_000) throw new Error(`só ${ativas} aldeias ativas — o layout da camada mudou.`);
  if (Object.keys(catalogo).length < 300) {
    throw new Error(`só ${Object.keys(catalogo).length} terras — o layout da camada mudou.`);
  }

  // Ordem estável: o dataset é versionado e um diff só deve aparecer quando a
  // FUNAI mudar alguma coisa, não quando o GeoServer devolver outra ordem.
  for (const m of Object.values(municipios)) {
    m.aldeias.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }

  const conteudo = {
    _comentario:
      "Gerado por scripts/dados/gerar-terras-indigenas.mjs. Não editar à mão. Regerar com: npm run dados:terras-indigenas",
    fonte: "FUNAI — GeoServer WFS (Funai:aldeias_pontos e Funai:tis_poligonais), aldeias ativas",
    geradoEm: new Date().toISOString(),
    terras: catalogo,
    municipios: Object.fromEntries(
      Object.entries(municipios).sort(([a], [b]) => a.localeCompare(b)),
    ),
  };

  mkdirSync(dirname(DESTINO), { recursive: true });
  const json = JSON.stringify(conteudo);
  writeFileSync(DESTINO, json, "utf8");
  log(
    `escrito ${DESTINO} — ${(json.length / 1024).toFixed(0)} KB, ${ativas.toLocaleString("pt-BR")} aldeias ativas ` +
      `em ${Object.keys(municipios).length.toLocaleString("pt-BR")} municípios, ` +
      `${Object.keys(catalogo).length.toLocaleString("pt-BR")} terras${semCoordenada ? `, ${semCoordenada} sem coordenada` : ""}`,
  );
}

main().catch((erro) => {
  console.error(`[terras-indigenas] falhou: ${erro.message}`);
  process.exit(1);
});
