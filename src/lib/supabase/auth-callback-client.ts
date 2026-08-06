import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Cookie-aware Supabase server client for Route Handlers that must attach
 * session cookies to a concrete NextResponse (redirect OR JSON).
 *
 * Using `cookies().set()` alone can drop Set-Cookie on some App Router paths;
 * writing onto the returned response is the durable pattern for OAuth exchange
 * and anonymous `signInAnonymously` during pathway start.
 */
export function createResponseCookieSupabaseClient(request: NextRequest) {
  const pending = new Map<string, CookieToSet>();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const merged = new Map<string, { name: string; value: string }>();
          for (const c of request.cookies.getAll()) {
            merged.set(c.name, { name: c.name, value: c.value });
          }
          for (const [name, c] of pending) {
            merged.set(name, { name: c.name, value: c.value });
          }
          return Array.from(merged.values());
        },
        setAll(cookiesToSet) {
          for (const c of cookiesToSet) {
            pending.set(c.name, c);
            try {
              request.cookies.set(c.name, c.value);
            } catch {
              /* ignore immutable request cookie jar in some runtimes */
            }
          }
        },
      },
    }
  );

  function applyCookies(response: NextResponse): NextResponse {
    for (const { name, value, options } of pending.values()) {
      response.cookies.set(name, value, options);
    }
    return response;
  }

  return { supabase, applyCookies, pendingCookieCount: () => pending.size };
}

/** @deprecated Prefer {@link createResponseCookieSupabaseClient} */
export const createAuthCallbackSupabaseClient = createResponseCookieSupabaseClient;
