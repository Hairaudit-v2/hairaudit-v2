import { SITE_URL } from "@/lib/constants";

export type HealthLevel = "pass" | "warn" | "fail";

export type AuthHealthCheck = {
  id: string;
  label: string;
  level: HealthLevel;
  value: string;
  detail: string;
};

function asClean(value: string | undefined | null): string {
  return String(value ?? "").trim();
}

function appBaseUrl() {
  const nextPublic = asClean(process.env.NEXT_PUBLIC_APP_URL).replace(/\/+$/, "");
  const site = asClean(process.env.SITE_URL).replace(/\/+$/, "");
  return nextPublic || site || SITE_URL;
}

export function runAuthConfigHealthChecks(): {
  baseUrl: string;
  callbackUrl: string;
  magicLinkUrl: string;
  recoveryUrl: string;
  checks: AuthHealthCheck[];
  templateReminder: string[];
} {
  const baseUrl = appBaseUrl();
  const callbackUrl = `${baseUrl}/auth/callback`;
  // Magic-link flows may return either hash tokens or an auth `code`.
  // Route through /auth/callback so the server can always exchange the code.
  const magicLinkUrl = `${baseUrl}/auth/callback`;
  const recoveryUrl = `${baseUrl}/auth/recovery`;

  const hasPublicAppUrl = Boolean(asClean(process.env.NEXT_PUBLIC_APP_URL));
  const hasSupabaseUrl = Boolean(asClean(process.env.NEXT_PUBLIC_SUPABASE_URL));
  const hasAnon = Boolean(asClean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
  const hasServiceRole = Boolean(asClean(process.env.SUPABASE_SERVICE_ROLE_KEY));
  const isHttps = /^https:\/\//i.test(baseUrl);

  const checks: AuthHealthCheck[] = [
    {
      id: "app-url",
      label: "App base URL configured",
      level: hasPublicAppUrl ? "pass" : "warn",
      value: hasPublicAppUrl ? "Configured" : "Fallback in use",
      detail: hasPublicAppUrl
        ? `Using NEXT_PUBLIC_APP_URL: ${baseUrl}`
        : `NEXT_PUBLIC_APP_URL is missing. Signup currently falls back to ${baseUrl}.`,
    },
    {
      id: "https",
      label: "Secure HTTPS base URL",
      level: isHttps ? "pass" : "fail",
      value: baseUrl,
      detail: isHttps
        ? "Auth email redirects use HTTPS."
        : "Base URL is not HTTPS. Confirmation links may be blocked or unsafe.",
    },
    {
      id: "supabase-url",
      label: "Supabase project URL present",
      level: hasSupabaseUrl ? "pass" : "fail",
      value: hasSupabaseUrl ? "Configured" : "Missing",
      detail: hasSupabaseUrl
        ? "NEXT_PUBLIC_SUPABASE_URL is available."
        : "Missing NEXT_PUBLIC_SUPABASE_URL blocks auth flows.",
    },
    {
      id: "anon-key",
      label: "Supabase anon key present",
      level: hasAnon ? "pass" : "fail",
      value: hasAnon ? "Configured" : "Missing",
      detail: hasAnon
        ? "NEXT_PUBLIC_SUPABASE_ANON_KEY is available for browser auth."
        : "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY blocks browser signup/signin.",
    },
    {
      id: "service-role",
      label: "Service role key present",
      level: hasServiceRole ? "pass" : "warn",
      value: hasServiceRole ? "Configured" : "Missing",
      detail: hasServiceRole
        ? "Server-side profile sync and admin checks can run."
        : "Missing SUPABASE_SERVICE_ROLE_KEY may break callback/profile sync in some environments.",
    },
    {
      id: "redirects",
      label: "Expected redirect targets",
      level: "warn",
      value: "Manual Supabase dashboard check required",
      detail: `Confirm allowlist includes: ${callbackUrl}, ${magicLinkUrl}, ${recoveryUrl}`,
    },
    {
      id: "template",
      label: "Confirm-signup email template",
      level: "warn",
      value: "Manual Supabase dashboard check required",
      detail:
        "Blank emails usually mean template content is empty or missing {{ .ConfirmationURL }}.",
    },
  ];

  return {
    baseUrl,
    callbackUrl,
    magicLinkUrl,
    recoveryUrl,
    checks,
    templateReminder: [
      "Auth > Email Templates > Confirm signup",
      "Template must include {{ .ConfirmationURL }}",
      "Ensure subject/body are not blank",
      "Auth > URL Configuration should include all redirect URLs shown above",
    ],
  };
}
