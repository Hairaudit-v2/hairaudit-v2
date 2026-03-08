type GlobalWithAuthEnvCheck = typeof globalThis & {
  __hairauditAuthEnvCheckLogged?: boolean;
};

/**
 * Logs auth-related env health once per server runtime.
 * Keeps signup issues visible without crashing requests.
 */
export function logAuthEnvHealthOnce() {
  const globalWithFlag = globalThis as GlobalWithAuthEnvCheck;
  if (globalWithFlag.__hairauditAuthEnvCheckLogged) return;
  globalWithFlag.__hairauditAuthEnvCheckLogged = true;

  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ] as const;

  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error("[auth/env] missing required auth env vars", { missing });
  }

  if (!process.env.NEXT_PUBLIC_APP_URL) {
    console.warn("[auth/env] NEXT_PUBLIC_APP_URL is missing; signup redirects fall back to https://hairaudit.com.");
  } else {
    try {
      const parsed = new URL(process.env.NEXT_PUBLIC_APP_URL);
      const looksLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
      if (process.env.NODE_ENV === "production" && looksLocalhost) {
        console.error("[auth/env] NEXT_PUBLIC_APP_URL points to localhost in production.", {
          value: process.env.NEXT_PUBLIC_APP_URL,
        });
      }
    } catch {
      console.error("[auth/env] NEXT_PUBLIC_APP_URL is not a valid absolute URL.", {
        value: process.env.NEXT_PUBLIC_APP_URL,
      });
    }
  }
}
