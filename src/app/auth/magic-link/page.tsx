import { redirect } from "next/navigation";
import MagicLinkClient from "./MagicLinkClient";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function MagicLinkPage({ searchParams }: PageProps) {
  const code = searchParams?.code;
  const codeStr = typeof code === "string" ? code : Array.isArray(code) ? code[0] : undefined;
  if (codeStr) {
    // If Supabase returns an auth `code` query param, exchange it server-side.
    redirect(`/auth/callback?code=${encodeURIComponent(codeStr)}`);
  }

  // Hash-based magic links are handled client-side (access_token/refresh_token in #...).
  return <MagicLinkClient />;
}
