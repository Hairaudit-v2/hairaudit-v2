import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveAuditorRole } from "@/lib/auth/isAuditor";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      console.error("[auth/callback] exchangeCodeForSession failed", {
        message: exchangeError.message,
        status: (exchangeError as { status?: number }).status,
      });
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) {
        console.error("[auth/callback] supabase.auth.getUser failed", {
          message: userError.message,
          status: (userError as { status?: number }).status,
        });
      }
      if (user) {
        const admin = createSupabaseAdminClient();
        const { data: profile, error: profileReadError } = await admin
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        if (profileReadError) {
          console.error("[auth/callback] failed reading profile role", {
            userId: user.id,
            message: profileReadError.message,
          });
        }
        const role = resolveAuditorRole({
          profileRole: profile?.role,
          userMetadataRole: (user.user_metadata as Record<string, unknown>)?.role,
          userEmail: user.email,
        });
        const { error: upsertError } = await admin.from("profiles").upsert(
          {
            id: user.id,
            role,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
        if (upsertError) {
          console.error("[auth/callback] failed upserting profile", {
            userId: user.id,
            role,
            message: upsertError.message,
          });
        }
      }
    } catch (error) {
      // If service role env vars aren't set locally, don't block login.
      console.error("[auth/callback] non-blocking profile sync failure", {
        error,
      });
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`); // Redirects to role-specific dashboard
}
