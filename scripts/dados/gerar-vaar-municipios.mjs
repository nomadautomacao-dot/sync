#!/usr/bin/env node
/**
 * Gera `data/fnde/vaar-2026.json` — o status de cada rede municipal perante a
 * complementação VAAR e, para as beneficiadas, quanto receberam.
 *
 * ## Por que este dataset existe
 *
 * O VAAR é o único dos três fluxos do FUNDEB que funciona como filtro binário:
 * reprovar em **uma** das cinco condicionalidades do art. 14, §1º da Lei
 * 14.113/2020 zera a parcela inteira. Em 2026 isso eliminou 2.520 das 5.594
 * redes avaliadas — e a mediana do que as habilitadas receberam é R$ 870 mil.
 *
 * Nossos relatórios diziam ao gestor quanto ele recebe de FUNDEB sem dizer se
 * ele está fora do VAAR nem por quê. O dado que responde isso é público e vem
 * pronto, município a município, com o motivo da reprovação em texto.
 *
 * ## As duas fontes, e por que precisamos das duas
 *
 * O FNDE publica o status e o valor em arquivos separados:
 *
 *   - **Lista de beneficiários** — as cinco condicionalidades, a habilitação, a
 *     evolução dos dois indicadores e a pendência. Cobre todas as redes,
 *     inclusive as reprovadas. Não tem valor.
 *   - **Anexo VI** — coeficiente de distribuição e complementação em R$. Só
 *     traz as 3.034 redes beneficiadas.
 *
 * Sem a primeira não se sabe *por que* um município ficou de fora; sem a
 * segunda não se sabe *quanto* vale estar dentro.
 *
 * ## Uso
 *
 *     npm run dados:vaar
 *
 * O FNDE republica as portarias do FUNDEB a cada quadrimestre. Ao virar o
 * exercício, atualize `EXERCICIO` e confira as URLs — o caminho embute o ano
 * (`/2026-1/publicacoes-2026/`) e o número da publicação muda.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const EXERCICIO = 2026;
const BASE = "https://www.gov.br/fnde/pt-br/acesso-a-informacao/acoes-e-programas/financiamento/fundeb";

const FONTE_STATUS = `${BASE}/2026-1/ListaentesbeneficiariosenaobeneficiariosacomplementacaoVAARdoFundeb2026.csv`;
const FONTE_VALORES = `${BASE}/2026-1/publicacoes-2026/6-redes-beneficiadas-coef-de-distribuicao-e-compl-vaar-prevista-iii.csv/@@download/file`;

const DESTINO = join(process.cwd(), "data", "fnde", `vaar-${EXERCICIO}.json`);

const CONDICIONALIDADES = ["I", "II", "III", "IV", "V"];

function log(mensagem) {
  console.log(`[vaar] ${mensagem}`);
}

/**
 * O FNDE serve os CSVs do FUNDEB em ISO-8859-1. Decodificar como UTF-8
 * transformaria "Não Habilitado" em texto quebrado — e como a habilitação é
 * detectada por comparação de string, o município passaria a "habilitado" em
 * silêncio.
 */
async function baixarCsv(url, rotulo) {
  const resposta = await fetch(url, {
    headers: {
      Accept: "text/csv,application/octet-stream,*/*",
      "User-Agent": "Mozilla/5.0",
      Referer: `${BASE}/`,
    },
    signal: AbortSignal.timeout(120_000),
  });

  if (!resposta.ok) {
    throw new Error(`FNDE respondeu HTTP ${resposta.status} para ${rotulo}`);
  }

  const bytes = new Uint8Array(await resposta.arrayBuffer());
  const texto = new TextDecoder("latin1").decode(bytes);
  log(`${rotulo}: ${(bytes.length / 1024).toFixed(0)} KB`);
  return texto;
}

/** " 995.669,36 " → 995669.36 ; " 0,000132295209 " → 0.000132295209 */
function numeroPtBr(bruto) {
  if (!bruto) return null;
  const limpo = bruto.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const valor = Number.parseFloat(limpo);
  return Number.isFinite(valor) ? valor : null;
}

/** " Sim " → true, " Não " → false. Qualquer outra coisa vira null. */
function simNao(bruto) {
  const texto = (bruto ?? "").trim().toLowerCase();
  if (texto === "sim") return true;
  if (texto === "não" || texto === "nao") return false;
  return null;
}

/**
 * Layout: UF;Código IBGE;Entidade;Cond. I..V;Habilitados?;Evoluiu Atendimento?;
 *         Evoluiu Aprendizagem?;Beneficiário?;Pendência
 *
 * As nove primeiras linhas são cabeçalho decorativo do FNDE (título e linhas
 * vazias), por isso a seleção é por formato da linha e não por índice.
 * O `\d{7}` também exclui as redes estaduais, cujo código tem 2 dígitos.
 */
function lerStatus(csv) {
  const linhas = csv.split(/\r?\n/).filter((linha) => /^[A-Z]{2};\d{7};/.test(linha));
  const municipios = new Map();

  for (const linha of linhas) {
    const col = linha.split(";").map((valor) => valor.trim());
    const [uf, codigoIbge, ente] = col;

    const cond = {};
    CONDICIONALIDADES.forEach((numero, indice) => {
      cond[numero] = simNao(col[3 + indice]);
    });

    // "Habilitado" e "Não Habilitado" compartilham o sufixo — testar com
    // `includes("Habilitado")` daria true para os dois.
    const habilitado = /^habilitado$/i.test(col[8] ?? "");
    const beneficiario = /^benefici/i.test(col[11] ?? "");

    municipios.set(codigoIbge, {
      uf,
      ente,
      cond,
      habilitado,
      evoluiuAtendimento: simNao(col[9]),
      evoluiuAprendizagem: simNao(col[10]),
      beneficiario,
      pendencia: (col[12] ?? "").trim() || null,
      coeficiente: null,
      complementacao: 0,
    });
  }

  return municipios;
}

/**
 * Layout: UF;Ente Federado;Código IBGE;Coeficiente;Complementação (R$)
 * Aqui o código IBGE é a terceira coluna, não a segunda.
 */
function aplicarValores(csv, municipios) {
  const linhas = csv.split(/\r?\n/).filter((linha) => /^[A-Z]{2};[^;]*;\d{7};/.test(linha));
  let aplicados = 0;
  let orfaos = 0;

  for (const linha of linhas) {
    const col = linha.split(";").map((valor) => valor.trim());
    const codigoIbge = col[2];
    const registro = municipios.get(codigoIbge);

    if (!registro) {
      orfaos += 1;
      continue;
    }

    registro.coeficiente = numeroPtBr(col[3]);
    registro.complementacao = numeroPtBr(col[4]) ?? 0;
    aplicados += 1;
  }

  return { aplicados, orfaos, linhas: linhas.length };
}

/**
 * A pendência é um texto legal de ~90 caracteres que se repete em milhares de
 * municípios — 1.502 deles têm exatamente a mesma. Guardar o texto inteiro em
 * cada registro triplicaria o arquivo sem acrescentar informação.
 */
function dicionarizarPendencias(municipios) {
  const textos = [];
  const indicePorTexto = new Map();

  for (const registro of municipios.values()) {
    if (!registro.pendencia) {
      registro.pendencia = null;
      continue;
    }

    let indice = indicePorTexto.get(registro.pendencia);
    if (indice === undefined) {
      indice = textos.length;
      textos.push(registro.pendencia);
      indicePorTexto.set(registro.pendencia, indice);
    }
    registro.pendencia = indice;
  }

  return textos;
}

function resumir(municipios) {
  const reprovadasPorCondicionalidade = Object.fromEntries(CONDICIONALIDADES.map((n) => [n, 0]));
  let habilitadas = 0;
  let beneficiadas = 0;
  let complementacaoTotal = 0;
  let somenteCondIII = 0;

  for (const registro of municipios.values()) {
    if (registro.habilitado) habilitadas += 1;
    if (registro.beneficiario) beneficiadas += 1;
    complementacaoTotal += registro.complementacao;

    const reprovadas = CONDICIONALIDADES.filter((n) => registro.cond[n] === false);
    for (const n of reprovadas) reprovadasPorCondicionalidade[n] += 1;
    if (reprovadas.length === 1 && reprovadas[0] === "III") somenteCondIII += 1;
  }

  return {
    avaliadas: municipios.size,
    habilitadas,
    beneficiadas,
    complementacaoTotal: Math.round(complementacaoTotal * 100) / 100,
    reprovadasPorCondicionalidade,
    somenteCondIII,
  };
}

async function main() {
  const municipios = lerStatus(await baixarCsv(FONTE_STATUS, "lista de beneficiários"));

  if (municipios.size === 0) {
    throw new Error("Nenhum município lido — o layout do CSV de status mudou.");
  }
  log(`${municipios.size.toLocaleString("pt-BR")} redes municipais avaliadas`);

  const valores = aplicarValores(await baixarCsv(FONTE_VALORES, "Anexo VI (valores)"), municipios);
  log(`valores aplicados a ${valores.aplicados.toLocaleString("pt-BR")} municípios`);

  // O Anexo VI traz redes estaduais junto das municipais; essas não têm
  // correspondente no índice e são órfãs esperadas. Um salto aqui indica que
  // as duas publicações saíram de ciclos diferentes.
  if (valores.orfaos > 40) {
    log(`ATENÇÃO: ${valores.orfaos} linhas do Anexo VI sem município correspondente`);
  }

  const totais = resumir(municipios);
  const pendencias = dicionarizarPendencias(municipios);

  const conteudo = {
    _comentario:
      "Gerado por scripts/dados/gerar-vaar-municipios.mjs. Não editar à mão. Regerar com: npm run dados:vaar",
    fonte: `FNDE — Lista de entes beneficiários da complementação VAAR ${EXERCICIO} e Anexo VI da Portaria Interministerial MEC/MF`,
    exercicio: EXERCICIO,
    geradoEm: new Date().toISOString(),
    totais,
    /** Textos de pendência, referenciados por índice em cada município. */
    pendencias,
    municipios: Object.fromEntries(municipios),
  };

  mkdirSync(dirname(DESTINO), { recursive: true });
  const json = JSON.stringify(conteudo);
  writeFileSync(DESTINO, json, "utf8");

  log(
    `escrito ${DESTINO} — ${(json.length / 1024 / 1024).toFixed(2)} MB, ` +
      `${totais.habilitadas.toLocaleString("pt-BR")} habilitadas, ` +
      `${totais.beneficiadas.toLocaleString("pt-BR")} beneficiadas, ` +
      `R$ ${totais.complementacaoTotal.toLocaleString("pt-BR")} distribuídos`,
  );
  log(`reprovações por condicionalidade: ${JSON.stringify(totais.reprovadasPorCondicionalidade)}`);
  log(`reprovadas exclusivamente na Cond. III: ${totais.somenteCondIII.toLocaleString("pt-BR")}`);
}

main().catch((erro) => {
  console.error(`[vaar] falhou: ${erro.message}`);
  process.exit(1);
});
