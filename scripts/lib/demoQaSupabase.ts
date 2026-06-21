/**
 * Supabase admin client for demo QA seed scripts.
 * Supports optional dev-only TLS bypass when Windows SSL inspection breaks Node fetch.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { canCreateSupabaseAdminClient, createSupabaseAdminClient } from "../../src/lib/supabase/admin";

export function isDemoSeedInsecureTlsEnabled(): boolean {
  return (
    process.env.DEMO_SEED_INSECURE_TLS === "true" ||
    process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0"
  );
}

/** Apply Node-wide TLS bypass for local seed runs only (explicit opt-in). */
export function applyDemoSeedInsecureTlsIfRequested(): void {
  if (process.env.DEMO_SEED_INSECURE_TLS === "true" && process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    console.warn(
      "[demo-qa-seed] TLS verification disabled via DEMO_SEED_INSECURE_TLS. Local/dev seed runs only."
    );
  }
}

export function createDemoSeedSupabaseClient(): SupabaseClient | null {
  if (!canCreateSupabaseAdminClient()) return null;
  return createSupabaseAdminClient();
}

export function formatDemoSeedTlsHelp(): string {
  return [
    "Unable to reach Supabase — TLS certificate verification failed.",
    "This is common on Windows when antivirus or a corporate proxy re-signs HTTPS traffic.",
    "",
    "Fix options (local/dev only):",
    "  1. PowerShell: $env:DEMO_SEED_INSECURE_TLS='true'; npm run seed:demo-qa",
    "  2. Or add your corporate root CA: set NODE_EXTRA_CA_CERTS to the .pem path",
    "  3. Or use local Supabase: supabase start, then point .env.local to http://127.0.0.1:54321",
  ].join("\n");
}

function isTlsVerificationError(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    const code = (current as { code?: string })?.code;
    const message = String((current as Error)?.message ?? current);
    if (
      code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
      code === "SELF_SIGNED_CERT_IN_CHAIN" ||
      message.includes("unable to verify the first certificate")
    ) {
      return true;
    }
    current = (current as { cause?: unknown })?.cause;
  }
  return false;
}

/** Probe Auth API; throws a friendly error when TLS verification fails. */
export async function assertDemoSeedSupabaseReachable(supabase: SupabaseClient): Promise<void> {
  try {
    const { error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error?.message?.toLowerCase().includes("fetch failed")) {
      throw error;
    }
    if (error) {
      throw new Error(`Supabase auth probe failed: ${error.message}`);
    }
  } catch (err) {
    if (isTlsVerificationError(err)) {
      throw new Error(formatDemoSeedTlsHelp());
    }
    const message = String((err as Error)?.message ?? err);
    if (message.toLowerCase().includes("fetch failed")) {
      throw new Error(formatDemoSeedTlsHelp());
    }
    throw err;
  }
}
