#!/usr/bin/env node
/**
 * Gera `data/inep-equidade-municipal.json` — recorte de **cor/raça** e de
 * **localização diferenciada** (terra indígena, remanescente de quilombo,
 * assentamento, rural) da rede municipal e da rede pública, por município.
 *
 * ## Por que esses dados importam para o FUNDEB
 *
 * Não são só indicadores sociais. A Portaria do FUNDEB pondera matrícula de
 * educação escolar **indígena e quilombola** acima da matrícula urbana comum,
 * assim como a matrícula do **campo** — ou seja, a mesma criança vale valores
 * diferentes conforme onde e como está registrada no Censo. Rede que não
 * declara corretamente essas condições recebe menos do que teria direito.
 *
 * O recorte de cor/raça alimenta a leitura de **equidade**, que é o eixo das
 * condicionalidades do VAAR: o fundo passou a premiar redução de desigualdade
 * de aprendizado entre grupos, e não só média.
 *
 * ## Fonte
 *
 * Microdados do Censo Escolar da Educação Básica (INEP), dois arquivos:
 *
 * - `Tabela_Matricula_<ano>.csv` — matrícula agregada por escola, com as
 *   colunas `QT_MAT_BAS_BRANCA/PRETA/PARDA/AMARELA/INDIGENA/ND`.
 * - `Tabela_Escola_<ano>.csv` — a que diz o município, a dependência
 *   administrativa e a localização diferenciada de cada escola.
 *
 * O primeiro não tem município e o segundo não tem cor/raça: o recorte
 * municipal só existe depois da junção por `CO_ENTIDADE`.
 *
 * ## Uso
 *
 *     npm run dados:equidade            # baixa o Censo mais recente publicado
 *     npm run dados:equidade -- 2024    # ano específico
 */

import { createWriteStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import JSZip from "jszip";

const ANO_PADRAO = 2025;
const DESTINO = join(process.cwd(), "data", "inep-equidade-municipal.json");
const TIMEOUT_MS = 900_000;

/** Dependência administrativa no Censo: 1 federal, 2 estadual, 3 municipal. */
const DEP_MUNICIPAL = "3";
const DEPENDENCIAS_PUBLICAS = new Set(["1", "2", "3"]);
/** Só escola em atividade entra na conta; 1 = em atividade. */
const SITUACAO_EM_ATIVIDADE = "1";
/** TP_LOCALIZACAO: 1 urbana, 2 rural. */
const LOCALIZACAO_RURAL = "2";
/** TP_LOCALIZACAO_DIFERENCIADA: 1 assentamento, 2 terra indígena, 3 quilombo. */
const DIFERENCIADA = { assentamento: "1", terraIndigena: "2", quilombola: "3" };

const CORES = [
  ["naoDeclarada", "QT_MAT_BAS_ND"],
  ["branca", "QT_MAT_BAS_BRANCA"],
  ["preta", "QT_MAT_BAS_PRETA"],
  ["parda", "QT_MAT_BAS_PARDA"],
  ["amarela", "QT_MAT_BAS_AMARELA"],
  ["indigena", "QT_MAT_BAS_INDIGENA"],
];

function log(mensagem) {
  console.log(`[equidade] ${mensagem}`);
}

function urlDoAno(ano) {
  // O INEP publicou 2025 com um underscore extra no nome do arquivo. Não é
  // erro de digitação: as duas grafias coexistem no diretório de dados abertos.
  return ano >= 2025
    ? `https://download.inep.gov.br/dados_abertos/microdados_censo_escolar_${ano}_.zip`
    : `https://download.inep.gov.br/dados_abertos/microdados_censo_escolar_${ano}.zip`;
}

async function baixarZip(ano, destino) {
  if (existsSync(destino)) {
    log(`zip já em cache: ${destino}`);
    return;
  }
  const url = urlDoAno(ano);
  log(`baixando ${url}`);
  const inicio = Date.now();
  const resposta = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!resposta.ok) {
    throw new Error(`INEP respondeu HTTP ${resposta.status} para o Censo ${ano}`);
  }
  mkdirSync(dirname(destino), { recursive: true });
  await pipeline(Readable.fromWeb(resposta.body), createWriteStream(destino));
  log(`baixado em ${((Date.now() - inicio) / 1000).toFixed(1)}s`);
}

function acharEntrada(zip, sufixo) {
  const nome = Object.keys(zip.files).find((n) => n.replace(/\\/g, "/").endsWith(sufixo));
  if (!nome) throw new Error(`Não encontrei ${sufixo} dentro do zip do Censo.`);
  return zip.files[nome];
}

/**
 * Percorre o CSV linha a linha. Os arquivos passam de 160 MB, então nada de
 * carregar em memória: só o índice de escolas fica retido, e ele cabe.
 *
 * Separador `;` sem aspas — verificado nos microdados de 2025, onde nenhum
 * campo de texto contém o separador. Por isso `split` basta e não é preciso um
 * parser de CSV, que a este volume custaria minutos.
 *
 * As colunas que este script lê são todas numéricas ou códigos ASCII, então o
 * latin1 dos microdados não interfere; os acentos ficam só em campos de texto
 * que não consumimos.
 */
async function lerCsv(entrada, aoLerLinha) {
  const leitor = createInterface({ input: entrada.nodeStream(), crlfDelay: Infinity });

  let colunas = null;
  for await (const linha of leitor) {
    const campos = linha.split(";");
    if (!colunas) {
      // A primeira coluna pode vir com BOM colado no nome.
      colunas = new Map(campos.map((c, i) => [c.trim().replace(/^﻿/, ""), i]));
      for (const obrigatoria of ["CO_ENTIDADE"]) {
        if (!colunas.has(obrigatoria)) {
          throw new Error(`Coluna ${obrigatoria} ausente — o layout do INEP mudou.`);
        }
      }
      continue;
    }
    aoLerLinha(campos, colunas);
  }
}

const inteiro = (valor) => {
  const n = Number.parseInt(String(valor ?? "").trim(), 10);
  return Number.isFinite(n) ? n : 0;
};

function bucketVazio() {
  const b = { total: 0 };
  for (const [chave] of CORES) b[chave] = 0;
  return b;
}

async function main() {
  const ano = Number(process.argv[2]) || ANO_PADRAO;
  const zipPath = join(tmpdir(), "sync-censo", `microdados_censo_escolar_${ano}.zip`);

  await baixarZip(ano, zipPath);
  log("abrindo o pacote");
  const zip = await JSZip.loadAsync(await readFile(zipPath));

  // ── Passo 1: índice de escolas ────────────────────────────────────────────
  /** CO_ENTIDADE → { municipio, municipal, publica, rural, diferenciada, indigena } */
  const escolas = new Map();
  const territorio = new Map(); // municipio → contagem de escolas por condição

  await lerCsv(acharEntrada(zip, `Tabela_Escola_${ano}.csv`), (campos, col) => {
    if (campos[col.get("TP_SITUACAO_FUNCIONAMENTO")] !== SITUACAO_EM_ATIVIDADE) return;

    const dependencia = campos[col.get("TP_DEPENDENCIA")];
    if (!DEPENDENCIAS_PUBLICAS.has(dependencia)) return;

    const municipio = String(campos[col.get("CO_MUNICIPIO")] ?? "").trim();
    if (!/^\d{7}$/.test(municipio)) return;

    const municipal = dependencia === DEP_MUNICIPAL;
    const diferenciada = campos[col.get("TP_LOCALIZACAO_DIFERENCIADA")];
    const rural = campos[col.get("TP_LOCALIZACAO")] === LOCALIZACAO_RURAL;
    const indigena = campos[col.get("IN_EDUCACAO_INDIGENA")] === "1";

    escolas.set(campos[col.get("CO_ENTIDADE")], { municipio, municipal });

    if (!territorio.has(municipio)) {
      territorio.set(municipio, {
        municipaisTotal: 0,
        municipaisRurais: 0,
        municipaisTerraIndigena: 0,
        municipaisQuilombolas: 0,
        municipaisAssentamento: 0,
        municipaisEducacaoIndigena: 0,
      });
    }
    if (municipal) {
      const t = territorio.get(municipio);
      t.municipaisTotal += 1;
      if (rural) t.municipaisRurais += 1;
      if (diferenciada === DIFERENCIADA.terraIndigena) t.municipaisTerraIndigena += 1;
      if (diferenciada === DIFERENCIADA.quilombola) t.municipaisQuilombolas += 1;
      if (diferenciada === DIFERENCIADA.assentamento) t.municipaisAssentamento += 1;
      if (indigena) t.municipaisEducacaoIndigena += 1;
    }
  });

  log(`${escolas.size.toLocaleString("pt-BR")} escolas públicas em atividade indexadas`);

  // ── Passo 2: matrícula por cor/raça, agregada no município ────────────────
  const municipios = new Map();
  let semEscola = 0;

  await lerCsv(acharEntrada(zip, `Tabela_Matricula_${ano}.csv`), (campos, col) => {
    const escola = escolas.get(campos[col.get("CO_ENTIDADE")]);
    if (!escola) {
      semEscola += 1;
      return;
    }

    if (!municipios.has(escola.municipio)) {
      municipios.set(escola.municipio, { municipal: bucketVazio(), publica: bucketVazio() });
    }
    const alvo = municipios.get(escola.municipio);

    for (const [chave, coluna] of CORES) {
      const valor = inteiro(campos[col.get(coluna)]);
      if (valor === 0) continue;
      alvo.publica[chave] += valor;
      alvo.publica.total += valor;
      if (escola.municipal) {
        alvo.municipal[chave] += valor;
        alvo.municipal.total += valor;
      }
    }
  });

  if (semEscola > 0) {
    // Escola privada ou paralisada: esperado, já que o índice só guarda a rede
    // pública em atividade. Registrar evita que uma mudança de layout do INEP
    // passe despercebida como "zero matrícula".
    log(`${semEscola.toLocaleString("pt-BR")} linhas de matrícula fora da rede pública ativa (ignoradas)`);
  }

  const saida = {
    _comentario:
      "Gerado por scripts/dados/gerar-equidade-censo-municipal.mjs. Não editar à mão. Regerar com: npm run dados:equidade",
    fonte: `INEP — Microdados do Censo Escolar da Educação Básica ${ano}`,
    anoCenso: ano,
    geradoEm: new Date().toISOString(),
    municipios: Object.fromEntries(
      [...municipios.entries()]
        .filter(([, v]) => v.publica.total > 0)
        .map(([codigo, v]) => [
          codigo,
          { ...v, escolas: territorio.get(codigo) ?? null },
        ]),
    ),
  };

  mkdirSync(dirname(DESTINO), { recursive: true });
  const json = JSON.stringify(saida);
  writeFileSync(DESTINO, json, "utf8");
  log(
    `escrito ${DESTINO} — ${Object.keys(saida.municipios).length.toLocaleString("pt-BR")} municípios, ` +
      `${(json.length / 1024 / 1024).toFixed(2)} MB`,
  );

  if (process.env.SYNC_MANTER_ZIP !== "1") {
    await rm(zipPath, { force: true });
    log("zip temporário removido (SYNC_MANTER_ZIP=1 para preservar)");
  }
}

main().catch((erro) => {
  console.error(`[equidade] falhou: ${erro.message}`);
  process.exit(1);
});
