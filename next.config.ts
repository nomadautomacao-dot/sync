import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: ["pdfjs-dist", "playwright", "playwright-core"],
};

export default nextConfig;
