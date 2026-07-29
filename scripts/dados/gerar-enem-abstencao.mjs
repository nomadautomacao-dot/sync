#!/usr/bin/env node
/**
 * Gera `data/inep/enem-abstencao.json` — inscritos e abstenção no ENEM por
 * município de prova, com o agregado da UF para comparação.
 *
 * ## Por que este dataset existe
 *
 * A abstenção no ENEM é o termômetro público de quanto o fim da educação
 * básica "aponta para algum lugar": onde o exame não é percebido como porta
 * de entrada, a falta é maior — e o mesmo desengajamento aparece antes, na
 * evasão do médio e do EJA. Comparar com a UF separa o efeito local do padrão
 * regional.
 *
 * ## Limitação honesta (pós-LGPD)
 *
 * O microdado do ENEM não traz mais o município de residência — só o **de
 * prova** (`CO_MUNICIPIO_PROVA`). Municípios pequenos sem local de prova não
 * aparecem; candidatos fazem prova na cidade-polo vizinha. O dataset é dos
 * municípios-sede de aplicação, e o relatório imprime essa ressalva.
 *
 * Abstenção aqui = faltou aos DOIS dias (TP_PRESENCA_* = 0 em todas as
 * provas objetivas). Presença parcial conta como presente.
 *
 * ## Uso
 *
 *     npm run dados:enem            # baixa o ZIP do INEP (~500MB)
 *     node scripts/dados/gerar-enem-abstencao.mjs <microdados_enem_2024.zip>
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInflateRaw } from "node:zlib";
import { StringDecoder } from "node:string_decoder";

const ANO = 2024;
const URL = `https://download.inep.gov.br/microdados/microdados_enem_${ANO}.zip`;
const DESTINO = join(process.cwd(), "data", "inep", "enem-abstencao.json");

function log(mensagem) {
  console.log(`[enem] ${mensagem}`);
}

// ── ZIP com suporte a ZIP64 (o CSV do ENEM passa de 4 GB inflado) ───────────

function entradasZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66_000); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("EOCD não encontrado — o arquivo não é um ZIP válido");

  let cdOffset = buf.readUInt32LE(eocd + 16);
  let total = buf.readUInt16LE(eocd + 10);
  // ZIP64: offsets sentinela remetem ao EOCD64.
  if (cdOffset === 0xffffffff) {
    let loc = -1;
    for (let i = eocd - 20; i >= Math.max(0, eocd - 1000); i--) {
      if (buf.readUInt32LE(i) === 0x07064b50) { loc = i; break; }
    }
    if (loc < 0) throw new Error("EOCD64 locator não encontrado");
    const eocd64 = Number(buf.readBigUInt64LE(loc + 8));
    cdOffset = Number(buf.readBigUInt64LE(eocd64 + 48));
    total = Number(buf.readBigUInt64LE(eocd64 + 32));
  }

  const entradas = new Map();
  let p = cdOffset;
  for (let n = 0; n < total && buf.readUInt32LE(p) === 0x02014b50; n++) {
    let comprimido = buf.readUInt32LE(p + 20);
    const nomeLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const comentLen = buf.readUInt16LE(p + 32);
    let offsetLocal = buf.readUInt32LE(p + 42);
    const nome = buf.toString("utf8", p + 46, p + 46 + nomeLen);
    // Campo extra ZIP64 substitui os valores sentinela.
    let q = p + 46 + nomeLen;
    const fimExtra = q + extraLen;
    while (q + 4 <= fimExtra) {
      const id = buf.readUInt16LE(q);
      const tam = buf.readUInt16LE(q + 2);
      if (id === 0x0001) {
        let r = q + 4;
        const uncomp = buf.readUInt32LE(p + 24);
        if (uncomp === 0xffffffff) r += 8;
        if (comprimido === 0xffffffff) { comprimido = Number(buf.readBigUInt64LE(r)); r += 8; }
        if (offsetLocal === 0xffffffff) offsetLocal = Number(buf.readBigUInt64LE(r));
      }
      q += 4 + tam;
    }
    entradas.set(nome, { comprimido, offsetLocal });
    p += 46 + nomeLen + extraLen + comentLen;
  }
  return entradas;
}

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

async function main() {
  const local = process.argv[2];
  let zip;
  if (local) {
    zip = readFileSync(local);
  } else {
    log(`baixando ${URL}…`);
    const resposta = await fetch(URL, { signal: AbortSignal.timeout(1_800_000), headers: { "User-Agent": "Mozilla/5.0" } });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    zip = Buffer.from(await resposta.arrayBuffer());
  }

  const entradas = entradasZip(zip);
  // 2024+ divide em PARTICIPANTES/RESULTADOS; RESULTADOS tem município de
  // prova E presenças. Anos anteriores usavam um CSV único.
  const nomeCsv =
    [...entradas.keys()].find((n) => /RESULTADOS_\d{4}\.csv$/i.test(n)) ??
    [...entradas.keys()].find((n) => /MICRODADOS_ENEM_\d{4}\.csv$/i.test(n));
  if (!nomeCsv) throw new Error(`CSV principal não encontrado; entradas: ${[...entradas.keys()].slice(0, 8).join(", ")}`);

  const porMunicipio = new Map();
  const porUf = new Map();
  let colunas = null;
  let linhas = 0;

  await porLinhaCsv(zip, entradas.get(nomeCsv), (linha) => {
    const campos = linha.split(";");
    if (!colunas) {
      colunas = new Map(campos.map((c, i) => [c.replace(/"/g, ""), i]));
      for (const nome of ["CO_MUNICIPIO_PROVA", "SG_UF_PROVA", "TP_PRESENCA_CN", "TP_PRESENCA_CH", "TP_PRESENCA_LC", "TP_PRESENCA_MT"]) {
        if (!colunas.has(nome)) throw new Error(`coluna ${nome} ausente — o layout do ENEM mudou.`);
      }
      return;
    }
    linhas += 1;
    const em = (nome) => campos[colunas.get(nome)]?.replace(/"/g, "") ?? "";
    const codigo = em("CO_MUNICIPIO_PROVA");
    if (!/^\d{7}$/.test(codigo)) return;

    // Ausente nos dois dias = abstenção total. Presença (ou eliminação) em
    // qualquer prova conta como compareceu.
    const presencas = [em("TP_PRESENCA_CN"), em("TP_PRESENCA_CH"), em("TP_PRESENCA_LC"), em("TP_PRESENCA_MT")];
    const faltouTudo = presencas.every((p) => p === "0");

    let m = porMunicipio.get(codigo);
    if (!m) {
      m = { inscritos: 0, ausentes: 0 };
      porMunicipio.set(codigo, m);
    }
    m.inscritos += 1;
    if (faltouTudo) m.ausentes += 1;

    const uf = em("SG_UF_PROVA");
    if (uf) {
      let u = porUf.get(uf);
      if (!u) {
        u = { inscritos: 0, ausentes: 0 };
        porUf.set(uf, u);
      }
      u.inscritos += 1;
      if (faltouTudo) u.ausentes += 1;
    }
  });

  if (porMunicipio.size < 1000) {
    throw new Error(`só ${porMunicipio.size} municípios de prova — o layout do ENEM mudou.`);
  }
  log(`${linhas.toLocaleString("pt-BR")} inscrições em ${porMunicipio.size.toLocaleString("pt-BR")} municípios de prova`);

  const municipios = {};
  for (const [codigo, m] of porMunicipio) {
    municipios[codigo] = {
      inscritos: m.inscritos,
      ausentes: m.ausentes,
      pctAbstencao: Math.round((m.ausentes / m.inscritos) * 1000) / 10,
    };
  }
  const ufs = {};
  for (const [uf, u] of porUf) {
    ufs[uf] = { inscritos: u.inscritos, pctAbstencao: Math.round((u.ausentes / u.inscritos) * 1000) / 10 };
  }

  const conteudo = {
    _comentario:
      "Gerado por scripts/dados/gerar-enem-abstencao.mjs. Não editar à mão. Regerar com: npm run dados:enem",
    fonte: `INEP — microdados do ENEM ${ANO}, por município de PROVA (residência não é publicada pós-LGPD)`,
    ano: ANO,
    legenda: "abstenção = ausente nos dois dias (todas as provas objetivas)",
    geradoEm: new Date().toISOString(),
    ufs,
    municipios,
  };

  mkdirSync(dirname(DESTINO), { recursive: true });
  const json = JSON.stringify(conteudo);
  writeFileSync(DESTINO, json, "utf8");
  log(`escrito ${DESTINO} — ${(json.length / 1024).toFixed(0)} KB, ${porMunicipio.size.toLocaleString("pt-BR")} municípios`);
}

main().catch((erro) => {
  console.error(`[enem] falhou: ${erro.message}`);
  process.exit(1);
});
