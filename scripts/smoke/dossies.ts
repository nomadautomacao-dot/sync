#!/usr/bin/env tsx
/**
 * Varredura dos oito dossiês temáticos, de ponta a ponta.
 *
 * ## Por que existe, separado do smoke test do Raio-X
 *
 * Os dossiês são de outra família e **não podem ser verificados pelo mesmo
 * contrato**. No Raio-X o número de folhas é fixo e o conteúdo é cortado por
 * `overflow:hidden`, então a pergunta é "coube?". No dossiê a paginação é por
 * fluxo e o volume é função do município, então a pergunta é outra:
 * **imprimiu tudo?** — o contrato é de completude, não de folhas.
 *
 * Até agora esses oito só tinham teste unitário com fixture. E a lição desta
 * semana foi exatamente que **fixture magra mente**: o Raio-X passava com
 * "zero corte" em folhas que, com dado real, andavam a 94% de escala.
 *
 * ## O que esta varredura checa
 *
 * Por dossiê e por município: a prévia (`GET`) responde; a geração (`POST`)
 * termina sem erro; o PDF sai com páginas; e — o cruzamento que só existe aqui
 * — o tamanho que a **prévia anunciou** bate com o que o PDF entregou. A tela
 * de emissão mostra a prévia ao usuário antes de gerar; prévia que erra feio é
 * defeito ainda que o PDF esteja certo.
 *
 * ## Uso
 *
 *     npx tsx scripts/smoke/dossies.ts http://localhost:3210
 *     npx tsx scripts/smoke/dossies.ts <url> --municipio 2924009
 */

import { PDFParse } from "pdf-parse";

interface Dossie {
  chave: string;
  rotulo: string;
}

const DOSSIES: Dossie[] = [
  { chave: "escolas", rotulo: "Escolas" },
  { chave: "conformidade", rotulo: "Conformidade" },
  { chave: "matricula", rotulo: "Matrícula ponderada" },
  { chave: "dinheiro", rotulo: "Dinheiro federal" },
  { chave: "aprendizagem", rotulo: "Aprendizagem" },
  { chave: "demanda", rotulo: "Demanda" },
  { chave: "equidade", rotulo: "Equidade" },
  { chave: "comparativo", rotulo: "Comparativo" },
];

/** Perfis deliberadamente distintos: porte, região e completude de fonte. */
const MUNICIPIOS: { codigo: string; nome: string; uf: string }[] = [
  { codigo: "2924009", nome: "PAULO AFONSO", uf: "BA" },
  { codigo: "2703007", nome: "IBATEGUARA", uf: "AL" },
  { codigo: "1302603", nome: "MANAUS", uf: "AM" },
  { codigo: "3550308", nome: "SAO PAULO", uf: "SP" },
];

interface Resultado {
  dossie: string;
  municipio: string;
  previaOk: boolean;
  previaPaginas: number | null;
  previaBruta: Record<string, unknown> | null;
  status: number;
  paginas: number | null;
  segundos: number;
  erro: string | null;
}

async function contarPaginas(pdf: Buffer): Promise<number> {
  const parser = new PDFParse({ data: pdf });
  try {
    return (await parser.getInfo()).total;
  } finally {
    await parser.destroy();
  }
}

/**
 * A prévia não tem campo único de tamanho: cada rota nomeia o seu. Procurar
 * por convenção é frágil de propósito — se uma rota deixar de anunciar
 * tamanho, isso aparece como `null` no relatório em vez de passar batido.
 */
function paginasDaPrevia(corpo: Record<string, unknown>): number | null {
  for (const chave of ["paginasEstimadas", "paginas", "totalPaginas"]) {
    const valor = corpo[chave];
    if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  }
  return null;
}

async function medir(base: string, d: Dossie, m: (typeof MUNICIPIOS)[number]): Promise<Resultado> {
  const inicio = Date.now();
  const resultado: Resultado = {
    dossie: d.rotulo,
    municipio: `${m.nome}/${m.uf}`,
    previaOk: false,
    previaPaginas: null,
    previaBruta: null,
    status: 0,
    paginas: null,
    segundos: 0,
    erro: null,
  };

  try {
    // `nome` vai sempre: sete rotas o ignoram, e a de dinheiro federal o exige
    // porque o painel do FNDE resolve obra por nome e UF, não por código.
    // Omiti-lo na primeira versão deste script produziu um "defeito" que era
    // meu, não do produto — a tela sempre mandou os três.
    const busca = new URLSearchParams({ codigo_ibge: m.codigo, nome: m.nome, uf: m.uf });
    const previa = await fetch(`${base}/api/modulos/dossies/${d.chave}?${busca}`, {
      signal: AbortSignal.timeout(120_000),
    });
    if (previa.ok) {
      const corpo = (await previa.json()) as Record<string, unknown>;
      resultado.previaOk = true;
      resultado.previaBruta = corpo;
      resultado.previaPaginas = paginasDaPrevia(corpo);
    }
  } catch (erro) {
    resultado.erro = `prévia: ${erro instanceof Error ? erro.message : String(erro)}`;
  }

  try {
    const resposta = await fetch(`${base}/api/modulos/dossies/${d.chave}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo_ibge: m.codigo, nome: m.nome, uf: m.uf }),
      signal: AbortSignal.timeout(600_000),
    });
    resultado.status = resposta.status;
    if (resposta.ok) {
      resultado.paginas = await contarPaginas(Buffer.from(await resposta.arrayBuffer()));
    } else {
      const texto = await resposta.text();
      resultado.erro = texto.slice(0, 220);
    }
  } catch (erro) {
    resultado.erro = erro instanceof Error ? erro.message : String(erro);
  }

  resultado.segundos = Math.round((Date.now() - inicio) / 100) / 10;
  return resultado;
}

async function main() {
  const base = process.argv[2];
  if (!base) {
    console.error("uso: npx tsx scripts/smoke/dossies.ts <url> [--municipio <ibge>]");
    process.exit(2);
  }
  const filtro = process.argv.includes("--municipio")
    ? process.argv[process.argv.indexOf("--municipio") + 1]
    : null;
  const alvos = filtro ? MUNICIPIOS.filter((m) => m.codigo === filtro) : MUNICIPIOS;

  console.log(`Varredura dos dossiês — ${base}\n`);
  const todos: Resultado[] = [];

  for (const m of alvos) {
    console.log(`── ${m.nome}/${m.uf} (${m.codigo})`);
    for (const d of DOSSIES) {
      const r = await medir(base, d, m);
      todos.push(r);
      const previa =
        r.previaPaginas === null ? (r.previaOk ? "prévia sem tamanho" : "prévia FALHOU") : `prévia ${r.previaPaginas}p`;
      const real = r.paginas === null ? `HTTP ${r.status}` : `${r.paginas}p`;
      const desvio =
        r.paginas !== null && r.previaPaginas !== null && r.previaPaginas > 0
          ? ` · desvio ${Math.round(((r.paginas - r.previaPaginas) / r.previaPaginas) * 100)}%`
          : "";
      console.log(
        `   ${r.dossie.padEnd(20)} ${previa.padEnd(20)} → ${real.padEnd(10)} ${r.segundos}s${desvio}` +
          (r.erro ? `\n      ERRO: ${r.erro.replace(/\s+/g, " ")}` : ""),
      );
    }
    console.log("");
  }

  const falhas = todos.filter((r) => r.paginas === null);
  const semPrevia = todos.filter((r) => !r.previaOk);
  const semTamanho = todos.filter((r) => r.previaOk && r.previaPaginas === null);
  console.log(
    `${todos.length} combinações · ${falhas.length} falha(s) de geração · ` +
      `${semPrevia.length} prévia(s) quebrada(s) · ${semTamanho.length} prévia(s) sem tamanho`,
  );
  process.exitCode = falhas.length > 0 ? 1 : 0;
}

main();
