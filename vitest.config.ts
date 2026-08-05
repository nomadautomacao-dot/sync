import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Quantos processos de teste rodam em paralelo.
 *
 * O padrao do Vitest e um por CPU, e numa maquina de desenvolvimento isso e o
 * que se quer. No Cloud Build nao: a maquina do gate e `E2_HIGHCPU_8` — oito
 * vCPU e **oito** GB, porque a familia HIGHCPU da 1 GB por vCPU. Oito processos
 * carregando o grafo de modulos inteiro (o `import` sozinho leva ~90s) nao
 * cabem em 8 GB, e o kernel mata o passo: `Killed`, exit 137.
 *
 * Foi assim que a producao ficou congelada de 2026-08-02 a 2026-08-05 sem que
 * ninguem percebesse. O gatilho disparava, o build rodava, a suite morria por
 * memoria, e o deploy nunca acontecia — e como nada quebrava visivelmente, a
 * unica pista era o servico continuar respondendo com codigo antigo.
 *
 * Limitar em vez de aumentar a maquina de proposito: a suite leva ~19s local e
 * o gargalo aqui e memoria, nao CPU.
 */
function maximoDeProcessos(): number | undefined {
  const bruto = process.env.VITEST_MAX_FORKS;
  if (!bruto) return undefined;
  const n = Number.parseInt(bruto, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export default defineConfig({
  test: {
    environment: "node",
    poolOptions: { forks: { maxForks: maximoDeProcessos(), minForks: 1 } },
    include: ["**/*.test.ts"],
    exclude: [
      // `**/` e nao `node_modules/**`: a forma antiga so pegava a raiz, e
      // qualquer pasta de ferramenta com dependencias proprias entrava na
      // suite. Foi o que aconteceu com `.kilo/node_modules/`, que trouxe os
      // testes internos do zod e deixou o gate vermelho com 3 falhas que nao
      // eram do projeto.
      "**/node_modules/**",
      ".next/**",
      // Worktrees de agentes duplicam os testes da raiz
      ".claude/**",
      // Cloud Functions usam node:test, nao vitest (`npm --prefix functions test`)
      "functions/**",
      // O app desktop empacotado carrega uma copia de `core/` e `modules/`
      // dentro do `.app`. Sem esta linha a suite dobra de tamanho (57 -> 113
      // arquivos) e roda os mesmos testes num diretorio onde os caminhos
      // relativos nao valem — foi assim que um teste "quebrou" sem que nenhum
      // codigo tivesse mudado.
      "dist-desktop/**",
    ],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
