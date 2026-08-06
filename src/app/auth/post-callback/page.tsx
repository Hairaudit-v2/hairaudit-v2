"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { sanitizeNextPath } from "@/lib/auth/redirects";
import { resolvePostAuthRedirect } from "@/lib/auth/resolvePostAuthRedirect";
import { trackAuthFunnel } from "@/lib/analytics/authFunnel";
import { completeAuthWithOptionalClaim } from "@/lib/nexus/claimAccountAfterAuth";
import { readPersistedClaimToken } from "@/lib/nexus/claimTokenClient";
import { parseRole, type UserRole } from "@/lib/roles";

type ProfileProbe = {
  authenticated?: boolean;
  role?: string;
  profile?: { role?: string; rowPresent?: boolean } | null;
};

async function fetchResolvedRole(): Promise<{ role: UserRole | null; profileReady: boolean }> {
  try {
    const res = await fetch("/api/profiles");
    if (!res.ok) return { role: null, profileReady: false };
    const data = (await res.json().catch(() => null)) as ProfileProbe | null;
    if (!data || data.authenticated === false) {
      return { role: null, profileReady: true };
    }
    const raw = data.role ?? data.profile?.role ?? null;
    if (raw == null || raw === "") {
      // Authenticated but no resolvable role — ready, not loading (do not invent patient).
      return { role: null, profileReady: true };
    }
    return { role: parseRole(raw), profileReady: true };
  } catch {
    return { role: null, profileReady: false };
  }
}

function PostCallbackInner() {
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [statusMessage, setStatusMessage] = useState("Signing you in…");

  useEffect(() => {
    const nextRaw = searchParams.get("next");
    const nextPath = sanitizeNextPath(nextRaw) ?? "/dashboard";
    const pathname = window.location.pathname;
    const search = window.location.search;

    const handoff = searchParams.get("handoff") ?? "";
    const lockKey = handoff ? `hairaudit:auth_handoff:${handoff}` : "";
    let skipTrack = false;
    if (lockKey) {
      try {
        if (sessionStorage.getItem(lockKey)) skipTrack = true;
        else sessionStorage.setItem(lockKey, "1");
      } catch {
        /* continue without dedupe */
      }
    }

    if (!skipTrack) {
      trackAuthFunnel(
        "auth_callback_view",
        { auth_exchange: "server_code_handoff", auth_next: nextPath },
        { pathname, search }
      );
    }

    let cancelled = false;

    void (async () => {
      // Brief retry: cookies from the code-exchange redirect may still be settling.
      let session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        await new Promise((r) => setTimeout(r, 150));
        if (cancelled) return;
        session = (await supabase.auth.getSession()).data.session;
      }

      if (!skipTrack) {
        if (session) {
          trackAuthFunnel(
            "auth_session_success",
            { auth_exchange: "server_code_handoff", auth_next: nextPath },
            { pathname, search }
          );
        } else {
          trackAuthFunnel(
            "auth_session_failed",
            {
              auth_exchange: "server_code_handoff",
              auth_reason: "no_session_after_handoff",
              auth_next: nextPath,
            },
            { pathname, search }
          );
        }
      }

      if (!session) {
        // Do not navigate to dashboard/patient without a live session.
        console.info("[auth-probe] post_callback", {
          pathname,
          authUserPresent: false,
          profilePresent: null,
          resolvedRole: null,
          requestedNextPath: nextPath,
          callbackExchangeSucceeded: true,
          redirectDecision: "/login?error=auth_session_missing",
          redirectReason: "no_session_after_handoff",
          probeKind: "auth_fault",
        });
        window.location.replace("/login?error=auth_session_missing");
        return;
      }

      const claimToken = readPersistedClaimToken();
      if (claimToken) {
        setStatusMessage("Activating your doctor account…");
        const claimResult = await completeAuthWithOptionalClaim({
          persistedToken: claimToken,
          defaultRedirect: nextPath,
        });
        if (cancelled) return;
        if (!claimResult.ok) {
          const params = new URLSearchParams({ claim_error: "1" });
          window.location.replace(`/login?${params.toString()}`);
          return;
        }
        if (!skipTrack) {
          trackAuthFunnel(
            "auth_dashboard_redirect_success",
            { auth_target: claimResult.redirectPath },
            { pathname, search }
          );
        }
        window.location.replace(claimResult.redirectPath);
        return;
      }

      setStatusMessage("Confirming your account…");
      let roleResult = await fetchResolvedRole();
      if (cancelled) return;

      // One short retry if profile/role is still hydrating.
      if (!roleResult.profileReady || roleResult.role == null) {
        await new Promise((r) => setTimeout(r, 200));
        if (cancelled) return;
        roleResult = await fetchResolvedRole();
      }

      const decision = resolvePostAuthRedirect({
        requestedNextPath: nextPath,
        resolvedRole: roleResult.role,
        profileReady: roleResult.profileReady,
      });

      if ("wait" in decision) {
        // Session exists but role still unresolved after retry — controlled state, not patient.
        console.info("[auth-probe] post_callback", {
          pathname,
          authUserPresent: true,
          profilePresent: roleResult.profileReady,
          resolvedRole: roleResult.role,
          requestedNextPath: nextPath,
          callbackExchangeSucceeded: true,
          redirectDecision: "/beta-access-message",
          redirectReason: decision.reason,
          probeKind: "post_callback",
        });
        if (!skipTrack) {
          trackAuthFunnel(
            "auth_dashboard_redirect_success",
            { auth_target: "/beta-access-message", auth_reason: decision.reason },
            { pathname, search }
          );
        }
        window.location.replace("/beta-access-message");
        return;
      }

      const targetPath = decision.path;
      const reason = decision.reason;

      console.info("[auth-probe] post_callback", {
        pathname,
        authUserPresent: true,
        profilePresent: roleResult.profileReady,
        resolvedRole: roleResult.role,
        requestedNextPath: nextPath,
        callbackExchangeSucceeded: true,
        redirectDecision: targetPath,
        redirectReason: reason,
        probeKind: "post_callback",
      });

      if (!skipTrack) {
        trackAuthFunnel(
          "auth_dashboard_redirect_success",
          { auth_target: targetPath },
          { pathname, search }
        );
      }
      window.location.replace(targetPath);
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, supabase]);

  return (
    <main className="flex min-h-[40vh] flex-col items-center justify-center px-4">
      <p className="text-sm text-slate-600">{statusMessage}</p>
    </main>
  );
}

export default function AuthPostCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[40vh] flex-col items-center justify-center px-4">
          <p className="text-sm text-slate-600">Signing you in…</p>
        </main>
      }
    >
      <PostCallbackInner />
    </Suspense>
  );
}
