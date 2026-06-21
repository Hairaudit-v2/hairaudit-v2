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

const fiUiEntry = path.join(process.cwd(), "src", "lib", "fi-ui", "network-ui.ts");

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/sample-report",
        destination: "/demo-report",
        permanent: true,
      },
    ];
  },
  serverExternalPackages: [
    "pdfkit",
    "@supabase/supabase-js",
    "@supabase/ssr",
    "inngest",
    "openai",
    "sharp",
    "@sparticuz/chromium",
    "playwright-core",
  ],
  outputFileTracingIncludes: {
    "/api/internal/render-pdf": [
      "./node_modules/@sparticuz/chromium/bin/**",
      "./node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/bin/**",
    ],
    "/api/reports/demo-pdf": [
      "./node_modules/@sparticuz/chromium/bin/**",
      "./node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/bin/**",
    ],
  },
  outputFileTracingExcludes: {
    "/api/internal/render-pdf": [
      "./public/training/doctors/**",
      "./public/post-operative-hair-protection-guide.pdf",
    ],
    "**": ["scripts/output/**"],
  },
  turbopack: {
    resolveAlias: {
      tailwindcss: tailwindcssPath,
      "@/packages/ui": fiUiEntry,
    },
  },
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.alias ??= {};
    const aliases = config.resolve.alias as Record<string, string>;
    aliases["tailwindcss"] = tailwindcssPath;
    aliases["@/packages/ui"] = fiUiEntry;
    return config;
  },
};

export default nextConfig;
