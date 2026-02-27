export function getBaseUrl(explicit?: string): string {
  const pick =
    (explicit || "").trim() ||
    (process.env.SITE_URL || "").trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    (process.env.NEXT_PUBLIC_SITE_URL || "").trim();

  if (!pick) {
    throw new Error("Missing SITE_URL (set to https://www.hairaudit.com)");
  }

  return pick.replace(/\/+$/, "");
}


