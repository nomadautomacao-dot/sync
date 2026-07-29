#!/usr/bin/env node
/**
 * Gera `data/inep/cor-raca-historico.json` — matrícula por cor/raça da rede
 * municipal e da rede pública, por município e por ano do Censo Escolar
 * (2023, 2024 e 2025), a partir dos microdados do INEP.
 *
 * ## Por que este dataset existe
 *
 * O Relatório Histórico do Censo compara os três últimos Censos — e a
 * composição por cor/raça é a série que alimenta a leitura da
 * Condicionalidade III do VAAR (redução da desigualdade racial de
 * aprendizagem) e a qualidade do próprio cadastro: "não declarada" caindo é
 * coleta melhorando; subindo é o indicador do VAAR sujando na origem.
 *
 * ## Formatos por ano
 *
 * - 2023/2024: tabela única `microdados_ed_basica_<ano>.csv` (uma linha por
 *   escola, com CO_MUNICIPIO, TP_DEPENDENCIA e QT_MAT_BAS_*).
 * - 2025: `Tabela_Escola_2025.csv` + `Tabela_Matricula_2025.csv`, juntadas
 *   por CO_ENTIDADE.
 *
 * ## Uso
 *
 *     npm run dados:cor-raca                     # baixa os 3 ZIPs do INEP
 *     node scripts/dados/gerar-cor-raca-historico.mjs <2023.zip> <2024.zip> <2025.zip>
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInflateRaw } from "node:zlib";
import { StringDecoder } from "node:string_decoder";

const ANOS = [2023, 2024, 2025];
const DESTINO = join(process.cwd(), "data", "inep", "cor-raca-historico.json");
/** [ND, branca, preta, parda, amarela, indígena] — a ordem é contrato com o leitor. */
const COLUNAS_RACA = [
  "QT_MAT_BAS_ND",
  "QT_MAT_BAS_BRANCA",
  "QT_MAT_BAS_PRETA",
  "QT_MAT_BAS_PARDA",
  "QT_MAT_BAS_AMARELA",
  "QT_MAT_BAS_INDIGENA",
];
const DEP_MUNICIPAL = "3";
const DEPENDENCIAS_PUBLICAS = new Set(["1", "2", "3"]);
const SITUACAO_EM_ATIVIDADE = "1";

function log(mensagem) {
  console.log(`[cor-raca-historico] ${mensagem}`);
}

function urlDoAno(ano) {
  // 2025 foi publicado com underscore extra no nome do arquivo.
  return ano === 2025
    ? `https://download.inep.gov.br/dados_abertos/microdados_censo_escolar_${ano}_.zip`
    : `https://download.inep.gov.br/dados_abertos/microdados_censo_escolar_${ano}.zip`;
}

function entradasZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66_000); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("EOCD não encontrado — o arquivo não é um ZIP válido");
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const entradas = new Map();
  let p = cdOffset;
  while (p + 46 <= cdOffset + cdSize && buf.readUInt32LE(p) === 0x02014b50) {
    const comprimido = buf.readUInt32LE(p + 20);
    const nomeLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const comentLen = buf.readUInt16LE(p + 32);
    const offsetLocal = buf.readUInt32LE(p + 42);
    entradas.set(buf.toString("utf8", p + 46, p + 46 + nomeLen), { comprimido, offsetLocal });
    p += 46 + nomeLen + extraLen + comentLen;
  }
  return entradas;
}

/** Percorre um CSV comprimido linha a linha sem inflar tudo na memória. */
async function porLinhaCsv(buf, entrada, aoEncontrarLinha) {
  const nomeLen = buf.readUInt16LE(entrada.offsetLocal + 26);
  const extraLen = buf.readUInt16LE(entrada.offsetLocal + 28);
  const inicio = entrada.offsetLocal + 30 + nomeLen + extraLen;
  const comprimidos = buf.subarray(inicio, inicio + entrada.comprimido);

  await new Promise((resolver, rejeitar) => {
    const inflador = createInflateRaw();
    const decodificador = new StringDecoder("latin1");
    let resto = "";
    inflador.on("data", (pedaco) => {
      resto += decodificador.write(pedaco);
      let corte;
      while ((corte = resto.indexOf("\n")) >= 0) {
        aoEncontrarLinha(resto.slice(0, corte).replace(/\r$/, ""));
        resto = resto.slice(corte + 1);
      }
    });
    inflador.on("end", () => {
      if (resto.trim()) aoEncontrarLinha(resto);
      resolver();
    });
    inflador.on("error", rejeitar);
    inflador.end(comprimidos);
  });
}

function separarCampos(linha) {
  return linha.split(";").map((campo) => campo.replace(/^"|"$/g, ""));
}

function inteiro(texto) {
  const n = Number(texto);
  return Number.isFinite(n) ? n : 0;
}

function somarNoMunicipio(mapa, municipio, chave, racas) {
  let registro = mapa.get(municipio);
  if (!registro) {
    registro = { m: [0, 0, 0, 0, 0, 0], p: [0, 0, 0, 0, 0, 0] };
    mapa.set(municipio, registro);
  }
  const alvo = registro[chave];
  for (let i = 0; i < 6; i++) alvo[i] += racas[i];
}

/** 2023/2024 — uma linha por escola com tudo. */
async function processarTabelaUnica(zip, entradas, ano, porMunicipio) {
  const nome = [...entradas.keys()].find((n) => n.endsWith(`microdados_ed_basica_${ano}.csv`));
  if (!nome) throw new Error(`microdados_ed_basica_${ano}.csv não encontrado no ZIP`);
  let colunas = null;
  let escolas = 0;
  await porLinhaCsv(zip, entradas.get(nome), (linha) => {
    const campos = separarCampos(linha);
    if (!colunas) {
      colunas = new Map(campos.map((c, i) => [c, i]));
      return;
    }
    if (campos[colunas.get("TP_SITUACAO_FUNCIONAMENTO")] !== SITUACAO_EM_ATIVIDADE) return;
    const dependencia = campos[colunas.get("TP_DEPENDENCIA")];
    if (!DEPENDENCIAS_PUBLICAS.has(dependencia)) return;
    const municipio = campos[colunas.get("CO_MUNICIPIO")];
    if (!/^\d{7}$/.test(municipio)) return;
    const racas = COLUNAS_RACA.map((c) => inteiro(campos[colunas.get(c)]));
    if (!racas.some((v) => v > 0)) return;
    escolas += 1;
    somarNoMunicipio(porMunicipio, municipio, "p", racas);
    if (dependencia === DEP_MUNICIPAL) somarNoMunicipio(porMunicipio, municipio, "m", racas);
  });
  log(`${ano}: ${escolas.toLocaleString("pt-BR")} escolas públicas somadas`);
}

/** 2025 — junção Tabela_Matricula × Tabela_Escola por CO_ENTIDADE. */
async function processarTabelasSeparadas(zip, entradas, ano, porMunicipio) {
  const nomeMatricula = [...entradas.keys()].find((n) => n.endsWith(`Tabela_Matricula_${ano}.csv`));
  const nomeEscola = [...entradas.keys()].find((n) => n.endsWith(`Tabela_Escola_${ano}.csv`));
  if (!nomeMatricula || !nomeEscola) throw new Error(`tabelas de ${ano} não encontradas no ZIP`);

  const racasPorEscola = new Map();
  let colunasMat = null;
  await porLinhaCsv(zip, entradas.get(nomeMatricula), (linha) => {
    const campos = separarCampos(linha);
    if (!colunasMat) {
      colunasMat = new Map(campos.map((c, i) => [c, i]));
      return;
    }
    const codigo = campos[colunasMat.get("CO_ENTIDADE")];
    if (!codigo) return;
    const racas = COLUNAS_RACA.map((c) => inteiro(campos[colunasMat.get(c)]));
    if (racas.some((v) => v > 0)) racasPorEscola.set(codigo, racas);
  });

  let colunas = null;
  let escolas = 0;
  await porLinhaCsv(zip, entradas.get(nomeEscola), (linha) => {
    const campos = separarCampos(linha);
    if (!colunas) {
      colunas = new Map(campos.map((c, i) => [c, i]));
      return;
    }
    if (campos[colunas.get("TP_SITUACAO_FUNCIONAMENTO")] !== SITUACAO_EM_ATIVIDADE) return;
    const dependencia = campos[colunas.get("TP_DEPENDENCIA")];
    if (!DEPENDENCIAS_PUBLICAS.has(dependencia)) return;
    const municipio = campos[colunas.get("CO_MUNICIPIO")];
    if (!/^\d{7}$/.test(municipio)) return;
    const racas = racasPorEscola.get(campos[colunas.get("CO_ENTIDADE")]);
    if (!racas) return;
    escolas += 1;
    somarNoMunicipio(porMunicipio, municipio, "p", racas);
    if (dependencia === DEP_MUNICIPAL) somarNoMunicipio(porMunicipio, municipio, "m", racas);
  });
  log(`${ano}: ${escolas.toLocaleString("pt-BR")} escolas públicas somadas`);
}

async function carregarZip(ano, caminhoLocal) {
  if (caminhoLocal) return readFileSync(caminhoLocal);
  const url = urlDoAno(ano);
  log(`baixando ${url}…`);
  const resposta = await fetch(url, {
    signal: AbortSignal.timeout(900_000),
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status} em ${url}`);
  return Buffer.from(await resposta.arrayBuffer());
}

async function main() {
  const locais = process.argv.slice(2);
  const municipios = new Map();

  for (let i = 0; i < ANOS.length; i++) {
    const ano = ANOS[i];
    const zip = await carregarZip(ano, locais[i]);
    const entradas = entradasZip(zip);
    const porMunicipio = new Map();
    if (ano >= 2025) await processarTabelasSeparadas(zip, entradas, ano, porMunicipio);
    else await processarTabelaUnica(zip, entradas, ano, porMunicipio);

    for (const [municipio, registro] of porMunicipio) {
      let doMunicipio = municipios.get(municipio);
      if (!doMunicipio) {
        doMunicipio = {};
        municipios.set(municipio, doMunicipio);
      }
      doMunicipio[ano] = registro;
    }
  }

  mkdirSync(dirname(DESTINO), { recursive: true });
  writeFileSync(
    DESTINO,
    JSON.stringify({
      geradoEm: new Date().toISOString().slice(0, 10),
      fonte:
        "INEP — microdados do Censo Escolar da Educação Básica. Séries m (rede municipal) e p (rede pública), na ordem [não declarada, branca, preta, parda, amarela, indígena], escolas em atividade.",
      anos: ANOS,
      municipios: Object.fromEntries(municipios),
    }),
  );
  log(`${municipios.size.toLocaleString("pt-BR")} municípios · gravado em ${DESTINO}`);
}

main().catch((erro) => {
  console.error(`[cor-raca-historico] Falha: ${erro.message}`);
  process.exit(1);
});
