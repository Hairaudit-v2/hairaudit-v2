import type { NextConfig } from "next";
import path from "path";

// Use config file location as project root (avoids wrong cwd when workspace is g:\)
const projectRoot = path.resolve(path.dirname(require.resolve("./package.json")));
const tailwindcssPath = path.join(projectRoot, "node_modules", "tailwindcss");

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      tailwindcss: tailwindcssPath,
    },
  },
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.alias ??= {};
    (config.resolve.alias as Record<string, string>)["tailwindcss"] = tailwindcssPath;
    return config;
  },
};

export default nextConfig;
