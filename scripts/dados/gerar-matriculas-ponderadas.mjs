#!/usr/bin/env node
/**
 * Gera `data/fnde/matriculas-ponderadas-2026.json` — a matrícula de cada
 * município no recorte que o FUNDEB efetivamente remunera, e os fatores de
 * ponderação oficiais derivados do próprio dado.
 *
 * ## Por que este dataset existe
 *
 * A receita do FUNDEB não é proporcional à matrícula: é proporcional a
 * Σ(matrícula × fator de ponderação), e o fator vai de **1,00** (anos iniciais
 * urbano, a referência do art. 7º, §1º da Lei 14.113/2020) a **2,17** (creche
 * integral indígena ou quilombola). Relatar matrícula bruta mostra o
 * denominador errado: duas redes do mesmo tamanho podem valer receitas
 * separadas por 60%.
 *
 * Isso também nomeia a maior perda evitável do fundo. Uma creche de 100 vagas
 * integrais declarada como parcial cai de 1,55 para 1,25 — 30 pontos de
 * ponderação por aluno, todo ano, até que o Censo seja corrigido.
 *
 * ## Por que os fatores são derivados, e não transcritos
 *
 * A Resolução CIF nº 5/2024 e a planilha operacional do FNDE **divergem**: a
 * resolução dá 1,10 para creche parcial conveniada no VAAT, a planilha aplica
 * 1,27 (e 1,16 na pré-escola). O dinheiro segue a planilha. Como ela publica a
 * mesma célula em versão crua (aba 1) e ponderada (abas 2 e 3), o fator sai da
 * divisão — é o número que o FNDE usou, não o que a norma diz que ele usaria.
 *
 * Os fatores são colhidos por moda entre os 5.596 entes. As células vêm
 * arredondadas a duas casas, então divisões isoladas produzem ruído
 * (1,7825 vs 1,7826); a moda descarta o ruído e a dispersão é registrada em
 * `fatores.divergencia` para inspeção.
 *
 * ## Uso
 *
 *     npm run dados:ponderadas
 *
 * A CIF publica as ponderações até 31/07 para o exercício seguinte, e o FNDE
 * republica a planilha a cada portaria quadrimestral. Ao virar o exercício,
 * atualize `EXERCICIO` e `URL_PLANILHA` — o caminho embute a data da portaria.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { inflateRawSync } from "node:zlib";

const EXERCICIO = 2026;
const URL_PLANILHA =
  "https://www.gov.br/fnde/pt-br/acesso-a-informacao/acoes-e-programas/financiamento/fundeb/matriculas-da-educacao-basica/2026-com-base-na-portaria-interministerial-no-6-de-29-de-abril-de-2026/matriculas-ponderadas-do-fundeb-2026.xlsx/@@download/file";

const DESTINO = join(process.cwd(), "data", "fnde", `matriculas-ponderadas-${EXERCICIO}.json`);

/** Aba 1 crua, aba 2 ponderada pelo VAAF, aba 3 ponderada pelo VAAT. */
const ABAS = { cru: "sheet1", vaaf: "sheet2", vaat: "sheet3" };

/** Linha 1 é título mesclado; a linha 2 traz os rótulos das colunas. */
const LINHA_CABECALHO = 1;
/** UF, Ente Federado e Código IBGE ocupam as três primeiras colunas. */
const COLUNAS_IDENTIFICACAO = 3;

function log(mensagem) {
  console.log(`[ponderadas] ${mensagem}`);
}

// ── Leitura de XLSX ─────────────────────────────────────────────────────────
//
// Um .xlsx é um ZIP de XML. As ~120 linhas abaixo leem o que precisamos —
// diretório central, inflate e as células — e evitam uma dependência de
// planilha só para um gerador que roda offline algumas vezes por ano.

function abrirZip(buffer) {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("arquivo não é um ZIP válido (fim do diretório central ausente)");

  const total = buffer.readUInt16LE(eocd + 10);
  let cursor = buffer.readUInt32LE(eocd + 16);
  const entradas = new Map();

  for (let i = 0; i < total; i++) {
    const metodo = buffer.readUInt16LE(cursor + 10);
    const comprimido = buffer.readUInt32LE(cursor + 20);
    const tamanhoNome = buffer.readUInt16LE(cursor + 28);
    const tamanhoExtra = buffer.readUInt16LE(cursor + 30);
    const tamanhoComentario = buffer.readUInt16LE(cursor + 32);
    const nome = buffer.toString("utf8", cursor + 46, cursor + 46 + tamanhoNome);
    entradas.set(nome, { metodo, comprimido, local: buffer.readUInt32LE(cursor + 42) });
    cursor += 46 + tamanhoNome + tamanhoExtra + tamanhoComentario;
  }

  return (nome) => {
    const entrada = entradas.get(nome);
    if (!entrada) throw new Error(`entrada ausente no XLSX: ${nome}`);
    // O cabeçalho local repete o nome e os extras com tamanhos próprios — os do
    // diretório central não servem para localizar o início dos dados.
    const tamanhoNome = buffer.readUInt16LE(entrada.local + 26);
    const tamanhoExtra = buffer.readUInt16LE(entrada.local + 28);
    const inicio = entrada.local + 30 + tamanhoNome + tamanhoExtra;
    const dados = buffer.subarray(inicio, inicio + entrada.comprimido);
    return entrada.metodo === 0 ? dados : inflateRawSync(dados);
  };
}

const ENTIDADES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&#10;": " " };

function desescapar(texto) {
  return texto.replace(/&(?:amp|lt|gt|quot|apos|#10);/g, (e) => ENTIDADES[e] ?? e);
}

/** Tabela de strings compartilhadas — células de texto guardam só o índice. */
function lerSharedStrings(ler) {
  return [...ler("xl/sharedStrings.xml").toString("utf8").matchAll(/<si>(.*?)<\/si>/gs)].map((item) =>
    desescapar([...item[1].matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map((t) => t[1]).join("")),
  );
}

/** "BF12" → 57. Base 26 com A=1, sem zero. */
function indiceColuna(referencia) {
  let indice = 0;
  for (const caractere of referencia) {
    const codigo = caractere.charCodeAt(0);
    if (codigo < 65 || codigo > 90) break;
    indice = indice * 26 + (codigo - 64);
  }
  return indice - 1;
}

function lerAba(ler, aba, sharedStrings) {
  const xml = ler(`xl/worksheets/${aba}.xml`).toString("utf8");
  const linhas = [];

  for (const linha of xml.matchAll(/<row[^>]*>(.*?)<\/row>/gs)) {
    const celulas = [];
    for (const celula of linha[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*)>(?:<v>([^<]*)<\/v>)?/g)) {
      if (celula[3] === undefined) continue;
      const coluna = indiceColuna(celula[1]);
      celulas[coluna] = /t="s"/.test(celula[2]) ? sharedStrings[Number(celula[3])] : Number(celula[3]);
    }
    linhas.push(celulas);
  }

  return linhas;
}

// ── Derivação dos fatores ───────────────────────────────────────────────────

/**
 * Fator de cada segmento, pela moda de `ponderada / crua` entre todos os entes
 * que têm matrícula nele. Devolve também quantos valores distintos apareceram:
 * mais de um é esperado (arredondamento), muitos indicaria mudança de regra.
 */
function derivarFatores(cru, ponderada, totalColunas) {
  const fatores = [];
  const divergencia = [];

  for (let coluna = COLUNAS_IDENTIFICACAO; coluna < totalColunas; coluna++) {
    const contagem = new Map();

    for (let linha = LINHA_CABECALHO + 1; linha < cru.length; linha++) {
      const base = cru[linha]?.[coluna];
      const peso = ponderada[linha]?.[coluna];
      if (!base || !peso) continue;
      const fator = Math.round((peso / base) * 10_000) / 10_000;
      contagem.set(fator, (contagem.get(fator) ?? 0) + 1);
    }

    if (contagem.size === 0) {
      fatores.push(null);
      continue;
    }

    const ordenado = [...contagem].sort((a, b) => b[1] - a[1]);
    fatores.push(ordenado[0][0]);
    if (contagem.size > 1) {
      divergencia.push({ coluna, valores: ordenado.slice(0, 4).map(([f, n]) => [f, n]) });
    }
  }

  return { fatores, divergencia };
}

async function baixarPlanilha() {
  const inicio = Date.now();
  const resposta = await fetch(URL_PLANILHA, {
    headers: { Accept: "*/*", "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(300_000),
  });

  if (!resposta.ok) throw new Error(`FNDE respondeu HTTP ${resposta.status} para a planilha`);

  const buffer = Buffer.from(await resposta.arrayBuffer());
  log(`planilha: ${(buffer.length / 1024 / 1024).toFixed(1)} MB em ${((Date.now() - inicio) / 1000).toFixed(1)}s`);
  return buffer;
}

async function main() {
  const ler = abrirZip(await baixarPlanilha());
  const sharedStrings = lerSharedStrings(ler);

  const cru = lerAba(ler, ABAS.cru, sharedStrings);
  const vaaf = lerAba(ler, ABAS.vaaf, sharedStrings);
  const vaat = lerAba(ler, ABAS.vaat, sharedStrings);

  if (cru.length !== vaaf.length || cru.length !== vaat.length) {
    throw new Error(
      `abas com contagens diferentes (${cru.length}/${vaaf.length}/${vaat.length}) — a planilha mudou de formato`,
    );
  }

  const cabecalho = cru[LINHA_CABECALHO];
  // A última coluna é "Matrículas Totais", um somatório — não é um segmento.
  const totalColunas = cabecalho.length - 1;
  const segmentos = cabecalho.slice(COLUNAS_IDENTIFICACAO, totalColunas);
  log(`${cru.length - 2} entes, ${segmentos.length} segmentos de ponderação`);

  const derivadoVaaf = derivarFatores(cru, vaaf, totalColunas);
  const derivadoVaat = derivarFatores(cru, vaat, totalColunas);

  const municipios = {};
  let ignorados = 0;

  for (let linha = LINHA_CABECALHO + 1; linha < cru.length; linha++) {
    const base = cru[linha];
    const codigoIbge = String(base?.[2] ?? "");

    // Redes estaduais entram na planilha com código de 2 dígitos.
    if (!/^\d{7}$/.test(codigoIbge)) {
      ignorados += 1;
      continue;
    }

    // Esparso: a maioria dos municípios zera a maior parte dos 83 segmentos
    // (nenhuma escola quilombola, nenhum ensino médio). Guardar os zeros
    // quadruplicaria o arquivo sem acrescentar informação.
    const segmentosDoEnte = [];
    for (let coluna = COLUNAS_IDENTIFICACAO; coluna < totalColunas; coluna++) {
      const valor = base[coluna];
      if (valor) segmentosDoEnte.push([coluna - COLUNAS_IDENTIFICACAO, valor]);
    }

    municipios[codigoIbge] = {
      uf: String(base[0] ?? ""),
      ente: String(base[1] ?? ""),
      total: Number(base[totalColunas] ?? 0),
      vaaf: Math.round(Number(vaaf[linha]?.[totalColunas] ?? 0) * 100) / 100,
      vaat: Math.round(Number(vaat[linha]?.[totalColunas] ?? 0) * 100) / 100,
      seg: segmentosDoEnte,
    };
  }

  const conteudo = {
    _comentario:
      "Gerado por scripts/dados/gerar-matriculas-ponderadas.mjs. Não editar à mão. Regerar com: npm run dados:ponderadas",
    fonte: `FNDE — Matrículas ponderadas do FUNDEB ${EXERCICIO} (Portaria Interministerial MEC/MF)`,
    exercicio: EXERCICIO,
    geradoEm: new Date().toISOString(),
    segmentos,
    /**
     * Fatores por índice de segmento, derivados da planilha. `divergencia`
     * lista os segmentos em que a divisão rendeu mais de um valor — esperado,
     * porque as células vêm arredondadas a duas casas.
     */
    fatores: {
      vaaf: derivadoVaaf.fatores,
      vaat: derivadoVaat.fatores,
      divergencia: {
        vaaf: derivadoVaaf.divergencia.length,
        vaat: derivadoVaat.divergencia.length,
      },
    },
    municipios,
  };

  mkdirSync(dirname(DESTINO), { recursive: true });
  const json = JSON.stringify(conteudo);
  writeFileSync(DESTINO, json, "utf8");

  const referencia = segmentos.indexOf("Anos Iniciais Fundamental Urbano");
  log(
    `escrito ${DESTINO} — ${(json.length / 1024 / 1024).toFixed(2)} MB, ` +
      `${Object.keys(municipios).length.toLocaleString("pt-BR")} municípios (${ignorados} não municipais ignorados)`,
  );
  log(
    `conferência: fator do segmento de referência (anos iniciais urbano) = ` +
      `${derivadoVaaf.fatores[referencia]} no VAAF — a lei fixa 1`,
  );
  log(
    `segmentos com dispersão por arredondamento: ${derivadoVaaf.divergencia.length} (VAAF), ` +
      `${derivadoVaat.divergencia.length} (VAAT)`,
  );
}

main().catch((erro) => {
  console.error(`[ponderadas] falhou: ${erro.message}`);
  process.exit(1);
});
