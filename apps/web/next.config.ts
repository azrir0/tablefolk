import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@tablefolk/shared",
    "@tablefolk/cafe-engine",
    "@tablefolk/game-engine",
    "@tablefolk/game-treasure-trails",
    "@tablefolk/ui",
  ],
  webpack: (config) => {
    // Resolve TypeScript .js relative imports in workspace packages cleanly to .ts/.tsx
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
