"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { sanitizeNextPath } from "@/lib/auth/redirects";
import { trackAuthFunnel } from "@/lib/analytics/authFunnel";
import { completeAuthWithOptionalClaim } from "@/lib/nexus/claimAccountAfterAuth";
import { readPersistedClaimToken } from "@/lib/nexus/claimTokenClient";

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

    supabase.auth.getSession().then(async ({ data }) => {
      if (!skipTrack) {
        if (data.session) {
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

      const claimToken = readPersistedClaimToken();
      if (data.session && claimToken) {
        setStatusMessage("Activating your doctor account…");
        const claimResult = await completeAuthWithOptionalClaim({
          persistedToken: claimToken,
          defaultRedirect: nextPath,
        });
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

      if (!skipTrack) {
        trackAuthFunnel(
          "auth_dashboard_redirect_success",
          { auth_target: nextPath },
          { pathname, search }
        );
      }
      window.location.replace(nextPath);
    });
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
