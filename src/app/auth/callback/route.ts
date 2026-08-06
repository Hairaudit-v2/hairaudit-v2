import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";
import { sanitizeNextPath, dashboardPathForRole } from "@/lib/auth/redirects";
import { parseRole, type UserRole } from "@/lib/roles";
import { defaultPathAfterAuthNoNext, finalizeAuthCallbackRedirect } from "@/lib/academy/postLoginRedirect";
import { createAuthCallbackSupabaseClient } from "@/lib/supabase/auth-callback-client";
import { logAuthProbe } from "@/lib/auth/authProbeLog";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const signupRole = parseRole(searchParams.get("signup_role"));
  const nextParam = sanitizeNextPath(searchParams.get("next"));
  let redirectPath =
    nextParam ??
    (signupRole === "clinic" ? "/dashboard/clinic" : signupRole === "doctor" ? "/dashboard/doctor" : "/dashboard");
  let redirectReason: string = nextParam
    ? "explicit_next"
    : signupRole === "clinic" || signupRole === "doctor"
      ? "signup_role_default"
      : "generic_dashboard";

  if (code) {
    const { supabase, applyCookies, pendingCookieCount } = createAuthCallbackSupabaseClient(request);
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("[auth/callback] exchangeCodeForSession failed", {
        message: exchangeError.message,
        status: (exchangeError as { status?: number }).status,
      });
      logAuthProbe("auth_callback", {
        pathname: "/auth/callback",
        authUserPresent: false,
        profilePresent: false,
        requestedNextPath: nextParam,
        callbackExchangeSucceeded: false,
        redirectDecision: "/login?error=auth_callback_failed",
        redirectReason: "exchange_failed",
        probeKind: "auth_fault",
      });
      return applyCookies(NextResponse.redirect(`${origin}/login?error=auth_callback_failed`));
    }

    let authUserPresent = false;
    let profilePresent: boolean | null = null;
    let resolvedRole: string | null = null;

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
      authUserPresent = Boolean(user);
      if (user) {
        const admin = createSupabaseAdminClient();
        const { data: existingProfile } = await admin
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        profilePresent = Boolean(existingProfile);
        const metadataRole = parseRole((user.user_metadata as Record<string, unknown> | undefined)?.role);
        const existingRole = parseRole(existingProfile?.role);
        const role = isAuditor({ profileRole: existingProfile?.role, userEmail: user.email })
          ? "auditor"
          : existingProfile?.role
            ? existingRole
            : metadataRole === "patient"
              ? signupRole
              : metadataRole;
        resolvedRole = role;
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
        if (!nextParam) {
          redirectPath = await defaultPathAfterAuthNoNext(admin, user.id, role as UserRole);
          redirectReason = "role_default_no_next";
        }
        const finalized = await finalizeAuthCallbackRedirect(admin, user.id, redirectPath, role as UserRole);
        if (finalized !== redirectPath) {
          redirectPath = finalized;
          redirectReason = "academy_finalize";
        }
        // Prefer canonical role dashboard over generic /dashboard once role is known.
        if (redirectPath === "/dashboard" && role) {
          redirectPath = dashboardPathForRole(role as UserRole);
          redirectReason = "canonical_role_dashboard";
        }
      }
    } catch (error) {
      // If service role env vars aren't set locally, don't block login.
      console.error("[auth/callback] non-blocking profile sync failure", {
        error,
      });
    }

    const handoff = crypto.randomUUID();
    const post = new URL("/auth/post-callback", origin);
    post.searchParams.set("next", redirectPath);
    post.searchParams.set("handoff", handoff);

    logAuthProbe("auth_callback", {
      pathname: "/auth/callback",
      authUserPresent,
      profilePresent,
      resolvedRole,
      requestedNextPath: nextParam,
      callbackExchangeSucceeded: true,
      redirectDecision: `/auth/post-callback?next=${redirectPath}`,
      redirectReason,
      probeKind: "callback",
    });

    if (pendingCookieCount() === 0) {
      console.error("[auth/callback] exchange succeeded but no session cookies were queued");
    }

    return applyCookies(NextResponse.redirect(post.toString()));
  }

  logAuthProbe("auth_callback", {
    pathname: "/auth/callback",
    authUserPresent: false,
    requestedNextPath: nextParam,
    callbackExchangeSucceeded: null,
    redirectDecision: redirectPath,
    redirectReason: "no_code",
    probeKind: "callback",
  });

  return NextResponse.redirect(`${origin}${redirectPath}`);
}
