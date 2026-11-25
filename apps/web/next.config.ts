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
    // Allow TypeScript .js relative imports in workspace packages to resolve .ts/.tsx cleanly
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
