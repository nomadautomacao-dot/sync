#!/usr/bin/env node
/**
 * Gera `data/portal-transparencia/emendas-municipios.json` — emendas
 * parlamentares agregadas por município e ano, com recorte de educação
 * (função 12), a partir do download de dados aberto do Portal da
 * Transparência (arquivo único, todos os anos, sem chave nem captcha).
 *
 * ## Por que este dataset existe (roadmap #28)
 *
 * A API `/api-de-dados/emendas` não filtra por localidade — só o arquivo
 * bulk traz o Código Município IBGE por linha. Agregar offline evita
 * paginar milhares de páginas a cada relatório.
 *
 * O valor por autor responde à pergunta de campo clássica: *quem manda
 * dinheiro para cá?* — o parlamentar que emenda educação no município é
 * interlocutor natural de qualquer projeto de rede.
 *
 * ## Por que os autores não são só os de educação
 *
 * A primeira versão guardava apenas os três maiores autores de emenda de
 * **educação**, e isso deixava a página vazia em 86% dos municípios do
 * dataset: só 353 de 2.576 têm emenda de educação carimbada. Mas quem manda
 * dinheiro para saúde ou infraestrutura é o mesmo interlocutor — e o fato de a
 * emenda dele nunca ter ido para educação é, ele próprio, o argumento da
 * conversa. Agora entram todos os autores, com o recorte de educação como
 * coluna, mais a repartição por função e por tipo de emenda.
 *
 * ## Uso
 *
 *     npm run dados:emendas                      # baixa o ZIP (~32MB)
 *     node scripts/dados/gerar-emendas-municipios.mjs <EmendasUnico.zip>
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInflateRaw } from "node:zlib";
import { StringDecoder } from "node:string_decoder";

const URL = "https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares/UNICO";
const DESTINO = join(process.cwd(), "data", "portal-transparencia", "emendas-municipios.json");
/** Emendas de 2014 em diante existem no arquivo; antes disso o rastreio por
 *  município é irregular. Sete anos bastam para a leitura de tendência. */
const ANO_MINIMO = 2020;
const FUNCAO_EDUCACAO = "12";
/** Autores guardados por município. O que passar disso vira a linha "demais". */
const MAX_AUTORES = 25;

function log(mensagem) {
  console.log(`[emendas-municipios] ${mensagem}`);
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
    // O Portal da Transparência publica em latin1.
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

/** Campos vêm todos entre aspas: `"a";"b"`. Nenhum contém `";"` interno. */
function separarCampos(linha) {
  return linha.split(";").map((campo) => campo.replace(/^"|"$/g, ""));
}

/** "1.000,00" ou "400000,00" → número em reais. */
function valorReais(texto) {
  if (!texto) return 0;
  const n = Number(texto.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

async function main() {
  const local = process.argv[2];
  let zip;
  if (local) {
    zip = readFileSync(local);
  } else {
    log(`baixando ${URL}…`);
    const resposta = await fetch(URL, {
      signal: AbortSignal.timeout(600_000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    zip = Buffer.from(await resposta.arrayBuffer());
  }

  const entradas = entradasZip(zip);
  const nomeCsv = [...entradas.keys()].find((n) => /^EmendasParlamentares\.csv$/.test(n));
  if (!nomeCsv) throw new Error("EmendasParlamentares.csv não encontrado no ZIP");

  const municipios = new Map();
  const anosVistos = new Set();
  let colunas = null;
  let linhas = 0;
  let semMunicipio = 0;

  await porLinhaCsv(zip, entradas.get(nomeCsv), (linha) => {
    const campos = separarCampos(linha);
    if (!colunas) {
      colunas = new Map(campos.map((c, i) => [c, i]));
      return;
    }
    linhas += 1;
    const ano = Number(campos[colunas.get("Ano da Emenda")]);
    if (!Number.isFinite(ano) || ano < ANO_MINIMO) return;
    const codigo = campos[colunas.get("Código Município IBGE")];
    // Emendas de gasto nacional/estadual não têm município (S/I) — ficam
    // fora de propósito: o dataset responde pelo dinheiro carimbado no
    // território, não pelo rateio impossível do gasto difuso.
    if (!/^\d{7}$/.test(codigo)) {
      semMunicipio += 1;
      return;
    }
    anosVistos.add(ano);
    const empenhado = valorReais(campos[colunas.get("Valor Empenhado")]);
    const pago = valorReais(campos[colunas.get("Valor Pago")]);
    const educacao = campos[colunas.get("Código Função")] === FUNCAO_EDUCACAO;
    const autor = campos[colunas.get("Nome do Autor da Emenda")];
    const funcao = campos[colunas.get("Nome Função")];
    const subfuncao = campos[colunas.get("Nome Subfunção")];
    const tipo = campos[colunas.get("Tipo de Emenda")];

    let registro = municipios.get(codigo);
    if (!registro) {
      registro = {
        anos: {},
        autoresEducacao: new Map(),
        autores: new Map(),
        funcoes: new Map(),
        tipos: new Map(),
        subfuncoesEducacao: new Map(),
      };
      municipios.set(codigo, registro);
    }
    // [qtd, empenhado, pago, qtdEducacao, empenhadoEducacao, pagoEducacao]
    const serie = (registro.anos[ano] ??= [0, 0, 0, 0, 0, 0]);
    serie[0] += 1;
    serie[1] += empenhado;
    serie[2] += pago;

    // [qtd, empenhado, pago, empenhadoEducacao] — acumuladores genéricos.
    const acumular = (mapa, chave) => {
      if (!chave || chave === "Sem informação") return;
      const linha = mapa.get(chave) ?? [0, 0, 0, 0];
      linha[0] += 1;
      linha[1] += empenhado;
      linha[2] += pago;
      if (educacao) linha[3] += empenhado;
      mapa.set(chave, linha);
    };

    acumular(registro.autores, autor);
    acumular(registro.funcoes, funcao);
    acumular(registro.tipos, tipo);

    if (educacao) {
      serie[3] += 1;
      serie[4] += empenhado;
      serie[5] += pago;
      acumular(registro.subfuncoesEducacao, subfuncao);
      if (autor && autor !== "Sem informação") {
        registro.autoresEducacao.set(autor, (registro.autoresEducacao.get(autor) ?? 0) + empenhado);
      }
    }
  });

  const cent = (v) => Math.round(v * 100) / 100;
  /** Mapa de acumuladores → array ordenado por empenhado, com arredondamento. */
  const ranquear = (mapa) =>
    [...mapa.entries()]
      .sort((a, b) => b[1][1] - a[1][1])
      .map(([nome, linha]) => [nome, linha[0], cent(linha[1]), cent(linha[2]), cent(linha[3])]);

  const saida = {};
  for (const [codigo, registro] of municipios) {
    const anos = {};
    for (const [ano, serie] of Object.entries(registro.anos)) {
      anos[ano] = serie.map(cent);
    }
    const autoresEducacao = [...registro.autoresEducacao.entries()]
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([nome, v]) => [nome, cent(v)]);

    const todosAutores = ranquear(registro.autores);
    const autores = todosAutores.slice(0, MAX_AUTORES);
    // O que não coube não some: vira uma linha com quantos e quanto, para a
    // regra 6 dos dossiês (truncamento é declarado, nunca silencioso).
    const cauda = todosAutores.slice(MAX_AUTORES);

    saida[codigo] = { anos, autores, funcoes: ranquear(registro.funcoes), tipos: ranquear(registro.tipos) };
    if (autoresEducacao.length) saida[codigo].autoresEducacao = autoresEducacao;
    if (registro.subfuncoesEducacao.size) {
      saida[codigo].subfuncoesEducacao = ranquear(registro.subfuncoesEducacao);
    }
    if (cauda.length) {
      saida[codigo].autoresDemais = [
        cauda.length,
        cent(cauda.reduce((t, a) => t + a[2], 0)),
        cent(cauda.reduce((t, a) => t + a[4], 0)),
      ];
    }
  }

  mkdirSync(dirname(DESTINO), { recursive: true });
  writeFileSync(
    DESTINO,
    JSON.stringify({
      geradoEm: new Date().toISOString().slice(0, 10),
      fonte:
        "Portal da Transparência — download de dados, Emendas Parlamentares (arquivo único). Valores em reais nominais, por ano de empenho.",
      anoMinimo: ANO_MINIMO,
      anos: [...anosVistos].sort(),
      municipios: saida,
    }),
  );
  log(
    `${linhas.toLocaleString("pt-BR")} linhas lidas · ${municipios.size.toLocaleString("pt-BR")} municípios · ${semMunicipio.toLocaleString("pt-BR")} linhas sem município (gasto difuso) · gravado em ${DESTINO}`,
  );
}

main().catch((erro) => {
  console.error(`[emendas-municipios] Falha: ${erro.message}`);
  process.exit(1);
});
