#!/usr/bin/env node
/**
 * Gera `data/datasus/violencia-infantil.json` — notificações de violência
 * contra crianças e adolescentes de 5 a 14 anos, por município, do SINAN.
 *
 * ## A regra de leitura, que vem antes do número
 *
 * **Isto é contagem de notificação, não de ocorrência.** Município que notifica
 * mais pode ter mais violência — ou vigilância melhor, conselho tutelar ativo e
 * escola que sabe notificar. Município com zero notificação quase nunca é
 * município sem violência: é município onde ninguém registra.
 *
 * A consequência para o relatório é dura e precisa ser respeitada em qualquer
 * página que use este dado: **o número não classifica o município**. Ele serve
 * para uma coisa só — dizer se a rede de proteção está funcionando o bastante
 * para que a escola apareça como notificante. A Lei nº 13.431/2017 e o ECA
 * (art. 245) obrigam o profissional de educação a notificar suspeita de
 * violência; zero notificação numa rede de dez mil alunos é, portanto, um
 * indício sobre o **fluxo**, não sobre as crianças.
 *
 * ## O recorte
 *
 * Faixas de 5 a 9 e de 10 a 14 anos — a idade do ensino fundamental, que é
 * exatamente a população que a rede municipal atende. Fica de fora 0–4 (creche
 * e pré-escola, onde a notificação passa mais pela saúde) e 15–19 (já em
 * grande parte fora da rede municipal).
 *
 * O corte é por **município de notificação**, não de residência: é onde o
 * serviço registrou. Para a leitura que interessa — a rede de proteção local
 * está registrando? — é o corte certo.
 *
 * ## A rota
 *
 * TabNet clássico: POST em `tabcgi.exe?sinannet/cnv/violebr.def`. Um
 * `Arquivos` por ano (`violebr25.dbf` = 2025), `Incremento=Freqüência` (com
 * trema, e o POST precisa ir em latin-1). A saída é HTML de tabela com `<TD>`
 * **sem tag de fechamento** — parser que exige `</TD>` volta vazio, que foi o
 * primeiro erro deste script.
 *
 * ## Uso
 *
 *     npm run dados:violencia-infantil
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const FORM = "http://tabnet.datasus.gov.br/cgi/tabcgi.exe?sinannet/cnv/violebr.def";
const DESTINO = join(process.cwd(), "data", "datasus", "violencia-infantil.json");

/** 5–9 e 10–14 anos, os códigos da faixa etária no .def do SINAN. */
const FAIXAS = ["4", "5"];
const ANOS = [2023, 2024, 2025];

function log(mensagem) {
  console.log(`[violencia-infantil] ${mensagem}`);
}

/**
 * O TabNet só entende latin-1: `Freqüência` enviado em utf-8 devolve tabela
 * vazia com HTTP 200.
 */
function corpoLatin1(pares) {
  return pares
    .map(([k, v]) => `${percentLatin1(k)}=${percentLatin1(v)}`)
    .join("&");
}

function percentLatin1(texto) {
  let saida = "";
  for (const char of String(texto)) {
    if (/[A-Za-z0-9_.~-]/.test(char)) {
      saida += char;
      continue;
    }
    if (char === " ") {
      saida += "+";
      continue;
    }
    const ponto = char.codePointAt(0);
    // Fora do latin-1 não há o que enviar; o TabNet não tem esses caracteres.
    saida += ponto <= 0xff ? `%${ponto.toString(16).toUpperCase().padStart(2, "0")}` : "%3F";
  }
  return saida;
}

async function consultar(corpo) {
  const resposta = await fetch(FORM, {
    method: corpo ? "POST" : "GET",
    headers: {
      "User-Agent": "Mozilla/5.0",
      ...(corpo ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: corpo,
    signal: AbortSignal.timeout(300_000),
  });
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
  return new TextDecoder("iso-8859-1").decode(await resposta.arrayBuffer());
}

/**
 * Linhas da tabela do TabNet. `<TD>` não fecha, então o corte é no próximo
 * `<TD` ou no fim da linha.
 */
function linhasTabela(html) {
  const inicio = html.indexOf('<TABLE CLASS="tabdados"');
  if (inicio < 0) return [];
  const corpo = html.slice(inicio, html.indexOf("</TABLE>", inicio));
  const linhas = [];
  for (const tr of corpo.split(/<TR/i).slice(1)) {
    const celulas = tr
      .split(/<TD[^>]*>/i)
      .slice(1)
      .map((c) => c.split(/<\/?T[DR]/i)[0].replace(/<[^>]*>/g, "").trim());
    if (celulas.length < 2) continue;
    const codigo = /^(\d{6})\s/.exec(celulas[0])?.[1];
    if (!codigo) continue;
    const valor = Number(celulas[1].replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(valor)) continue;
    linhas.push({ codigo, valor });
  }
  return linhas;
}

async function main() {
  const municipios = {};
  let series = 0;

  for (const ano of ANOS) {
    const arquivo = `violebr${String(ano).slice(2)}.dbf`;
    const pares = [
      ["Linha", "Município_de_notificação"],
      ["Coluna", "--Não-Ativa--"],
      ["Incremento", "Freqüência"],
      ["Arquivos", arquivo],
      ...FAIXAS.map((f) => ["SFaixa_Etária", f]),
      ["formato", "table"],
      ["mostre", "Mostra"],
    ];

    const html = await consultar(corpoLatin1(pares));
    const linhas = linhasTabela(html);
    if (linhas.length === 0) {
      log(`AVISO: ${ano} (${arquivo}) voltou sem linhas — arquivo ainda não publicado?`);
      continue;
    }
    for (const { codigo, valor } of linhas) {
      (municipios[codigo] ??= {})[ano] = valor;
    }
    series += 1;
    log(`${ano}: ${linhas.length.toLocaleString("pt-BR")} municípios com notificação`);
  }

  if (series === 0) throw new Error("nenhum exercício respondeu — a consulta do SINAN mudou.");
  if (Object.keys(municipios).length < 1_000) {
    throw new Error(`só ${Object.keys(municipios).length} municípios — a consulta do SINAN mudou.`);
  }

  const conteudo = {
    _comentario:
      "Gerado por scripts/dados/gerar-violencia-infantil.mjs. Não editar à mão. Regerar com: npm run dados:violencia-infantil",
    fonte:
      "Ministério da Saúde/SVSA — SINAN Net, violência interpessoal/autoprovocada, faixas de 5 a 14 anos, por município de notificação",
    ressalva:
      "Contagem de NOTIFICAÇÕES, não de ocorrências. Notificar mais pode significar vigilância melhor, não mais violência; ausência de notificação quase sempre significa ausência de registro, não ausência do problema. O número não classifica o município.",
    faixaEtaria: "5 a 14 anos",
    anos: ANOS,
    geradoEm: new Date().toISOString(),
    /** Indexado pelo código IBGE de 6 dígitos, como a fonte publica. */
    municipios,
  };

  mkdirSync(dirname(DESTINO), { recursive: true });
  const json = JSON.stringify(conteudo);
  writeFileSync(DESTINO, json, "utf8");
  log(
    `escrito ${DESTINO} — ${(json.length / 1024).toFixed(0)} KB, ` +
      `${Object.keys(municipios).length.toLocaleString("pt-BR")} municípios, ${series} exercícios`,
  );
}

main().catch((erro) => {
  console.error(`[violencia-infantil] falhou: ${erro.message}`);
  process.exit(1);
});
