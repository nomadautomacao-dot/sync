#!/usr/bin/env node
/**
 * Gera `data/inep/escolas-territorio.json` — cada escola municipal ativa com
 * coordenadas, localização (urbana/rural e diferenciada) e transporte
 * público, a partir dos microdados do Censo Escolar.
 *
 * ## Por que este dataset existe
 *
 * - **Mapa das escolas** (roadmap #2): LATITUDE/LONGITUDE por escola permite
 *   plotar a rede sobre o contorno do território na capa do Raio-X.
 * - **Territórios de rio** (#1, o exemplo de Manaus): a divulgação pós-LGPD
 *   removeu o tipo de veículo (embarcação) — o que a fonte sustenta hoje é
 *   `TP_LOCALIZACAO_DIFERENCIADA` (assentamento, terra indígena, quilombola,
 *   comunidade ribeirinha) e o total de alunos em transporte público por
 *   escola (`QT_TRANSP_PUBLICO`, tabela de matrícula agregada).
 *
 * Os códigos de TP_LOCALIZACAO_DIFERENCIADA seguem o dicionário do INEP e
 * são gravados crus; a interpretação fica no leitor.
 *
 * ## Uso
 *
 *     npm run dados:escolas-territorio          # baixa o ZIP do INEP (~80MB)
 *     node scripts/dados/gerar-escolas-territorio.mjs <microdados.zip>
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInflateRaw } from "node:zlib";
import { StringDecoder } from "node:string_decoder";

const ANO = 2025;
const URL = `https://download.inep.gov.br/microdados/microdados_censo_escolar_${ANO}.zip`;
const DESTINO = join(process.cwd(), "data", "inep", "escolas-territorio.json");

function log(mensagem) {
  console.log(`[escolas-territorio] ${mensagem}`);
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
    // Os microdados do INEP vêm em latin1.
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

function numero(texto) {
  if (texto === undefined || texto === "") return null;
  const n = Number(String(texto).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const local = process.argv[2];
  let zip;
  if (local) {
    zip = readFileSync(local);
  } else {
    log(`baixando ${URL}…`);
    const resposta = await fetch(URL, { signal: AbortSignal.timeout(900_000), headers: { "User-Agent": "Mozilla/5.0" } });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    zip = Buffer.from(await resposta.arrayBuffer());
  }

  const entradas = entradasZip(zip);
  const nomeEscola = [...entradas.keys()].find((n) => /Tabela_Escola_\d{4}\.csv$/.test(n));
  const nomeMatricula = [...entradas.keys()].find((n) => /Tabela_Matricula_\d{4}\.csv$/.test(n));
  if (!nomeEscola || !nomeMatricula) throw new Error("tabelas de escola/matrícula não encontradas no ZIP");

  // Passo 1 — transporte público e matrícula total por escola.
  const porEscola = new Map();
  let colunasMat = null;
  await porLinhaCsv(zip, entradas.get(nomeMatricula), (linha) => {
    const campos = linha.split(";");
    if (!colunasMat) {
      colunasMat = new Map(campos.map((c, i) => [c, i]));
      return;
    }
    const codigo = campos[colunasMat.get("CO_ENTIDADE")];
    if (!codigo) return;
    // Cor/raça por escola: [não declarada, branca, preta, parda, amarela,
    // indígena] — permite o recorte por zona e por escola que o agregado
    // municipal esconde.
    const racas = ["QT_MAT_BAS_ND", "QT_MAT_BAS_BRANCA", "QT_MAT_BAS_PRETA", "QT_MAT_BAS_PARDA", "QT_MAT_BAS_AMARELA", "QT_MAT_BAS_INDIGENA"].map(
      (nome) => numero(campos[colunasMat.get(nome)]) ?? 0,
    );
    porEscola.set(codigo, {
      matriculas: numero(campos[colunasMat.get("QT_MAT_BAS")]),
      transporte: numero(campos[colunasMat.get("QT_TRANSP_PUBLICO")]),
      racas: racas.some((v) => v > 0) ? racas : null,
    });
  });
  log(`matrícula: ${porEscola.size.toLocaleString("pt-BR")} escolas`);

  // Passo 2 — escolas municipais ativas com coordenadas e localização.
  const municipios = {};
  let colunas = null;
  let aproveitadas = 0;
  await porLinhaCsv(zip, entradas.get(nomeEscola), (linha) => {
    const campos = linha.split(";");
    if (!colunas) {
      colunas = new Map(campos.map((c, i) => [c, i]));
      for (const nome of ["CO_MUNICIPIO", "CO_ENTIDADE", "TP_DEPENDENCIA", "TP_SITUACAO_FUNCIONAMENTO", "TP_LOCALIZACAO", "TP_LOCALIZACAO_DIFERENCIADA", "LATITUDE", "LONGITUDE"]) {
        if (!colunas.has(nome)) throw new Error(`coluna ${nome} ausente — o layout do Censo mudou.`);
      }
      return;
    }
    const em = (nome) => campos[colunas.get(nome)];
    // 3 = municipal; 1 = em atividade.
    if (em("TP_DEPENDENCIA") !== "3" || em("TP_SITUACAO_FUNCIONAMENTO") !== "1") return;
    const codigoMunicipio = String(em("CO_MUNICIPIO") ?? "").trim();
    const codigoEscola = String(em("CO_ENTIDADE") ?? "").trim();
    if (!/^\d{7}$/.test(codigoMunicipio) || !codigoEscola) return;

    const lat = numero(em("LATITUDE"));
    const lng = numero(em("LONGITUDE"));
    const extra = porEscola.get(codigoEscola);
    const registro = {
      // 1 = urbana, 2 = rural.
      rural: em("TP_LOCALIZACAO") === "2" ? 1 : 0,
      // Cru do dicionário do INEP: 1 assentamento, 2 terra indígena,
      // 3 quilombola, 8 comunidade ribeirinha (0/vazio = não diferenciada).
      dif: numero(em("TP_LOCALIZACAO_DIFERENCIADA")) ?? 0,
    };
    if (lat !== null && lng !== null) {
      registro.lat = Math.round(lat * 1e5) / 1e5;
      registro.lng = Math.round(lng * 1e5) / 1e5;
    }
    if (extra?.matriculas !== null && extra?.matriculas !== undefined) registro.matriculas = extra.matriculas;
    if (extra?.transporte !== null && extra?.transporte !== undefined) registro.transporte = extra.transporte;
    if (extra?.racas) registro.racas = extra.racas;

    let municipio = municipios[codigoMunicipio];
    if (!municipio) {
      municipio = { escolas: {} };
      municipios[codigoMunicipio] = municipio;
    }
    municipio.escolas[codigoEscola] = registro;
    aproveitadas += 1;
  });

  if (aproveitadas < 50_000) {
    throw new Error(`só ${aproveitadas} escolas municipais — o layout do Censo mudou.`);
  }

  const conteudo = {
    _comentario:
      "Gerado por scripts/dados/gerar-escolas-territorio.mjs. Não editar à mão. Regerar com: npm run dados:escolas-territorio",
    fonte: `INEP — microdados do Censo Escolar ${ANO} (Tabela_Escola + Tabela_Matricula, rede municipal ativa)`,
    ano: ANO,
    legendaDif:
      "dif: 0 = não diferenciada, 1 = assentamento, 2 = terra indígena, 3 = quilombola, 8 = comunidade ribeirinha (dicionário INEP)",
    legendaRacas:
      "racas: [não declarada, branca, preta, parda, amarela, indígena] — matrículas da educação básica",
    geradoEm: new Date().toISOString(),
    municipios,
  };

  mkdirSync(dirname(DESTINO), { recursive: true });
  const json = JSON.stringify(conteudo);
  writeFileSync(DESTINO, json, "utf8");
  log(
    `escrito ${DESTINO} — ${(json.length / 1024 / 1024).toFixed(2)} MB, ` +
      `${Object.keys(municipios).length.toLocaleString("pt-BR")} municípios, ${aproveitadas.toLocaleString("pt-BR")} escolas`,
  );
}

main().catch((erro) => {
  console.error(`[escolas-territorio] falhou: ${erro.message}`);
  process.exit(1);
});
