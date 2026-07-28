/**
 * Ferramenta de desenvolvimento: estado e atualização do snapshot local do
 * Novo CAGED (`data/caged-municipios.json`).
 *
 * - `GET`  responde se a fonte tem dado mais recente que o snapshot. Custa
 *          ~1,6 KB por série (endpoint `Metadados` do IPEADATA).
 * - `POST` roda `scripts/dados/gerar-caged-municipios.mjs` e devolve o estado
 *          resultante. Baixa ~117 MB e leva ~80 s.
 *
 * ## Por que só em desenvolvimento
 *
 * A rota **escreve no repositório de trabalho**. Isso só faz sentido na
 * máquina de quem desenvolve: no Cloud Run o sistema de arquivos é efêmero e
 * por instância, então um POST lá gastaria 80 s para produzir um arquivo que
 * some no próximo cold start e que nenhuma outra instância enxerga. Em
 * produção o snapshot chega pela imagem Docker, versionado no git.
 *
 * O bloqueio é por `NODE_ENV`, avaliado no servidor. Em produção a rota
 * responde 404 — não 403 — para não anunciar sua existência.
 */

import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { join } from "node:path";

import { obterEstadoSnapshotCaged } from "@/core/lib/caged-snapshot";

export const maxDuration = 300;

const SCRIPT = join("scripts", "dados", "gerar-caged-municipios.mjs");
/** O download das duas séries levou ~80 s na medição; a folga cobre uma rede pior. */
const TIMEOUT_GERACAO_MS = 280_000;

function apenasDesenvolvimento() {
  return process.env.NODE_ENV !== "production";
}

function naoEncontrado() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function GET() {
  if (!apenasDesenvolvimento()) return naoEncontrado();

  try {
    return NextResponse.json(await obterEstadoSnapshotCaged());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao consultar o snapshot." },
      { status: 500 },
    );
  }
}

/**
 * Roda o gerador como subprocesso em vez de reimplementar a coleta aqui: é o
 * mesmo caminho de código que `npm run dados:caged` executa, então o arquivo
 * escrito pela tela e o escrito pelo terminal são necessariamente iguais.
 */
function rodarGerador(): Promise<{ ok: boolean; saida: string }> {
  return new Promise((resolve) => {
    const processo = spawn(process.execPath, [join(process.cwd(), SCRIPT)], {
      cwd: process.cwd(),
      // O parser de ~58 MB de JSON por série passa folgado do heap padrão em
      // máquinas com menos memória; o gerador roda sequencial justamente para
      // isso, e a folga aqui evita um OOM que apareceria como falha silenciosa.
      env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096" },
    });

    const linhas: string[] = [];
    let encerrado = false;

    const finalizar = (ok: boolean, extra?: string) => {
      if (encerrado) return;
      encerrado = true;
      clearTimeout(cronometro);
      if (extra) linhas.push(extra);
      resolve({ ok, saida: linhas.join("\n").trim() });
    };

    const cronometro = setTimeout(() => {
      processo.kill();
      finalizar(false, `Tempo limite de ${TIMEOUT_GERACAO_MS / 1000}s excedido.`);
    }, TIMEOUT_GERACAO_MS);

    // O gerador escreve o progresso em stdout e as falhas em stderr; as duas
    // vão para a mesma lista porque a tela mostra o log inteiro.
    processo.stdout.on("data", (pedaco: Buffer) => linhas.push(pedaco.toString().trimEnd()));
    processo.stderr.on("data", (pedaco: Buffer) => linhas.push(pedaco.toString().trimEnd()));
    processo.on("error", (erro) => finalizar(false, erro.message));
    processo.on("close", (codigo) => finalizar(codigo === 0));
  });
}

export async function POST() {
  if (!apenasDesenvolvimento()) return naoEncontrado();

  const resultado = await rodarGerador();

  if (!resultado.ok) {
    return NextResponse.json(
      { error: "A geração do snapshot falhou.", log: resultado.saida },
      { status: 500 },
    );
  }

  // O estado é relido do disco: é ele que prova que o arquivo novo está lá,
  // não o código de saída do processo.
  return NextResponse.json({ log: resultado.saida, estado: await obterEstadoSnapshotCaged() });
}
