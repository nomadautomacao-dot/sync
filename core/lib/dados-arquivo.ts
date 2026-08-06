/**
 * Leitura dos JSON de `data/` em tempo de execução, e não por `import`.
 *
 * ## Por que isto existe
 *
 * `tsconfig.json` tem `resolveJsonModule: true`. Com ele, um `import dados from
 * "@/data/x.json"` faz o TypeScript **ler o arquivo e deduzir o tipo exato de
 * todo o conteúdo** — para os quatro Censos INEP, 19 MB cada, isso é um tipo
 * com centenas de milhares de propriedades literais.
 *
 * O custo apareceu medido em 2026-08-05: a checagem de tipos do `next build`
 * pedia 5.615 MB num processo e ~8,5 GB somando os dois, acima dos 8 GB da
 * máquina do Cloud Build. O build parou de caber, e a produção ficou congelada.
 * O mesmo peso fazia o gate de testes precisar de ajuste fino de memória.
 *
 * E o tipo deduzido era **descartado na linha seguinte**: os consumidores já
 * faziam `as Record<string, AlgumaInterface>`. Pagava-se a dedução para jogá-la
 * fora.
 *
 * Lendo em execução, o TypeScript não vê o conteúdo: vê a interface que o
 * chamador declara. A dedução some, e com ela o custo.
 *
 * ## O contrato
 *
 * O caminho é relativo à raiz do projeto, resolvido por `process.cwd()` — o
 * mesmo que `core/lib/caged-snapshot.ts` já fazia. Isso vale em três lugares:
 * no `npm run dev` e nos testes (a raiz é o repositório), no contêiner (a raiz
 * é `/app`) e no app desktop (a raiz é a pasta do standalone).
 *
 * **Arquivo lido aqui precisa de `COPY` no `Dockerfile`.** O rastreamento do
 * Next não enxerga leitura por caminho montado em execução; sem a linha
 * correspondente, o arquivo não entra na imagem e a falha só aparece na
 * primeira requisição que precisar dele. É a mesma armadilha da lista
 * `COMPLEMENTOS` em `scripts/desktop/preparar-servidor.mjs`.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Um arquivo lido uma vez fica em memória pelo tempo de vida do processo, como
 * acontecia com `import`. O que muda é **quando**: só o dataset efetivamente
 * pedido é carregado. Antes, os quatro Censos entravam na memória do servidor
 * mesmo numa requisição que consultasse um ano só.
 */
const cache = new Map<string, unknown>();

/**
 * Lê um JSON de `data/` e o devolve com o tipo que o chamador declarar.
 *
 * O tipo é **afirmado, não verificado** — igual ao `as` que os consumidores já
 * faziam sobre o `import`. A garantia de que o arquivo bate com a interface
 * continua sendo do script gerador em `scripts/dados/`.
 *
 * @param caminhoRelativo caminho a partir da raiz, ex.: `data/ideb-municipal-2023.json`
 */
export function lerJsonDeDados<T>(caminhoRelativo: string): T {
  const emCache = cache.get(caminhoRelativo);
  if (emCache !== undefined) return emCache as T;

  const caminho = join(process.cwd(), caminhoRelativo);

  let bruto: string;
  try {
    bruto = readFileSync(caminho, "utf8");
  } catch (causa) {
    // Erro explícito em vez de `null`: um dataset ausente não tem modo
    // degradado que faça sentido — o relatório sairia com buraco silencioso.
    // A mensagem nomeia o arquivo e a causa provável, porque quem topar com
    // ela está quase sempre olhando para um `COPY` que faltou.
    throw new Error(
      `Dataset não encontrado: ${caminhoRelativo} (procurado em ${caminho}). ` +
        `Se isto apareceu em produção ou no app desktop, falta a linha COPY correspondente ` +
        `no Dockerfile ou a entrada em COMPLEMENTOS de scripts/desktop/preparar-servidor.mjs.`,
      { cause: causa },
    );
  }

  const dados = JSON.parse(bruto) as T;
  cache.set(caminhoRelativo, dados);
  return dados;
}
