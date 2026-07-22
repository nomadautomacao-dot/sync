import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: { ignoreBuildErrors: true },
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
      {
        // Allow Flutter Web to load its assets cross-origin if embedded
        source: "/flutter-web/:path*",
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      // Flutter Web — serve the Flutter SPA for all subroutes
      // The static files are served directly from public/flutter-web/
      // Deep-links inside Flutter (client routing) resolve to index.html
      {
        source: "/flutter-web/:path+",
        destination: "/flutter-web/index.html",
      },
    ];
  },
};

export default nextConfig;
