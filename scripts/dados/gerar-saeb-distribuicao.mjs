#!/usr/bin/env node
/**
 * Gera `data/inep/saeb-distribuicao.json` — a distribuição de proficiência do
 * Saeb 2023 da **rede municipal**, por município: % de alunos em cada nível
 * da escala, em LP e MT, no 5º e no 9º ano.
 *
 * ## Por que este dataset existe
 *
 * A média esconde a cauda: duas redes com MEDIA_5_LP idêntica podem ter 10% ou
 * 35% dos alunos abaixo do básico. É a cauda que a Condicionalidade III do
 * VAAR mede (redução das desigualdades de aprendizagem) — e é nela que mora a
 * decisão pedagógica.
 *
 * ## Fonte e formato
 *
 * A "planilha de resultados" oficial do Saeb 2023 é um RAR com um `.xlsb`
 * (BIFF12) — o microdado é mascarado pós-LGPD, mas esta divulgação municipal
 * é identificada. O parser BIFF12 abaixo lê apenas o que o dataset precisa:
 * registros de linha (BrtRowHdr), células RK/Real/Isst e o sharedStrings.
 *
 * A extração do RAR usa o `tar` do sistema (libarchive lê RAR5 — presente no
 * Windows 10+ e na maioria dos Linux). Alternativa: passar o `.xlsb` já
 * extraído como argumento.
 *
 * ## Uso
 *
 *     npm run dados:saeb-distribuicao          # baixa o RAR do INEP
 *     node scripts/dados/gerar-saeb-distribuicao.mjs <Resultados....xlsb>
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { inflateRawSync } from "node:zlib";

const ANO = 2023;
const URL_RAR = "https://download.inep.gov.br/saeb/resultados/planilha_de_resultados_2023.rar";
const NOME_XLSB = "Resultados_Saeb_2023_Brasil_Estados_Municipios.xlsb";
const DESTINO = join(process.cwd(), "data", "inep", "saeb-distribuicao.json");

function log(mensagem) {
  console.log(`[saeb-distribuicao] ${mensagem}`);
}

// ── ZIP ─────────────────────────────────────────────────────────────────────

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
    const metodo = buf.readUInt16LE(p + 10);
    const comprimido = buf.readUInt32LE(p + 20);
    const nomeLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const comentLen = buf.readUInt16LE(p + 32);
    const offsetLocal = buf.readUInt32LE(p + 42);
    entradas.set(buf.toString("utf8", p + 46, p + 46 + nomeLen), { comprimido, offsetLocal, metodo });
    p += 46 + nomeLen + extraLen + comentLen;
  }
  return entradas;
}

function conteudoDe(buf, entrada) {
  const nomeLen = buf.readUInt16LE(entrada.offsetLocal + 26);
  const extraLen = buf.readUInt16LE(entrada.offsetLocal + 28);
  const inicio = entrada.offsetLocal + 30 + nomeLen + extraLen;
  const cru = buf.subarray(inicio, inicio + entrada.comprimido);
  return entrada.metodo === 0 ? cru : inflateRawSync(cru);
}

// ── BIFF12 ──────────────────────────────────────────────────────────────────

/** id em 1–2 bytes (bit alto = continua) + tamanho varint de até 4 bytes. */
function* registros(b) {
  let p = 0;
  while (p < b.length) {
    let id = b[p++];
    if (id & 0x80) id = (id & 0x7f) | ((b[p++] & 0x7f) << 7);
    let len = 0;
    let shift = 0;
    let x;
    do {
      x = b[p++];
      len |= (x & 0x7f) << shift;
      shift += 7;
    } while (x & 0x80);
    yield { id, data: b.subarray(p, p + len) };
    p += len;
  }
}

const BRT_ROW = 0;
const BRT_CELL_RK = 2;
const BRT_CELL_REAL = 5;
const BRT_CELL_ST = 6;
const BRT_CELL_ISST = 7;
const BRT_SST_ITEM = 19;

/** Número RK: 30 bits + flags de inteiro e de ÷100. */
function valorRk(u) {
  const dividir = u & 1;
  let valor;
  if (u & 2) {
    valor = (u | 0) >> 2;
  } else {
    const tmp = Buffer.alloc(8);
    tmp.writeUInt32LE((u & 0xfffffffc) >>> 0, 4);
    valor = tmp.readDoubleLE(0);
  }
  return dividir ? valor / 100 : valor;
}

function stringsCompartilhadas(bin) {
  const strings = [];
  for (const r of registros(bin)) {
    if (r.id === BRT_SST_ITEM) {
      const cch = r.data.readUInt32LE(1);
      strings.push(r.data.toString("utf16le", 5, 5 + cch * 2));
    }
  }
  return strings;
}

/** Percorre a sheet linha a linha entregando Map coluna → valor. */
function porLinha(bin, strings, aoEncontrarLinha) {
  let celulas = null;
  for (const r of registros(bin)) {
    if (r.id === BRT_ROW && r.data.length >= 4) {
      if (celulas && celulas.size) aoEncontrarLinha(celulas);
      celulas = new Map();
      continue;
    }
    if (!celulas || r.data.length < 12) continue;
    const col = r.data.readUInt32LE(0);
    if (r.id === BRT_CELL_RK) celulas.set(col, valorRk(r.data.readUInt32LE(8)));
    else if (r.id === BRT_CELL_REAL && r.data.length >= 16) celulas.set(col, r.data.readDoubleLE(8));
    else if (r.id === BRT_CELL_ISST) celulas.set(col, strings[r.data.readUInt32LE(8)] ?? "");
    else if (r.id === BRT_CELL_ST) {
      const cch = r.data.readUInt32LE(8);
      if (12 + cch * 2 <= r.data.length) celulas.set(col, r.data.toString("utf16le", 12, 12 + cch * 2));
    }
  }
  if (celulas && celulas.size) aoEncontrarLinha(celulas);
}

// ── Extração ────────────────────────────────────────────────────────────────

function obterXlsb(argumento) {
  if (argumento) return readFileSync(argumento);

  const pasta = mkdtempSync(join(tmpdir(), "saeb-"));
  try {
    const rar = join(pasta, "resultados.rar");
    log(`baixando ${URL_RAR}…`);
    return fetch(URL_RAR, { signal: AbortSignal.timeout(600_000), headers: { "User-Agent": "Mozilla/5.0" } })
      .then(async (resposta) => {
        if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
        writeFileSync(rar, Buffer.from(await resposta.arrayBuffer()));
        // libarchive (tar do Windows 10+ e bsdtar) lê RAR5.
        execFileSync("tar", ["-xf", rar, NOME_XLSB], { cwd: pasta });
        return readFileSync(join(pasta, NOME_XLSB));
      })
      .finally(() => rmSync(pasta, { recursive: true, force: true }));
  } catch (erro) {
    rmSync(pasta, { recursive: true, force: true });
    throw erro;
  }
}

/** As séries que o relatório usa, com a quantidade de níveis de cada escala. */
const SERIES = [
  { chave: "lp5", media: "MEDIA_5_LP", prefixo: "nivel_", sufixo: "_LP5", niveis: 10 },
  { chave: "mt5", media: "MEDIA_5_MT", prefixo: "nivel_", sufixo: "_MT5", niveis: 11 },
  { chave: "lp9", media: "MEDIA_9_LP", prefixo: "nivel_", sufixo: "_LP9", niveis: 9 },
  { chave: "mt9", media: "MEDIA_9_MT", prefixo: "nivel_", sufixo: "_MT9", niveis: 10 },
];

async function main() {
  const xlsb = await obterXlsb(process.argv[2]);
  const zip = entradasZip(xlsb);

  const strings = stringsCompartilhadas(conteudoDe(xlsb, zip.get("xl/sharedStrings.bin")));
  // A 4ª aba é "Municípios" — conferido pelo cabeçalho antes de aproveitar.
  const sheet = conteudoDe(xlsb, zip.get("xl/worksheets/sheet4.bin"));

  let colunas = null;
  const municipios = {};
  let aproveitados = 0;

  porLinha(sheet, strings, (celulas) => {
    if (!colunas) {
      const nomes = new Map();
      for (const [i, v] of celulas) if (typeof v === "string" && v) nomes.set(v, i);
      if (!nomes.has("CO_MUNICIPIO")) {
        throw new Error("a 4ª aba não tem CO_MUNICIPIO — o layout da planilha mudou.");
      }
      colunas = nomes;
      return;
    }
    const em = (nome) => celulas.get(colunas.get(nome));
    // Rede municipal, total de localização — o recorte do FUNDEB.
    if (em("DEPENDENCIA_ADM") !== "Municipal" || em("LOCALIZACAO") !== "Total") return;
    const codigo = String(em("CO_MUNICIPIO") ?? "").replace(/\D/g, "");
    if (codigo.length !== 7) return;

    const registro = {};
    for (const serie of SERIES) {
      const media = em(serie.media);
      const niveis = [];
      let soma = 0;
      for (let n = 0; n < serie.niveis; n++) {
        const v = em(`${serie.prefixo}${n}${serie.sufixo}`);
        const pct = typeof v === "number" && Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
        niveis.push(pct);
        soma += pct;
      }
      // Sem alunos avaliados na etapa a soma fica 0 — a série sai do registro.
      if (typeof media === "number" && soma > 50) {
        registro[serie.chave] = { media: Math.round(media * 10) / 10, niveis };
      }
    }
    if (Object.keys(registro).length > 0) {
      municipios[codigo] = registro;
      aproveitados += 1;
    }
  });

  if (aproveitados < 3000) {
    throw new Error(`só ${aproveitados} municípios aproveitados — o layout da planilha mudou.`);
  }

  const conteudo = {
    _comentario:
      "Gerado por scripts/dados/gerar-saeb-distribuicao.mjs. Não editar à mão. Regerar com: npm run dados:saeb-distribuicao",
    fonte: "INEP — planilha de resultados do Saeb 2023, aba Municípios, rede municipal",
    ano: ANO,
    geradoEm: new Date().toISOString(),
    municipios,
  };

  mkdirSync(dirname(DESTINO), { recursive: true });
  const json = JSON.stringify(conteudo);
  writeFileSync(DESTINO, json, "utf8");
  log(
    `escrito ${DESTINO} — ${(json.length / 1024 / 1024).toFixed(2)} MB, ` +
      `${aproveitados.toLocaleString("pt-BR")} municípios com rede municipal avaliada`,
  );
}

main().catch((erro) => {
  console.error(`[saeb-distribuicao] falhou: ${erro.message}`);
  process.exit(1);
});
