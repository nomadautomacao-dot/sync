import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
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
