import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";
import { sanitizeNextPath, dashboardPathForRole } from "@/lib/auth/redirects";
import { parseRole } from "@/lib/roles";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const signupRole = parseRole(searchParams.get("signup_role"));
  const nextParam = sanitizeNextPath(searchParams.get("next"));
  let redirectPath =
    nextParam ?? (signupRole === "clinic" ? "/dashboard/clinic" : signupRole === "doctor" ? "/dashboard/doctor" : "/dashboard");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      console.error("[auth/callback] exchangeCodeForSession failed", {
        message: exchangeError.message,
        status: (exchangeError as { status?: number }).status,
      });
      const errorUrl = `${origin}/login?error=auth_callback_failed`;
      return NextResponse.redirect(errorUrl);
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
        const { data: existingProfile } = await admin
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        const metadataRole = parseRole((user.user_metadata as Record<string, unknown> | undefined)?.role);
        const existingRole = parseRole(existingProfile?.role);
        const role = isAuditor({ profileRole: existingProfile?.role, userEmail: user.email })
          ? "auditor"
          : (existingProfile?.role ? existingRole : (metadataRole === "patient" ? signupRole : metadataRole));
        const { error: upsertError } = await admin.from("profiles").upsert(
          {
            id: user.id,
            role,
            email: user.email,
            name:
              (user.user_metadata as Record<string, unknown> | undefined)?.full_name ??
              (user.user_metadata as Record<string, unknown> | undefined)?.name ??
              null,
          },
          { onConflict: "id" }
        );
        if (upsertError) {
          console.error("[auth/callback] failed upserting profile", {
            userId: user.id,
            message: upsertError.message,
          });
        }
        if (!nextParam) redirectPath = dashboardPathForRole(role);
      }
    } catch (error) {
      // If service role env vars aren't set locally, don't block login.
      console.error("[auth/callback] non-blocking profile sync failure", {
        error,
      });
    }
  }

  return NextResponse.redirect(`${origin}${redirectPath}`);
}
