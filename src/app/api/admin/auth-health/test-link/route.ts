import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";
import { getCanonicalAppUrl } from "@/lib/auth/redirects";

type LinkCheckResult = {
  id: string;
  label: string;
  redirectTo: string;
  ok: boolean;
  detail: string;
};

export async function POST(req: Request) {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!isAuditor({ profileRole: profile?.role, userEmail: user.email })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const requestedEmail = String(body?.email ?? "").trim().toLowerCase();
  const targetEmail = requestedEmail || String(user.email ?? "").trim().toLowerCase();
  if (!targetEmail) {
    return NextResponse.json({ error: "Missing test email" }, { status: 400 });
  }

  const baseUrl = getCanonicalAppUrl();
  const redirects = [
    { id: "callback", label: "Signup callback redirect", redirectTo: `${baseUrl}/auth/callback?signup_role=clinic&next=${encodeURIComponent("/dashboard/clinic")}` },
    { id: "magic", label: "Magic-link redirect", redirectTo: `${baseUrl}/auth/callback` },
    { id: "recovery", label: "Recovery redirect", redirectTo: `${baseUrl}/auth/recovery` },
  ];

  const results: LinkCheckResult[] = [];
  for (const entry of redirects) {
    try {
      const { data, error } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: targetEmail,
        options: { redirectTo: entry.redirectTo },
      });

      if (error) {
        results.push({
          id: entry.id,
          label: entry.label,
          redirectTo: entry.redirectTo,
          ok: false,
          detail: error.message,
        });
        continue;
      }

      const accepted = Boolean(data?.properties?.action_link);
      results.push({
        id: entry.id,
        label: entry.label,
        redirectTo: entry.redirectTo,
        ok: accepted,
        detail: accepted
          ? "Supabase accepted redirect target and generated an action link."
          : "No action link returned.",
      });
    } catch (error: unknown) {
      results.push({
        id: entry.id,
        label: entry.label,
        redirectTo: entry.redirectTo,
        ok: false,
        detail: (error as Error)?.message ?? "Unknown error",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    note: "No emails were sent. This uses admin.generateLink to validate redirect acceptance.",
    testEmail: targetEmail,
    results,
  });
}
