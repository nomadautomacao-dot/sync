import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: [
      "node_modules/**",
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
