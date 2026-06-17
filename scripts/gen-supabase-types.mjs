/**
 * Generate src/lib/supabase/database.types.ts from a linked Supabase project.
 *
 * Phase 1B: Enhanced error handling and clear instructions for baseline schema capture.
 *
 * This script intentionally fails without credentials — safe for CI (no secrets required).
 *
 * Local / staging (linked project):
 *   npx supabase login
 *   npx supabase link   # uses project ref interactively; not stored in repo
 *   npm run gen:supabase-types
 *
 * Alternative (explicit project ref + access token):
 *   SUPABASE_ACCESS_TOKEN=<personal-access-token> \
 *   SUPABASE_PROJECT_REF=<project-ref> \
 *   npm run gen:supabase-types
 *
 * Output: src/lib/supabase/database.types.ts
 *
 * See: docs/hairaudit-v2-phase-1b-baseline-schema-capture.md
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "src", "lib", "supabase", "database.types.ts");
const projectRef = process.env.SUPABASE_PROJECT_REF?.trim();
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();

function runSupabaseGen(args) {
  const result = spawnSync("npx", ["supabase", ...args], {
    cwd: root,
    encoding: "utf8",
    shell: true,
    env: {
      ...process.env,
      ...(accessToken ? { SUPABASE_ACCESS_TOKEN: accessToken } : {}),
    },
  });
  return result;
}

function printInstructions() {
  console.error(`\n╔══════════════════════════════════════════════════════════════════════════════╗
║  Supabase Type Generation — Authentication Required                            ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  This script generates TypeScript types from your Supabase schema.            ║
║  Types are required for Phase 1B baseline schema capture.                       ║
║                                                                              ║
║  ┌─────────────────────────────────────────────────────────────────────────┐ ║
║  │ OPTION 1: Link a local project (recommended for ongoing development) │ ║
║  └─────────────────────────────────────────────────────────────────────────┘ ║
║                                                                              ║
║    npx supabase login                                                        ║
║    npx supabase link  # provide staging project ref when prompted            ║
║    npm run gen:supabase-types                                                  ║
║                                                                              ║
║  ┌─────────────────────────────────────────────────────────────────────────┐ ║
║  │ OPTION 2: One-off generation with explicit credentials                  │ ║
║  └─────────────────────────────────────────────────────────────────────────┘ ║
║                                                                              ║
║    SUPABASE_ACCESS_TOKEN=<your-token> \\\n║    SUPABASE_PROJECT_REF=<your-project-ref> \\\n║    npm run gen:supabase-types                                                  ║
║                                                                              ║
║  Get your access token: https://supabase.com/dashboard/account/tokens           ║
║  Get your project ref:  https://supabase.com/dashboard/project/_/settings   ║
║                                                                              ║
║  ┌─────────────────────────────────────────────────────────────────────────┐ ║
║  │ FALLBACK: Using partial manual types (Phase 1A)                           │ ║
║  └─────────────────────────────────────────────────────────────────────────┘ ║
║                                                                              ║
║  Until types are generated, the app uses fallback types from:                 ║
║    src/lib/hairaudit/tableTypes.ts                                            ║
║    src/lib/hairaudit/generatedTypeBridge.ts                                   ║
║                                                                              ║
║  See: docs/hairaudit-v2-phase-1b-baseline-schema-capture.md                   ║
╚══════════════════════════════════════════════════════════════════════════════╝\n`);
}

function printBlocker(message) {
  console.error("\n[gen:supabase-types] FAILED: Cannot generate types without live Supabase credentials.\n");
  console.error(message);
  printInstructions();
  process.exit(1);
}

function validateGeneratedTypes(source) {
  // Safety check: ensure we have meaningful content
  if (!source || source.trim().length < 100) {
    return { valid: false, reason: "Generated content too short (likely empty response)" };
  }

  // Must contain the Database export
  if (!source.includes("export type Database")) {
    return { valid: false, reason: "Missing 'export type Database' in generated types" };
  }

  // Must contain at least the core tables we expect
  const requiredTables = ["cases", "reports", "uploads"];
  const missingTables = requiredTables.filter(t => !source.includes(`"${t}"`));
  if (missingTables.length > 0) {
    return { valid: false, reason: `Missing expected tables: ${missingTables.join(", ")}` };
  }

  return { valid: true };
}

// Ensure output directory exists
const outDir = dirname(outPath);
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

// Determine generation mode
let genArgs;
let modeDescription;

if (projectRef && accessToken) {
  genArgs = ["gen", "types", "typescript", "--project-id", projectRef];
  modeDescription = "explicit credentials (SUPABASE_PROJECT_REF + SUPABASE_ACCESS_TOKEN)";
} else if (projectRef) {
  genArgs = ["gen", "types", "typescript", "--project-id", projectRef];
  modeDescription = "explicit project ref (SUPABASE_PROJECT_REF)";
} else {
  // Requires `supabase link` in this repo (writes supabase/.temp/project-ref locally; not committed).
  genArgs = ["gen", "types", "typescript", "--linked"];
  modeDescription = "linked project (--linked)";
}

console.info(`[gen:supabase-types] Mode: ${modeDescription}`);

// Run generation
const gen = runSupabaseGen(genArgs);

// Handle CLI failure
if (gen.status !== 0) {
  const stderr = (gen.stderr || "").trim();
  const stdout = (gen.stdout || "").trim();

  // Common error patterns with specific guidance
  if (stderr.includes("not authenticated") || stderr.includes("access token")) {
    printBlocker("Supabase CLI is not authenticated.\n\nRun: npx supabase login");
  }

  if (stderr.includes("not linked") || stderr.includes("project ref")) {
    printBlocker(
      "No Supabase project linked to this repository.\n\n" +
      "Run: npx supabase link\n" +
      "Or set SUPABASE_PROJECT_REF environment variable."
    );
  }

  if (stderr.includes("401") || stderr.includes("Unauthorized")) {
    printBlocker(
      "Access denied to Supabase project.\n\n" +
      "Verify your access token has not expired:\n" +
      "  https://supabase.com/dashboard/account/tokens\n\n" +
      "Verify the project ref is correct:\n" +
      "  https://supabase.com/dashboard/project/_/settings"
    );
  }

  printBlocker(
    [
      "Attempted: npx supabase " + genArgs.join(" "),
      "",
      stderr || stdout || "supabase CLI exited with non-zero status",
    ].join("\n")
  );
}

// Validate output before writing
const typesSource = gen.stdout;
const validation = validateGeneratedTypes(typesSource);

if (!validation.valid) {
  printBlocker(
    `Generated types validation failed: ${validation.reason}\n\n` +
    "The Supabase CLI returned unexpected content.\n" +
    "Check CLI version: npx supabase --version"
  );
}

// Safety: never overwrite with smaller file (indicates corruption)
if (existsSync(outPath)) {
  const existingSize = statSync(outPath).size;
  const newSize = Buffer.byteLength(typesSource, "utf8");

  if (newSize < existingSize * 0.5) {
    printBlocker(
      `Generated types file (${newSize} bytes) is much smaller than existing (${existingSize} bytes).\n\n` +
      "This may indicate a CLI error or schema change.\n" +
      "Delete the existing file manually if this is intentional:\n" +
      `  rm ${outPath}`
    );
  }
}

// Write the generated types
const header = `// Generated by npm run gen:supabase-types — do not edit manually.
// Source: Supabase project (${modeDescription})
// Generated: ${new Date().toISOString()}
// Phase: 1B Baseline Schema Capture
//
// Regenerate after schema migrations are applied to the linked Supabase project.
// See: docs/hairaudit-v2-phase-1b-baseline-schema-capture.md

`;

writeFileSync(outPath, header + typesSource, "utf8");
console.info(`[gen:supabase-types] SUCCESS: Wrote ${outPath}`);
console.info(`[gen:supabase-types] Size: ${Buffer.byteLength(typesSource, "utf8")} bytes`);
console.info(`[gen:supabase-types] Next steps:`);
console.info(`  1. Run: npm run typecheck`);
console.info(`  2. Run: npm run test:schema-phase1a`);
console.info(`  3. Commit ${outPath}`);
