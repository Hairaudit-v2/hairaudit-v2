import { createBrowserClient } from "@supabase/ssr";

const MISSING_PUBLIC_ENV_MESSAGE =
  "HairAudit is missing public Supabase configuration (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY). Please try again later or contact support.";

function assertPatientPublicSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!url || !anonKey) {
    if (typeof window !== "undefined") {
      console.error("[supabase/client] missing patient-critical public env vars", {
        hasUrl: Boolean(url),
        hasAnonKey: Boolean(anonKey),
      });
    }
    throw new Error(MISSING_PUBLIC_ENV_MESSAGE);
  }
  return { url, anonKey };
}

export function createSupabaseBrowserClient() {
  const { url, anonKey } = assertPatientPublicSupabaseEnv();
  return createBrowserClient(url, anonKey);
}

export { MISSING_PUBLIC_ENV_MESSAGE };
