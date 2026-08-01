import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
