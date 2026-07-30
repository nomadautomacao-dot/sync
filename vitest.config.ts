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
    ],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
