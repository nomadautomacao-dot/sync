#!/usr/bin/env node
/**
 * Gera `data/datasus/cobertura-vacinal.json` — cobertura vacinal infantil por
 * município, do TabNet do PNI/DATASUS.
 *
 * ## Por que entra num relatório de FUNDEB
 *
 * Cobertura vacinal não é indicador de educação, mas é o melhor **termômetro
 * público de capilaridade da atenção primária no território** — e a atenção
 * primária é quem executa o Programa Saúde na Escola. Onde a poliomielite não
 * chega a 95%, o PSE dificilmente chega à escola. É o mesmo denominador da
 * página de estado nutricional (SISVAN), e por isso as duas leituras moram
 * juntas.
 *
 * A tríplice viral tem uma segunda leitura, específica de escola: sarampo
 * volta a circular em rede com cobertura baixa, e é a escola que fecha.
 *
 * ## O que a fonte sustenta, e o que não
 *
 * **A série pública para por 2022.** O TabNet "Imunizações — desde 1994" só
 * oferece exercícios até 2022, e o próprio DATASUS mantém aviso de que as
 * coberturas estão "em fase de revisão". Os dados de 2023 em diante vivem no
 * SI-PNI novo, cuja via pública não respondeu no reconhecimento de 2026-07-30.
 * O leitor imprime o ano em voz alta; o relatório não finge atualidade.
 *
 * **Cobertura acima de 100% é comum e não é erro de captura.** O numerador são
 * doses aplicadas e o denominador é população estimada: criança vacinada em
 * município vizinho, estimativa populacional defasada e dose registrada fora
 * de domicílio empurram o índice acima de 100. Por isso o leitor guarda o
 * valor cru e a página trata >100% como "sem leitura de déficit", não como
 * excelência.
 *
 * ## A rota
 *
 * `dhdat.exe?bd_pni/cpnibr.def` renderiza o formulário; o POST vai para
 * `webtabx.exe?bd_pni/cpnibr.def`. O resultado **não é CSV nem HTML de
 * tabela**: é um `google.visualization.DataTable` embutido em JavaScript, e as
 * linhas saem de `data.addRows([...])`. Uma requisição por vacina e ano
 * devolve os ~5.570 municípios de uma vez.
 *
 * ## Uso
 *
 *     npm run dados:vacinacao
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const FORM = "http://tabnet.datasus.gov.br/cgi/dhdat.exe?bd_pni/cpnibr.def";
const CONSULTA = "http://tabnet.datasus.gov.br/cgi/webtabx.exe?bd_pni/cpnibr.def";
const DESTINO = join(process.cwd(), "data", "datasus", "cobertura-vacinal.json");

/**
 * As vacinas que dizem alguma coisa sobre a criança em idade escolar. Pólio e
 * tríplice viral são as duas que a escola sente; penta e meningococo medem se
 * a rota do primeiro ano de vida está inteira.
 */
const VACINAS = [
  { chave: "poliomielite", rotulo: "Poliomielite", prefixo: "Poliomielite|" },
  { chave: "tripliceViralD1", rotulo: "Tríplice viral (1ª dose)", prefixo: "Tríplice Viral  D1|" },
  { chave: "tripliceViralD2", rotulo: "Tríplice viral (2ª dose)", prefixo: "Tríplice Viral  D2|" },
  { chave: "penta", rotulo: "Pentavalente", prefixo: "Penta|" },
  { chave: "meningococoC", rotulo: "Meningococo C", prefixo: "Meningococo C|" },
  { chave: "bcg", rotulo: "BCG", prefixo: "BCG|" },
];

/** Últimos exercícios publicados. A série pública para em 2022. */
const ANOS = [2018, 2019, 2020, 2021, 2022];

function log(mensagem) {
  console.log(`[vacinacao] ${mensagem}`);
}

async function baixarTexto(url, corpo) {
  const resposta = await fetch(url, {
    method: corpo ? "POST" : "GET",
    headers: {
      "User-Agent": "Mozilla/5.0",
      ...(corpo ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: corpo,
    signal: AbortSignal.timeout(300_000),
  });
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status} em ${url}`);
  // O TabNet responde em latin-1; decodificar como utf-8 quebra os acentos das
  // opções, e as opções são a chave do POST seguinte.
  return new TextDecoder("iso-8859-1").decode(await resposta.arrayBuffer());
}

/** Extrai as opções de um `<select>` preservando o valor cru. */
function opcoes(html, nome) {
  const abre = new RegExp(`<select[^>]*name=["']?${nome}["']?[^>]*>`, "i").exec(html);
  if (!abre) return [];
  const fim = html.toLowerCase().indexOf("</select>", abre.index + abre[0].length);
  const trecho = html.slice(abre.index + abre[0].length, fim);
  return [...trecho.matchAll(/<option[^>]*value="([^"]*)"/gi)].map((m) => m[1]);
}

/**
 * O TabnetBD devolve as linhas dentro de `data.addRows([...])`, cada uma como
 * `["110001 ALTA FLORESTA D\'OESTE", {v: 101.5, f: '101,50'}, ...]`.
 */
function linhasDoDataTable(html) {
  const bloco = /data\.addRows\(\[([\s\S]*?)\]\);/.exec(html);
  if (!bloco) return [];
  const linhas = [];
  for (const m of bloco[1].matchAll(/\["((?:[^"\\]|\\.)*)"\s*,\s*\{v:\s*([-\d.]+)/g)) {
    const rotulo = m[1].replace(/\\'/g, "'").trim();
    const codigo = /^(\d{6})\s/.exec(rotulo)?.[1];
    const valor = Number(m[2]);
    if (!codigo || !Number.isFinite(valor)) continue;
    linhas.push({ codigo, valor: Math.round(valor * 10) / 10 });
  }
  return linhas;
}

async function main() {
  const formulario = await baixarTexto(FORM);
  const linhaMunicipio = opcoes(formulario, "Linha").find((v) => v.startsWith("Município|"));
  const colunaAno = opcoes(formulario, "Coluna").find((v) => v.startsWith("Ano|"));
  const incrementos = opcoes(formulario, "Incremento");
  const anosDisponiveis = opcoes(formulario, "PAno");
  if (!linhaMunicipio || !colunaAno) throw new Error("o formulário do PNI mudou: Linha/Coluna não encontradas.");

  const municipios = {};
  const cobertos = [];

  for (const vacina of VACINAS) {
    const incremento = incrementos.find((v) => v.startsWith(vacina.prefixo));
    if (!incremento) {
      log(`AVISO: vacina "${vacina.rotulo}" saiu do formulário — pulando`);
      continue;
    }
    for (const ano of ANOS) {
      const pAno = anosDisponiveis.find((v) => v.startsWith(`${ano}|`));
      if (!pAno) {
        log(`AVISO: ${ano} não está mais publicado — pulando`);
        continue;
      }
      const corpo = new URLSearchParams();
      corpo.set("Linha", linhaMunicipio);
      corpo.set("Coluna", colunaAno);
      corpo.set("Incremento", incremento);
      corpo.set("PAno", pAno);
      corpo.set("formato", "table");
      corpo.set("mostre", "Mostra");

      const html = await baixarTexto(CONSULTA, corpo.toString());
      const linhas = linhasDoDataTable(html);
      for (const { codigo, valor } of linhas) {
        ((municipios[codigo] ??= {})[vacina.chave] ??= {})[ano] = valor;
      }
      log(`${vacina.rotulo} ${ano}: ${linhas.length.toLocaleString("pt-BR")} municípios`);
      if (linhas.length > 0) cobertos.push(`${vacina.chave}:${ano}`);
    }
  }

  if (Object.keys(municipios).length < 4_000) {
    throw new Error(`só ${Object.keys(municipios).length} municípios — a consulta do PNI mudou.`);
  }

  const conteudo = {
    _comentario:
      "Gerado por scripts/dados/gerar-cobertura-vacinal.mjs. Não editar à mão. Regerar com: npm run dados:vacinacao",
    fonte: "Ministério da Saúde — PNI/DATASUS, TabNet 'Imunizações desde 1994' (cobertura vacinal)",
    ressalva:
      "Cobertura = doses aplicadas ÷ população estimada. Valores acima de 100% são comuns e não indicam erro: dose aplicada em não residente e estimativa populacional defasada inflam o índice. O DATASUS mantém aviso de revisão sobre a série.",
    anos: ANOS,
    ultimoAno: Math.max(...ANOS),
    vacinas: VACINAS.map(({ chave, rotulo }) => ({ chave, rotulo })),
    geradoEm: new Date().toISOString(),
    /** Indexado pelo código IBGE de 6 dígitos, como a fonte publica. */
    municipios,
  };

  mkdirSync(dirname(DESTINO), { recursive: true });
  const json = JSON.stringify(conteudo);
  writeFileSync(DESTINO, json, "utf8");
  log(
    `escrito ${DESTINO} — ${(json.length / 1024).toFixed(0)} KB, ` +
      `${Object.keys(municipios).length.toLocaleString("pt-BR")} municípios, ${cobertos.length} séries`,
  );
}

main().catch((erro) => {
  console.error(`[vacinacao] falhou: ${erro.message}`);
  process.exit(1);
});
