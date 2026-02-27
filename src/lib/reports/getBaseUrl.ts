export function getBaseUrl(explicit?: string): string {
  const u = (explicit || process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  if (!u) {
    throw new Error("Missing SITE_URL (set to https://www.hairaudit.com)");
  }
  return u.replace(/\/+$/, "");
}

