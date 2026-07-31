#!/usr/bin/env node
/**
 * Gera `data/ibge/trabalho-infantil.json` — pessoas de 10 a 17 anos **ocupadas
 * na semana de referência**, por município, do Censo Demográfico 2022.
 *
 * ## Por que este dado entra num relatório de FUNDEB
 *
 * O elo não é financeiro, é de frequência. Criança que trabalha falta, chega
 * cansada, repete e sai — e cada uma dessas coisas o relatório já mede por
 * outra fonte (distorção idade-série, abandono, rendimento do INEP). O que
 * faltava era a medida do outro lado da equação: **quantas crianças e
 * adolescentes deste município a semana de referência encontrou ocupadas.**
 *
 * O recorte por faixa não é decorativo — é o que separa dois fatos jurídicos
 * distintos, e por isso as duas faixas nunca são somadas num número só:
 *
 * - **10 a 13 anos**: não existe hipótese legal de trabalho. A Constituição
 *   proíbe qualquer trabalho a menores de 16 anos, salvo na condição de
 *   aprendiz **a partir dos 14** (art. 7º, XXXIII). Abaixo de 14 não há sequer
 *   aprendizagem possível.
 * - **14 a 17 anos**: há trabalho lícito — aprendiz dos 14 aos 17, emprego
 *   regular a partir dos 16 — desde que não seja noturno, perigoso ou
 *   insalubre, e desde que não conste da Lista TIP (Decreto nº 6.481/2008).
 *   Ocupação nesta faixa **não é, por si, irregularidade**.
 *
 * ## A fonte, e o que a nota dela obriga a dizer
 *
 * SIDRA, tabela **10268** (`Pessoas de 10 anos ou mais de idade, total e
 * ocupadas na semana de referência…`), Censo Demográfico 2022. Duas variáveis
 * (140 = população da faixa, 696 = ocupadas na faixa) cruzadas com a
 * classificação 58 (grupo de idade), categorias 118282 (10 a 13) e 114535
 * (14 a 17). Nível N6 devolve os 5.570 municípios numa requisição só.
 *
 * **A armadilha que governa o módulo inteiro está na nota 1 da tabela:**
 *
 * > "Dados dos resultados preliminares da amostra, estimados a partir de áreas
 * > de ponderação preliminares."
 *
 * Ou seja: (a) não é contagem completa, é **estimativa expandida do
 * questionário da amostra**; (b) é **preliminar** — as áreas de ponderação
 * ainda podem mudar e o número municipal com elas. Num município pequeno, uma
 * estimativa de 21 crianças ocupadas carrega margem que a tabela não publica.
 * Por isso o leitor (`core/lib/trabalho-infantil.ts`) trata o valor como ordem
 * de grandeza para abrir conversa, nunca como contagem, e o dataset **não
 * produz ranking de municípios**.
 *
 * ## O que a fonte não traz — e que este script não tenta inventar
 *
 * - **Em que a criança trabalha.** O recorte por atividade não sai combinado
 *   com faixa etária no nível municipal.
 * - **Se a criança ocupada frequenta escola.** Esse cruzamento existe no SIDRA
 *   (tabela 3908, com N6), mas é do **Censo 2010** — dezesseis anos atrás. Não
 *   entra: número velho impresso ao lado de número novo vira número novo na
 *   leitura de quem recebe o relatório.
 * - **Trabalho para consumo do próprio domicílio.** O IBGE classifica quem
 *   produz para a própria alimentação como **não ocupado** e o conta em tabela
 *   separada (10269). Ele fica fora do 696 — o que faz do número um piso, não
 *   um teto, especialmente em município agrícola.
 *
 * ## Uso
 *
 *     npm run dados:trabalho-infantil
 *
 * O Censo é decenal e esta é a divulgação de 2022: não há o que regerar por
 * rotina. Regerar quando o IBGE publicar os resultados **definitivos** da
 * amostra — nesse dia a nota 1 muda e o texto do módulo tem de mudar junto.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const DESTINO = join(process.cwd(), "data", "ibge", "trabalho-infantil.json");
const TIMEOUT_MS = 300_000;

const TABELA = 10268;
const ANO = 2022;
/** 140 = pessoas da faixa; 696 = ocupadas na semana de referência. */
const VARIAVEIS = [140, 696];
/** Classificação 58 = grupo de idade. */
const FAIXAS = [
  { chave: "f1013", rotulo: "10 a 13 anos", categoria: 118282 },
  { chave: "f1417", rotulo: "14 a 17 anos", categoria: 114535 },
];
/** Sexo = Total, Cor ou raça = Total. */
const SEXO_TOTAL = 6794;
const COR_TOTAL = 95251;

function log(mensagem) {
  console.log(`[trabalho-infantil] ${mensagem}`);
}

function urlDoNivel(nivel) {
  const categorias = FAIXAS.map((f) => f.categoria).join(",");
  return (
    `https://servicodados.ibge.gov.br/api/v3/agregados/${TABELA}` +
    `/periodos/${ANO}/variaveis/${VARIAVEIS.join("|")}` +
    `?localidades=${nivel}` +
    `&classificacao=58[${categorias}]|2[${SEXO_TOTAL}]|86[${COR_TOTAL}]`
  );
}

async function buscar(nivel) {
  const url = urlDoNivel(nivel);
  log(`consultando ${nivel}`);
  const resposta = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!resposta.ok) {
    throw new Error(`SIDRA respondeu HTTP ${resposta.status} para ${nivel}`);
  }
  return resposta.json();
}

/**
 * Converte o valor do SIDRA, respeitando a convenção de sinais do IBGE.
 *
 * **O traço `-` é zero absoluto, não dado ausente.** Tratá-lo como ausente
 * descarta 1.716 dos 5.570 municípios — e descarta justamente aqueles onde a
 * resposta é "nenhuma criança ocupada nesta faixa", que é a notícia que a
 * página mais precisa poder dar. Na varredura de 2026-07-31 o `-` era o único
 * sentinela presente, e só na variável 696 (ocupadas); a população da faixa
 * (variável 140) nunca vem vazia.
 */
const inteiro = (valor) => {
  const bruto = String(valor ?? "").trim();
  if (bruto === "-") return 0;
  // Demais convenções do IBGE: ".." não se aplica, "..." indisponível,
  // "X" omitido para não identificar informante. Nenhuma apareceu nesta
  // tabela, mas se aparecer não pode virar zero.
  if (bruto === "" || bruto === ".." || bruto === "..." || bruto === "X") return null;
  const n = Number.parseInt(bruto, 10);
  return Number.isFinite(n) ? n : null;
};

/**
 * Reduz a resposta do SIDRA a `localidade → faixa → { populacao, ocupadas }`.
 *
 * A resposta é indexada por variável e depois por combinação de categorias, e
 * a faixa etária só aparece dentro de `classificacoes["58"].categoria`, como
 * chave do objeto. Casar pela **chave numérica** (e não pelo rótulo) evita
 * depender do texto, que o IBGE já reescreveu em outras tabelas.
 */
function reduzir(bruto) {
  const porFaixa = new Map(FAIXAS.map((f) => [String(f.categoria), f.chave]));
  const saida = new Map();

  for (const variavel of bruto) {
    const campo = Number(variavel.id) === 140 ? "populacao" : "ocupadas";
    for (const resultado of variavel.resultados) {
      const categoria = Object.keys(resultado.classificacoes.find((c) => String(c.id) === "58")?.categoria ?? {})[0];
      const faixa = porFaixa.get(String(categoria));
      if (!faixa) continue;

      for (const serie of resultado.series) {
        const id = String(serie.localidade.id);
        if (!saida.has(id)) saida.set(id, {});
        const registro = saida.get(id);
        registro[faixa] ??= { populacao: null, ocupadas: null };
        registro[faixa][campo] = inteiro(serie.serie[String(ANO)]);
      }
    }
  }

  return saida;
}

/** Formato compacto: `[populacao, ocupadas]` por faixa. 5.570 municípios. */
function compactar(registro) {
  const saida = {};
  for (const { chave } of FAIXAS) {
    const f = registro[chave];
    if (!f || f.populacao === null || f.ocupadas === null) continue;
    saida[chave] = [f.populacao, f.ocupadas];
  }
  return Object.keys(saida).length === FAIXAS.length ? saida : null;
}

async function main() {
  const [brutoPais, brutoUf, brutoMun] = await Promise.all([
    buscar("N1[all]"),
    buscar("N3[all]"),
    buscar("N6[all]"),
  ]);

  const pais = reduzir(brutoPais);
  const ufs = reduzir(brutoUf);
  const municipios = reduzir(brutoMun);

  const brasil = compactar(pais.get("1") ?? {});
  if (!brasil) throw new Error("O total do Brasil não veio — a tabela mudou de forma.");

  const porUf = {};
  for (const [id, registro] of ufs) {
    const compacto = compactar(registro);
    if (compacto) porUf[id] = compacto;
  }

  const porMunicipio = {};
  let descartados = 0;
  for (const [id, registro] of municipios) {
    if (!/^\d{7}$/.test(id)) continue;
    const compacto = compactar(registro);
    if (!compacto) {
      descartados += 1;
      continue;
    }
    porMunicipio[id] = compacto;
  }

  if (descartados > 0) {
    log(`${descartados} municípios sem uma das faixas completas (ignorados)`);
  }

  const saida = {
    _comentario:
      "Gerado por scripts/dados/gerar-trabalho-infantil.mjs. Não editar à mão. Regerar com: npm run dados:trabalho-infantil",
    fonte: `IBGE — Censo Demográfico ${ANO}, tabela ${TABELA} (SIDRA)`,
    // Impressa literal no relatório: é a nota 1 da própria tabela, e é ela que
    // impede o número de ser lido como contagem.
    ressalva:
      "Resultados preliminares da amostra, estimados a partir de áreas de ponderação preliminares (nota 1 da tabela 10268). " +
      "É estimativa expandida, não contagem — e pode mudar na divulgação definitiva.",
    anoCenso: ANO,
    tabela: TABELA,
    geradoEm: new Date().toISOString(),
    faixas: FAIXAS.map(({ chave, rotulo }) => ({ chave, rotulo })),
    brasil,
    ufs: porUf,
    municipios: porMunicipio,
  };

  mkdirSync(dirname(DESTINO), { recursive: true });
  const json = JSON.stringify(saida);
  writeFileSync(DESTINO, json, "utf8");
  log(
    `escrito ${DESTINO} — ${Object.keys(porMunicipio).length.toLocaleString("pt-BR")} municípios, ` +
      `${Object.keys(porUf).length} UFs, ${(json.length / 1024).toFixed(0)} KB`,
  );
}

main().catch((erro) => {
  console.error(`[trabalho-infantil] falhou: ${erro.message}`);
  process.exit(1);
});
