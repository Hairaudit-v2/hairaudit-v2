import { createClient } from "@supabase/supabase-js";

function resolveSupabaseUrl(): string | undefined {
  const fromPublic = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const fromEnv = process.env.SUPABASE_URL?.trim();
  return fromPublic || fromEnv || undefined;
}

function resolveServiceRoleKey(): string | undefined {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return key || undefined;
}

export function canCreateSupabaseAdminClient(): boolean {
  return Boolean(resolveSupabaseUrl() && resolveServiceRoleKey());
}

export function tryCreateSupabaseAdminClient() {
  const url = resolveSupabaseUrl();
  const key = resolveServiceRoleKey();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function createSupabaseAdminClient() {
  const url = resolveSupabaseUrl();
  const key = resolveServiceRoleKey();
  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY). Check Vercel project settings."
    );
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
