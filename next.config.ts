import type { NextConfig } from "next";
import path from "path";
import fs from "fs";

// Resolve tailwindcss from project. On Vercel/CI, process.cwd() is correct.
function getTailwindPath(): string {
  const base = path.join(process.cwd(), "node_modules", "tailwindcss");
  const candidates: string[] = [base];
  try {
    candidates.push(path.dirname(require.resolve("tailwindcss/package.json")));
  } catch {
    // tailwindcss not yet resolved
  }
  if (process.platform === "win32") {
    candidates.push(path.resolve((process.env.SYSTEMDRIVE || "G") + ":/hairaudit-v2/node_modules/tailwindcss"));
  }
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return base;
}
const tailwindcssPath = getTailwindPath();

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit", "@supabase/supabase-js", "@supabase/ssr", "inngest", "openai"],
  outputFileTracingExcludes: {
    "**": ["scripts/output/**"],
  },
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
