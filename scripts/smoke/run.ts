/**
 * Smoke test pós-deploy: emite um relatório de verdade contra uma URL e olha
 * o que saiu.
 *
 * ## Por que
 *
 * O único portão antes da produção é `npm test`. Ele cobre bem a classe de erro
 * "código quebrado" e é cego para a classe "dado quebrado" — que aqui é a mais
 * provável, porque o produto são PDFs montados de uma dúzia de APIs públicas
 * vivas. Fonte que muda de layout, endpoint que passa a devolver 200 com corpo
 * vazio, coletor que engole a exceção e devolve `null`: nada disso quebra teste
 * de unidade, e tudo isso vira relatório entregue com "N/D" onde havia número.
 *
 * Este script é a primeira verificação que exercita o caminho inteiro —
 * rede, coletores, template, Playwright, PDF — no ambiente onde ele de fato
 * roda.
 *
 * ## Uso
 *
 *     npm run smoke -- http://localhost:3100
 *     npm run smoke -- http://localhost:3100 --municipio 2704302
 *     npm run smoke -- https://... --producao        # opt-in explícito
 *
 * Sai com 0 se passou (alerta não derruba), 1 se alguma verificação falhou.
 * Quando falha depois de um deploy, o caminho de volta é reverter o tráfego:
 *
 *     gcloud run services update-traffic sync-app \
 *       --to-revisions=<revisão-anterior>=100 --region=us-central1
 */

import { writeFile } from "node:fs/promises";
import process from "node:process";
import { PDFParse } from "pdf-parse";

import { PAGINAS_ESPERADAS_RAIO_X } from "../../core/lib/municipal-xray-pdf";
import {
  avaliarAjusteDeEscala,
  avaliarContratoDeFolhas,
  avaliarFontesVivas,
  avaliarSaude,
  exigeConsentimentoDeProducao,
  resumir,
  type PaginaAjustada,
  type Verificacao,
} from "./verificacoes";

/**
 * Município-canário: Igaci/AL (24 mil habitantes, 24 escolas, 5,5 mil
 * matrículas).
 *
 * A escolha não é arbitrária: precisa ser um município cujas 19 fontes
 * respondam todas — senão o smoke test alarma por característica do município,
 * não por defeito do sistema — e precisa ser pequeno, porque a geração dispara
 * dezenas de chamadas a APIs públicas de governo e roda a cada deploy. Uma
 * capital daria o mesmo sinal castigando muito mais fonte alheia.
 */
const MUNICIPIO_PADRAO = "2703106";

/** A geração dispara dezenas de chamadas externas; a rota tem `maxDuration` 300s. */
const TIMEOUT_PADRAO_MS = 330_000;

interface Opcoes {
  url: string;
  municipio: string;
  producao: boolean;
  salvarPdf: string | null;
  timeoutMs: number;
}

function parseArgs(argv: string[]): Opcoes | { erro: string } {
  const posicionais: string[] = [];
  let municipio = MUNICIPIO_PADRAO;
  let producao = false;
  let salvarPdf: string | null = null;
  let timeoutMs = TIMEOUT_PADRAO_MS;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--producao") producao = true;
    else if (arg === "--municipio") municipio = argv[++i] ?? "";
    else if (arg === "--salvar-pdf") salvarPdf = argv[++i] ?? null;
    else if (arg === "--timeout") timeoutMs = Number(argv[++i]) * 1000;
    else if (arg.startsWith("--")) return { erro: `Opção desconhecida: ${arg}` };
    else posicionais.push(arg);
  }

  const url = posicionais[0];
  if (!url) {
    return {
      erro:
        "Informe a URL alvo. Ex.: npm run smoke -- http://localhost:3100\n" +
        "Opções: --municipio <codigoIbge> --salvar-pdf <arquivo> --timeout <segundos> --producao",
    };
  }
  if (!/^https?:\/\//.test(url)) return { erro: `URL inválida: ${url}` };
  if (!/^\d{7}$/.test(municipio)) {
    return { erro: `Código IBGE inválido: ${municipio} (esperado: 7 dígitos).` };
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return { erro: "--timeout precisa ser um número de segundos." };
  }
  return { url: url.replace(/\/+$/, ""), municipio, producao, salvarPdf, timeoutMs };
}

async function contarPaginas(pdf: Buffer): Promise<number> {
  const parser = new PDFParse({ data: pdf });
  try {
    const info = await parser.getInfo();
    return info.total;
  } finally {
    await parser.destroy();
  }
}

function icone(situacao: Verificacao["situacao"]): string {
  return situacao === "ok" ? "  ok  " : situacao === "alerta" ? " ALERTA" : " FALHA ";
}

async function main(): Promise<number> {
  const opcoes = parseArgs(process.argv.slice(2));
  if ("erro" in opcoes) {
    console.error(opcoes.erro);
    return 2;
  }

  const bloqueio = exigeConsentimentoDeProducao(opcoes.url, opcoes.producao);
  if (bloqueio) {
    console.error(bloqueio);
    return 2;
  }

  const verificacoes: Verificacao[] = [];
  console.log(`Smoke test — ${opcoes.url} — município ${opcoes.municipio}\n`);

  // 1. O serviço está de pé?
  try {
    const resposta = await fetch(`${opcoes.url}/api/health`, {
      signal: AbortSignal.timeout(30_000),
    });
    const corpo = await resposta.json().catch(() => null);
    verificacoes.push(avaliarSaude(resposta.status, corpo));
  } catch (erro) {
    verificacoes.push({
      nome: "/api/health",
      situacao: "falha",
      detalhe: `não respondeu: ${mensagem(erro)}`,
    });
  }

  // Sem serviço de pé não há o que medir adiante — as verificações seguintes
  // só produziriam ruído sobre a mesma causa.
  if (resumir(verificacoes).falhas > 0) return imprimir(verificacoes);

  // 2. A geração de um Raio-X de verdade termina sem erro?
  //
  // `response_format: "bundle"` devolve o PDF em base64 **e** o payload que o
  // alimentou. É o que permite separar "o PDF saiu" de "o PDF saiu com dado
  // dentro" — as duas coisas que este script existe para distinguir.
  const inicio = Date.now();
  let bundle: Record<string, unknown> | null = null;
  try {
    const resposta = await fetch(`${opcoes.url}/api/modulos/levantamento-fundeb/raio-x`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo_ibge: opcoes.municipio, response_format: "bundle" }),
      signal: AbortSignal.timeout(opcoes.timeoutMs),
    });
    const segundos = Math.round((Date.now() - inicio) / 1000);
    if (!resposta.ok) {
      const detalhe = await resposta.text().catch(() => "");
      verificacoes.push({
        nome: "geração do Raio-X",
        situacao: "falha",
        detalhe: `HTTP ${resposta.status} em ${segundos}s — ${detalhe.slice(0, 300)}`,
      });
    } else {
      bundle = (await resposta.json()) as Record<string, unknown>;
      verificacoes.push({
        nome: "geração do Raio-X",
        situacao: "ok",
        detalhe: `HTTP 200 em ${segundos}s (${String(bundle.fileName ?? "sem nome")}).`,
      });
    }
  } catch (erro) {
    verificacoes.push({
      nome: "geração do Raio-X",
      situacao: "falha",
      detalhe: `a requisição não completou: ${mensagem(erro)}`,
    });
  }

  if (bundle) {
    // 3. O PDF entregue tem a contagem de folhas contratada.
    const base64 = typeof bundle.pdfBase64 === "string" ? bundle.pdfBase64 : "";
    if (!base64) {
      verificacoes.push({
        nome: "contrato de folhas",
        situacao: "falha",
        detalhe: "a resposta veio sem pdfBase64.",
      });
    } else {
      const pdf = Buffer.from(base64, "base64");
      if (opcoes.salvarPdf) {
        await writeFile(opcoes.salvarPdf, pdf);
        console.log(`PDF salvo em ${opcoes.salvarPdf} (${Math.round(pdf.length / 1024)} KB)\n`);
      }
      try {
        const paginas = await contarPaginas(pdf);
        verificacoes.push(avaliarContratoDeFolhas(paginas, PAGINAS_ESPERADAS_RAIO_X));
      } catch (erro) {
        verificacoes.push({
          nome: "contrato de folhas",
          situacao: "falha",
          detalhe: `o PDF entregue não pôde ser lido: ${mensagem(erro)}`,
        });
      }
    }

    // 4. Nenhuma página transbordou.
    //
    // O corte propriamente dito já é erro no servidor (`assertSemCorte`, em
    // `core/lib/pdf-corte.ts`) — se o PDF chegou, nenhuma página perdeu
    // conteúdo, e a verificação 2 acima é a prova. O que sobra invisível é
    // quem foi salvo pelo auto-ajuste: a rota informa essas páginas em
    // `diagnostics.paginasAjustadas`, e é isso que vira alerta aqui.
    const ajustadas = extrairAjustadas(bundle);
    if (ajustadas === null) {
      verificacoes.push({
        nome: "folgas do template",
        situacao: "alerta",
        detalhe:
          "a rota não informou diagnostics.paginasAjustadas — a versão no ar é anterior a este smoke test.",
      });
    } else {
      verificacoes.push(avaliarAjusteDeEscala(ajustadas));
    }

    // 5. As fontes vivas responderam com dado dentro.
    const payload =
      (bundle.archive as Record<string, unknown> | undefined)?.data &&
      ((bundle.archive as Record<string, unknown>).data as Record<string, unknown>).primary;
    const primary = payload as Record<string, unknown> | undefined;
    if (!primary?.payload) {
      verificacoes.push({
        nome: "fontes vivas",
        situacao: "falha",
        detalhe: "o bundle não trouxe archive.data.primary.payload — não dá para auditar o dado.",
      });
    } else {
      verificacoes.push(...avaliarFontesVivas(primary.payload));
    }
  }

  return imprimir(verificacoes);
}

function extrairAjustadas(bundle: Record<string, unknown>): PaginaAjustada[] | null {
  const diagnostics = bundle.diagnostics as Record<string, unknown> | undefined;
  const lista = diagnostics?.paginasAjustadas;
  if (!Array.isArray(lista)) return null;
  return lista.filter(
    (item): item is PaginaAjustada =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as PaginaAjustada).pagina === "number" &&
      typeof (item as PaginaAjustada).escala === "number",
  );
}

function imprimir(verificacoes: Verificacao[]): number {
  for (const v of verificacoes) {
    console.log(`[${icone(v.situacao)}] ${v.nome}: ${v.detalhe}`);
  }
  const resumo = resumir(verificacoes);
  console.log(
    `\n${resumo.oks} ok · ${resumo.alertas} alerta(s) · ${resumo.falhas} falha(s) — ` +
      (resumo.falhas > 0
        ? "SMOKE TEST FALHOU. Se veio logo depois de um deploy, reverta o tráfego:\n" +
          "  gcloud run services update-traffic sync-app --to-revisions=<revisão-anterior>=100 --region=us-central1"
        : resumo.alertas > 0
          ? "passou com alerta."
          : "passou."),
  );
  return resumo.codigoDeSaida;
}

function mensagem(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}

main().then(
  (codigo) => process.exit(codigo),
  (erro) => {
    console.error("Smoke test estourou:", erro);
    process.exit(1);
  },
);
