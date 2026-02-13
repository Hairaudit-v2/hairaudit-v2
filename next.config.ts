import type { NextConfig } from "next";
import path from "path";
import fs from "fs";

// Resolve tailwindcss from project (avoids wrong cwd when workspace root is g:\)
function getTailwindPath(): string {
  const candidates = [
    path.join(process.cwd(), "node_modules", "tailwindcss"),
    path.resolve(path.dirname(require.resolve("./package.json")), "node_modules", "tailwindcss"),
    path.resolve((process.env.SYSTEMDRIVE || "G") + ":/hairaudit-v2/node_modules/tailwindcss"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}
const tailwindcssPath = getTailwindPath();

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
