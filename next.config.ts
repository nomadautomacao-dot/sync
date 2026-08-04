import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  /* Onde o `standalone` considera que o projeto começa.
   *
   * Sem esta linha o Next adivinha, e adivinha pelo lockfile mais alto que
   * encontrar. No contêiner o repositório está sozinho em `/app` e o palpite
   * acerta; numa máquina onde ele é uma pasta entre outras — e há um
   * `package-lock.json` solto na pasta de cima — a raiz eleita é a pasta de
   * cima, e a saída vira `.next/standalone/Global-Sync/server.js` em vez de
   * `.next/standalone/server.js`.
   *
   * O efeito é ninguém achar o servidor: `Dockerfile`, `desktop/main.js` e
   * `scripts/desktop/preparar-servidor.mjs` esperam o caminho plano. Fixar a
   * raiz faz o build local produzir exatamente o que a nuvem produz. */
  outputFileTracingRoot: path.join(__dirname),
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.100.170"],
  /* O compilador é gate, não sugestão.
   *
   * Isto esteve ligado, e o custo apareceu inteiro de uma vez: 59 erros
   * acumulados, entre eles uma variável lida antes de existir na rota de slides
   * — `ReferenceError` garantido em execução — e um recurso inteiro (o
   * "relatório dirigido") que um refactor quebrou sem que nada avisasse, porque
   * o build continuou passando. Se voltar a ficar vermelho, o conserto é o
   * erro, não esta linha. */
  typescript: { ignoreBuildErrors: false },
  serverExternalPackages: ["pdfjs-dist", "playwright", "playwright-core"],
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, X-Requested-With" },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // O app Flutter foi removido. Quem tiver a URL antiga guardada cai na
      // entrada do React em vez de tomar 404. Temporário (307) de propósito:
      // um 308 ficaria cacheado no browser para sempre.
      {
        source: "/flutter-web/:path*",
        destination: "/entrar",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
