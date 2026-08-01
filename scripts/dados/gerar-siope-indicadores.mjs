#!/usr/bin/env node
/**
 * Gera `data/fnde/siope-indicadores.json` — as vinculações constitucionais e
 * legais da educação, por município, como o próprio SIOPE as apura.
 *
 * ## Por que este dataset existe
 *
 * Os relatórios cobriam 25% de MDE e 70% de remuneração por estimativa, e não
 * cobriam nada das outras quatro vinculações: 15% em despesas de capital da
 * complementação VAAT (art. 27), o percentual da educação infantil (art. 28 e
 * o IEI), o teto de 10% de recursos não aplicados no exercício (art. 25, §3º)
 * e o piso de 20% de destinação de impostos ao fundo.
 *
 * Todas as quatro entram no extrato do CAUC desde 2025 (IN STN/MF nº 8/2025,
 * art. 12, XIX a XXII). Descumpri-las não bloqueia o FUNDEB — o repasse é
 * automático (art. 21) — mas trava convênios e vicia a prestação de contas no
 * tribunal. É a diferença entre "o município recebe" e "o município consegue
 * usar e aprovar as contas".
 *
 * ## Por que o SIOPE, e por que esta rota
 *
 * O SIOPE é o único lugar em que esses percentuais existem já apurados por
 * município. A consulta pela web (`consultarRemuneracaoMunicipal.do` e
 * congêneres) está atrás de reCAPTCHA v2 e é inviável de raspar.
 *
 * A rota usada aqui é outra: a **API OData de dados abertos** do FNDE, sem
 * autenticação e sem captcha, uma chamada por UF. Ela também expõe o indicador
 * 3.2 (despesa de pessoal da área educacional), que não existe no Siconfi —
 * a DCA publica função sem natureza e natureza sem função, nunca cruzadas.
 *
 * ## Uso
 *
 *     npm run dados:siope
 *
 * O SIOPE é alimentado bimestralmente pelos municípios; o 6º período é o
 * fechamento do exercício. Regerar após o encerramento do ano anterior.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const BASE = "https://www.fnde.gov.br/olinda-ide/servico/DADOS_ABERTOS_SIOPE/versao/v1/odata";

/** Exercício de referência e o período de fechamento. */
const ANO = 2025;
const PERIODO = 6;
/** Municípios que não declararam em `ANO` entram com o exercício anterior. */
const ANO_ANTERIOR = 2024;

const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT",
  "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

const DESTINO = join(process.cwd(), "data", "fnde", "siope-indicadores.json");

/**
 * Indicadores mantidos, com o parâmetro legal de cada um. `sentido` diz se o
 * valor é piso (`min`) ou teto (`max`) — sem isso não dá para dizer se 8% é
 * bom ou ruim, porque depende do indicador.
 */
const INDICADORES = [
  { cod: "1.1", unidade: "percentual", chave: "mde", rotulo: "Aplicação em MDE", limite: 25, sentido: "min", base: "CF art. 212" },
  { cod: "1.2", unidade: "percentual", chave: "remuneracao", rotulo: "FUNDEB em remuneração dos profissionais", limite: 70, sentido: "min", base: "Lei 14.113/2020, art. 26" },
  { cod: "1.3", unidade: "percentual", chave: "fundebOutrasMde", rotulo: "FUNDEB em MDE que não remuneração", limite: null, sentido: null, base: "Lei 14.113/2020, art. 25" },
  { cod: "1.4", unidade: "percentual", chave: "naoAplicado", rotulo: "Recursos do FUNDEB não aplicados no exercício", limite: 10, sentido: "max", base: "Lei 14.113/2020, art. 25, §3º" },
  { cod: "1.5", unidade: "percentual", chave: "capitalVaat", rotulo: "Complementação VAAT em despesas de capital", limite: 15, sentido: "min", base: "Lei 14.113/2020, art. 27" },
  { cod: "1.6", unidade: "percentual", chave: "infantilVaat", rotulo: "Complementação VAAT em educação infantil", limite: null, sentido: "min", base: "Lei 14.113/2020, art. 28" },
  { cod: "1.7", unidade: "percentual", chave: "iei", rotulo: "IEI — mínimo do VAAT para educação infantil", limite: null, sentido: null, base: "Lei 14.113/2020, art. 16, VII" },
  // Indicador **estadual**, mantido na lista só para não deslocar as posições
  // — que são a chave dos valores de cada município no arquivo gerado.
  // A API o devolve com `TIPO: "Estadual"` e `COD_MUNI: null`, e o nome que o
  // próprio FNDE dá diz "mínimo de 20% para estados e DF". Entrou aqui como se
  // fosse vinculação municipal e ficou presente em 0 dos 5.564 municípios.
  { cod: "1.8", unidade: "percentual", chave: "destinacaoFundeb", rotulo: "Destinação de impostos ao FUNDEB", limite: 20, sentido: "min", base: "CF art. 212-A, II", escopo: "estadual" },
  { cod: "2.1", unidade: "percentual", chave: "fundebInfantil", rotulo: "FUNDEB aplicado na educação infantil", limite: null, sentido: null, base: null },
  { cod: "2.2", unidade: "percentual", chave: "fundebFundamental", rotulo: "FUNDEB aplicado no ensino fundamental", limite: null, sentido: null, base: null },
  { cod: "3.2", unidade: "percentual", chave: "pessoalEducacao", rotulo: "Pessoal e encargos da educação sobre a despesa em MDE", limite: null, sentido: null, base: null },
  { cod: "4.8", unidade: "reais", chave: "investimentoPorAluno", rotulo: "Investimento por aluno da educação básica", limite: null, sentido: null, base: null },
  { cod: "4.10", unidade: "reais", chave: "professorPorAluno", rotulo: "Despesa com professores por aluno", limite: null, sentido: null, base: null },
  { cod: "7.3", unidade: "reais", chave: "saldoNaoUtilizado", rotulo: "Recursos do FUNDEB não utilizados", limite: null, sentido: null, base: null },
];

const POR_CODIGO = new Map(INDICADORES.map((i, ordem) => [i.cod, { ...i, ordem }]));

function log(mensagem) {
  console.log(`[siope] ${mensagem}`);
}

async function consultarUf(uf, ano) {
  const url =
    `${BASE}/Indicadores_Siope(Ano_Consulta=@a,Num_Peri=@p,Sig_UF=@u)` +
    `?@a=${ano}&@p=${PERIODO}&@u='${uf}'&$format=json`;

  const resposta = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Sync/1.0" },
    signal: AbortSignal.timeout(300_000),
  });

  if (!resposta.ok) throw new Error(`SIOPE respondeu HTTP ${resposta.status} para ${uf}/${ano}`);

  const corpo = await resposta.json();
  return corpo.value ?? [];
}

/**
 * `VAL_INDI` chega como string ("65.53") e às vezes vazia. Ponto decimal, não
 * vírgula — é o inverso do resto das fontes do FNDE.
 */
function valor(bruto) {
  if (bruto === null || bruto === undefined || bruto === "") return null;
  const numero = Number.parseFloat(String(bruto));
  return Number.isFinite(numero) ? Math.round(numero * 100) / 100 : null;
}

function indexar(registros, destino, ano) {
  let aproveitados = 0;

  for (const registro of registros) {
    // Sem COD_MUNI a linha é da rede estadual.
    if (!registro.COD_MUNI) continue;

    const indicador = POR_CODIGO.get(registro.COD_EXIB);
    if (!indicador) continue;

    const valorIndicador = valor(registro.VAL_INDI);
    if (valorIndicador === null) continue;

    // COD_MUNI vem com 6 dígitos (sem o verificador do IBGE). O resto do
    // projeto indexa por 7 — a conversão acontece na leitura, não aqui, para
    // que o dataset preserve o identificador da fonte.
    const codigo = String(registro.COD_MUNI);
    let ente = destino[codigo];
    if (!ente) {
      ente = { uf: registro.SIG_UF ?? "", nome: registro.NOM_MUNI ?? "", ano, v: {} };
      destino[codigo] = ente;
    }

    ente.v[indicador.ordem] = valorIndicador;
    aproveitados += 1;
  }

  return aproveitados;
}

async function main() {
  const municipios = {};
  let totalLinhas = 0;

  for (const uf of UFS) {
    const registros = await consultarUf(uf, ANO);
    const aproveitados = indexar(registros, municipios, ANO);
    totalLinhas += aproveitados;
    log(`${uf}: ${registros.length} registros, ${aproveitados} indicadores mantidos`);
  }

  const apos2025 = Object.keys(municipios).length;
  log(`${apos2025.toLocaleString("pt-BR")} municípios com declaração em ${ANO}`);

  // Quem não declarou no exercício de referência entra com o anterior, marcado
  // pelo próprio campo `ano` — um dado de 2024 é melhor que lacuna, desde que
  // o relatório diga de que ano ele é.
  for (const uf of UFS) {
    const registros = await consultarUf(uf, ANO_ANTERIOR);
    const pendentes = {};
    indexar(registros, pendentes, ANO_ANTERIOR);
    for (const [codigo, dados] of Object.entries(pendentes)) {
      if (!municipios[codigo]) municipios[codigo] = dados;
    }
  }

  const total = Object.keys(municipios).length;
  if (total === 0) throw new Error("Nenhum município indexado — o formato da API mudou.");

  const conteudo = {
    _comentario:
      "Gerado por scripts/dados/gerar-siope-indicadores.mjs. Não editar à mão. Regerar com: npm run dados:siope",
    fonte: "FNDE — SIOPE, API OData de dados abertos (Indicadores_Siope)",
    anoReferencia: ANO,
    periodo: PERIODO,
    geradoEm: new Date().toISOString(),
    /** Metadados por posição; cada município guarda os valores pelo índice. */
    indicadores: INDICADORES.map(({ cod, unidade, chave, rotulo, limite, sentido, base }) => ({
      cod,
      unidade,
      chave,
      rotulo,
      limite,
      sentido,
      base,
    })),
    municipios,
  };

  mkdirSync(dirname(DESTINO), { recursive: true });
  const json = JSON.stringify(conteudo);
  writeFileSync(DESTINO, json, "utf8");

  log(
    `escrito ${DESTINO} — ${(json.length / 1024 / 1024).toFixed(2)} MB, ` +
      `${total.toLocaleString("pt-BR")} municípios (${apos2025.toLocaleString("pt-BR")} em ${ANO}, ` +
      `${(total - apos2025).toLocaleString("pt-BR")} só em ${ANO_ANTERIOR}), ` +
      `${totalLinhas.toLocaleString("pt-BR")} indicadores`,
  );
}

main().catch((erro) => {
  console.error(`[siope] falhou: ${erro.message}`);
  process.exit(1);
});
