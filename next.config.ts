import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pasta .next/standalone para a imagem Docker; a Vercel ignora esta opção.
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
