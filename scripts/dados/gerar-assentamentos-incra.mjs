#!/usr/bin/env node
/**
 * Gera `data/incra/assentamentos.json` — assentamentos da reforma agrária por
 * município, a partir do acervo fundiário do INCRA.
 *
 * ## Por que este dataset existe
 *
 * Escola que atende assentamento é educação do **campo** no FUNDEB (fator
 * +15% sobre a etapa), e aluno de assentamento conta para a regra da escola
 * urbana com metade dos alunos de residência rural. Um município com
 * centenas de famílias assentadas e nenhuma escola declarada em assentamento
 * merece a conferência — a condição pode estar por declarar na coleta.
 *
 * ## Fonte e método
 *
 * O painel do INCRA não tem export estável, mas o acervo fundiário publica o
 * shapefile nacional ("Assentamento Brasil"); a tabela de atributos (.dbf)
 * traz UF, município, famílias, capacidade e área. O município vem por
 * **nome**, não por código — o matching normaliza (maiúsculas, sem acento ou
 * pontuação) e casa com os nomes do dataset de matrículas ponderadas do
 * FNDE, que já indexa por código IBGE. Os não casados são logados.
 *
 * ## Uso
 *
 *     npm run dados:assentamentos                  # baixa do INCRA
 *     node scripts/dados/gerar-assentamentos-incra.mjs <local.zip|local.dbf>
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { inflateRawSync } from "node:zlib";

const URL_ZIP = "https://certificacao.incra.gov.br/csv_shp/zip/Assentamento%20Brasil.zip";
const DESTINO = join(process.cwd(), "data", "incra", "assentamentos.json");
const PONDERADAS = join(process.cwd(), "data", "fnde", "matriculas-ponderadas-2026.json");

function log(mensagem) {
  console.log(`[incra] ${mensagem}`);
}

function entradasZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66_000); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("EOCD não encontrado");
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const entradas = new Map();
  let p = cdOffset;
  while (p + 46 <= cdOffset + cdSize && buf.readUInt32LE(p) === 0x02014b50) {
    const metodo = buf.readUInt16LE(p + 10);
    const comprimido = buf.readUInt32LE(p + 20);
    const nomeLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const comentLen = buf.readUInt16LE(p + 32);
    const offsetLocal = buf.readUInt32LE(p + 42);
    entradas.set(buf.toString("latin1", p + 46, p + 46 + nomeLen), { metodo, comprimido, offsetLocal });
    p += 46 + nomeLen + extraLen + comentLen;
  }
  return entradas;
}

function bytesDe(buf, entrada) {
  const nomeLen = buf.readUInt16LE(entrada.offsetLocal + 26);
  const extraLen = buf.readUInt16LE(entrada.offsetLocal + 28);
  const inicio = entrada.offsetLocal + 30 + nomeLen + extraLen;
  const dados = buf.subarray(inicio, inicio + entrada.comprimido);
  return entrada.metodo === 0 ? dados : inflateRawSync(dados);
}

/** Lê o DBF (dBase III): cabeçalho fixo + descritores de 32 bytes + registros. */
function lerDbf(buf) {
  const numRegistros = buf.readUInt32LE(4);
  const tamanhoCabecalho = buf.readUInt16LE(8);
  const tamanhoRegistro = buf.readUInt16LE(10);

  const campos = [];
  for (let p = 32; p < tamanhoCabecalho - 1; p += 32) {
    if (buf[p] === 0x0d) break;
    campos.push({
      nome: buf.toString("latin1", p, p + 11).replace(/\0.*$/, ""),
      tamanho: buf[p + 16],
    });
  }

  const registros = [];
  for (let r = 0; r < numRegistros; r++) {
    let off = tamanhoCabecalho + r * tamanhoRegistro;
    if (buf[off] === 0x2a) continue; // registro marcado como apagado
    off += 1;
    const linha = {};
    for (const campo of campos) {
      linha[campo.nome] = buf.toString("latin1", off, off + campo.tamanho).trim();
      off += campo.tamanho;
    }
    registros.push(linha);
  }
  return registros;
}

/** "SANTANA DO ARAGUAIA", "Alta Floresta D'Oeste" → chave comparável. */
function normalizar(nome) {
  return String(nome)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

async function obterDbf(argumento) {
  if (argumento && /\.dbf$/i.test(argumento)) return readFileSync(argumento);

  let zip;
  if (argumento) {
    zip = readFileSync(argumento);
  } else {
    log(`baixando ${URL_ZIP}…`);
    const resposta = await fetch(URL_ZIP, { signal: AbortSignal.timeout(600_000) });
    if (!resposta.ok) throw new Error(`INCRA HTTP ${resposta.status}`);
    zip = Buffer.from(await resposta.arrayBuffer());
  }

  const entradas = entradasZip(zip);
  const nomeDbf = [...entradas.keys()].find((n) => /\.dbf$/i.test(n));
  if (!nomeDbf) throw new Error("nenhum .dbf no ZIP do INCRA");
  return bytesDe(zip, entradas.get(nomeDbf));
}

async function main() {
  const registros = lerDbf(await obterDbf(process.argv[2]));
  log(`${registros.length.toLocaleString("pt-BR")} assentamentos no acervo`);

  // Nome normalizado + UF → código IBGE, a partir do dataset do FNDE.
  const ponderadas = JSON.parse(readFileSync(PONDERADAS, "utf8"));
  const porNomeUf = new Map();
  for (const [codigo, m] of Object.entries(ponderadas.municipios ?? {})) {
    porNomeUf.set(`${m.uf}|${normalizar(m.ente)}`, codigo);
  }

  const municipios = {};
  let casados = 0;
  const naoCasados = new Map();

  /**
   * O INCRA tem duas idiossincrasias de grafia: (1) municípios do entorno
   * goiano/mineiro entram como UF "DF", porque a UF ali é a superintendência,
   * não o ente; (2) "D'Oeste" vira "DO OESTE" (Machadinho, Mojiguaçu etc.),
   * que a normalização não iguala sozinha.
   */
  const localizar = (uf, municipio) => {
    const nome = normalizar(municipio);
    const variantes = new Set([nome]);
    if (nome.includes("DOOESTE")) variantes.add(nome.replace(/DOOESTE/g, "DOESTE"));
    if (nome.includes("DOESTE")) variantes.add(nome.replace(/DOESTE/g, "DOOESTE"));
    if (nome.startsWith("MOJI")) variantes.add(nome.replace(/^MOJI/, "MOGI"));

    const ufs = uf === "DF" ? ["DF", "GO", "MG"] : [uf];
    for (const sigla of ufs) {
      for (const variante of variantes) {
        const codigo = porNomeUf.get(`${sigla}|${variante}`);
        if (codigo) return codigo;
      }
    }
    return undefined;
  };

  for (const r of registros) {
    const codigo = localizar(r.uf, r.municipio);
    if (!codigo) {
      const chave = `${r.uf}/${r.municipio}`;
      naoCasados.set(chave, (naoCasados.get(chave) ?? 0) + 1);
      continue;
    }
    casados += 1;

    let m = municipios[codigo];
    if (!m) {
      m = { qtd: 0, familias: 0, capacidade: 0, areaHa: 0 };
      municipios[codigo] = m;
    }
    m.qtd += 1;
    m.familias += Number(r.num_famili) || 0;
    m.capacidade += Number(r.capacidade) || 0;
    m.areaHa += Number(r.area_hecta) || 0;
  }

  for (const m of Object.values(municipios)) m.areaHa = Math.round(m.areaHa);

  const perdidos = [...naoCasados.values()].reduce((a, b) => a + b, 0);
  log(`${casados.toLocaleString("pt-BR")} casados com código IBGE; ${perdidos} sem correspondência de nome`);
  if (naoCasados.size) {
    log(`amostra dos não casados: ${[...naoCasados.keys()].slice(0, 8).join("; ")}`);
  }
  if (casados === 0) throw new Error("nenhum assentamento casado — o layout ou os nomes mudaram.");

  const conteudo = {
    _comentario:
      "Gerado por scripts/dados/gerar-assentamentos-incra.mjs. Não editar à mão. Regerar com: npm run dados:assentamentos",
    fonte: "INCRA — acervo fundiário (shapefile Assentamento Brasil, tabela de atributos)",
    geradoEm: new Date().toISOString(),
    naoCasados: perdidos,
    municipios,
  };

  mkdirSync(dirname(DESTINO), { recursive: true });
  const json = JSON.stringify(conteudo);
  writeFileSync(DESTINO, json, "utf8");
  log(`escrito ${DESTINO} — ${(json.length / 1024).toFixed(0)} KB, ${Object.keys(municipios).length.toLocaleString("pt-BR")} municípios`);
}

main().catch((erro) => {
  console.error(`[incra] falhou: ${erro.message}`);
  process.exit(1);
});
