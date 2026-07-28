#!/usr/bin/env node
/**
 * Gera `data/caged-municipios.json` a partir das duas séries do Novo CAGED
 * publicadas pelo IPEADATA (admissões e desligamentos, série sem ajuste).
 *
 * ## Por que este snapshot existe
 *
 * A API OData do IPEADATA ignora `$filter`, `$top` e `$select`. Medido em
 * 28/07/2026: tanto `?$top=5` quanto `?$filter=TERCODIGO eq '3136959'`
 * devolvem os mesmos 58,45 MB em ~33 s. Não existe endpoint por município.
 *
 * Sem snapshot, todo processo que gera um Raio-X baixa ~117 MB e espera ~33 s
 * antes do primeiro relatório — e paga de novo a cada restart, porque o cache
 * é de memória e as respostas estouram o limite de 2 MB do cache do Next.
 *
 * O recorte municipal das duas séries cabe em ~1 MB. É esse arquivo que o
 * `core/lib/municipal-profile/emprego.ts` lê.
 *
 * ## Uso
 *
 *     npm run dados:caged
 *
 * O IPEADATA publica o CAGED com ~2 meses de defasagem, então regenerar uma
 * vez por mês mantém o snapshot no mesmo horizonte que a fonte.
 *
 * ## Como se sabe que há dado novo sem baixar nada
 *
 * O endpoint `Metadados` devolve `SERATUALIZACAO` — o instante da última
 * atualização da série — em ~1,6 KB e 0,15 s. Esse carimbo é gravado aqui em
 * `fontes`, e a tela de Ajustes compara o valor gravado com o remoto. Se o
 * remoto for mais novo, há dado a baixar; se não, o snapshot está em dia.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const ODATA = "https://www.ipeadata.gov.br/api/odata4/ValoresSerie";
const ODATA_METADADOS = "https://www.ipeadata.gov.br/api/odata4/Metadados";
const SERIES = [
  { codigo: "ADMISNC", campo: 0, rotulo: "admissões" },
  { codigo: "DESLIGNC", campo: 1, rotulo: "desligamentos" },
];

const DESTINO = join(process.cwd(), "data", "caged-municipios.json");

/**
 * O consumidor compara a janela de meses já publicados do ano corrente com os
 * mesmos meses do ano anterior. O pior caso é dezembro: 12 meses do ano
 * corrente + 12 do anterior. 24 competências é exatamente o suficiente —
 * guardar mais só engorda o diff mensal no git.
 */
const COMPETENCIAS_MANTIDAS = 24;

/** Download de ~58 MB numa rede doméstica pede folga sobre os ~33 s medidos. */
const TIMEOUT_MS = 180_000;

function log(mensagem) {
  console.log(`[caged] ${mensagem}`);
}

/**
 * `SERATUALIZACAO` da série, em ~1,6 KB. É o carimbo que permite responder
 * "há dado novo?" sem tocar nos 58 MB de valores.
 */
async function lerAtualizacaoDaSerie(codigo) {
  const resposta = await fetch(`${ODATA_METADADOS}('${codigo}')`, {
    headers: { Accept: "application/json", "User-Agent": "Sync/1.0" },
    signal: AbortSignal.timeout(30_000),
  });

  if (!resposta.ok) {
    throw new Error(`IPEADATA respondeu HTTP ${resposta.status} para os metadados de ${codigo}`);
  }

  const corpo = await resposta.json();
  return corpo.value?.[0]?.SERATUALIZACAO ?? null;
}

async function baixarSerie(codigo) {
  const url = `${ODATA}(SERCODIGO='${codigo}')`;
  const inicio = Date.now();
  const resposta = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Sync/1.0" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!resposta.ok) {
    throw new Error(`IPEADATA respondeu HTTP ${resposta.status} para ${codigo}`);
  }

  const corpo = await resposta.text();
  const segundos = ((Date.now() - inicio) / 1000).toFixed(1);
  log(`${codigo}: ${(corpo.length / 1024 / 1024).toFixed(1)} MB em ${segundos}s`);
  return JSON.parse(corpo).value ?? [];
}

/** código IBGE → competência "AAAA-MM" → [admissões, desligamentos]. */
const indice = new Map();

function indexar(registros, campo) {
  let aproveitados = 0;

  for (const registro of registros) {
    // A série mistura níveis territoriais: junto dos municípios vêm Brasil,
    // Regiões, Estados e Áreas metropolitanas. Sem este filtro, o TERCODIGO de
    // uma UF ("29") entraria no índice como se fosse município.
    if (registro.NIVNOME !== "Municípios") continue;

    const valor = registro.VALVALOR;
    if (valor === null || !Number.isFinite(valor)) continue;

    // VALDATA vem com fuso ("2026-05-01T00:00:00-03:00"). A competência é o
    // prefixo literal da string: passar por `new Date` desloca o mês num
    // runtime UTC.
    const competencia = registro.VALDATA.slice(0, 7);

    let meses = indice.get(registro.TERCODIGO);
    if (!meses) {
      meses = new Map();
      indice.set(registro.TERCODIGO, meses);
    }

    let movimento = meses.get(competencia);
    if (!movimento) {
      movimento = [0, 0];
      meses.set(competencia, movimento);
    }

    // VALVALOR chega como float (262.0) mesmo sendo contagem de pessoas.
    movimento[campo] = Math.round(valor);
    aproveitados += 1;
  }

  return aproveitados;
}

async function main() {
  const fontes = {};

  // Sequencial, não `Promise.all`: são ~58 MB de texto por série e o pico de
  // heap ao parsear as duas ao mesmo tempo não compensa os segundos ganhos.
  for (const serie of SERIES) {
    // Lido antes dos valores: se a série for republicada no meio do download,
    // o carimbo gravado fica mais velho que o dado — o que faz a tela de
    // Ajustes pedir um refresh a mais. O inverso, gravar um carimbo novo
    // demais, esconderia dado faltante.
    fontes[serie.codigo] = await lerAtualizacaoDaSerie(serie.codigo).catch(() => null);

    const registros = await baixarSerie(serie.codigo);
    const aproveitados = indexar(registros, serie.campo);
    log(`${serie.rotulo}: ${aproveitados.toLocaleString("pt-BR")} linhas municipais indexadas`);
  }

  if (indice.size === 0) {
    throw new Error("Nenhum município indexado — a série veio vazia ou mudou de formato.");
  }

  const todasCompetencias = new Set();
  for (const meses of indice.values()) {
    for (const competencia of meses.keys()) todasCompetencias.add(competencia);
  }

  // "AAAA-MM" ordena lexicograficamente na mesma ordem cronológica.
  const competencias = [...todasCompetencias].sort().slice(-COMPETENCIAS_MANTIDAS);
  const janela = new Set(competencias);

  const municipios = {};
  for (const [codigoIbge, meses] of indice) {
    // O snapshot é lido por código IBGE de 7 dígitos; qualquer TERCODIGO fora
    // desse formato é resíduo de outro nível territorial.
    if (!/^\d{7}$/.test(codigoIbge)) continue;

    const linha = competencias.map((competencia) =>
      janela.has(competencia) ? meses.get(competencia) ?? null : null,
    );
    // Município sem nenhuma competência na janela não precisa ocupar espaço:
    // o leitor já trata ausência como "a fonte respondeu e não tem o dado".
    if (linha.some((valor) => valor !== null)) {
      municipios[codigoIbge] = linha;
    }
  }

  const conteudo = {
    _comentario:
      "Gerado por scripts/dados/gerar-caged-municipios.mjs. Não editar à mão. Regerar com: npm run dados:caged",
    fonte: "Novo CAGED (série sem ajuste), via IPEADATA — ADMISNC e DESLIGNC",
    geradoEm: new Date().toISOString(),
    /** `SERATUALIZACAO` de cada série no momento da geração. Comparar com o
     *  valor remoto responde "há dado novo?" sem baixar os 58 MB. */
    fontes,
    competencias,
    municipios,
  };

  mkdirSync(dirname(DESTINO), { recursive: true });
  writeFileSync(DESTINO, JSON.stringify(conteudo), "utf8");

  const tamanho = (JSON.stringify(conteudo).length / 1024 / 1024).toFixed(2);
  log(
    `escrito ${DESTINO} — ${Object.keys(municipios).length.toLocaleString("pt-BR")} municípios, ` +
      `${competencias[0]} a ${competencias[competencias.length - 1]}, ${tamanho} MB`,
  );
}

main().catch((erro) => {
  console.error(`[caged] falhou: ${erro.message}`);
  process.exit(1);
});
