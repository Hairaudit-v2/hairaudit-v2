import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveAuditorRole } from "@/lib/auth/isAuditor";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const admin = createSupabaseAdminClient();
        const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
        const role = resolveAuditorRole({
          profileRole: profile?.role,
          userMetadataRole: (user.user_metadata as Record<string, unknown>)?.role,
          userEmail: user.email,
        });
        await admin.from("profiles").upsert(
          {
            id: user.id,
            role,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
      }
    } catch {
      // If service role env vars aren't set locally, don't block login.
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`); // Redirects to role-specific dashboard
}
