"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { useI18n } from "@/components/i18n/I18nProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { trackAuthFunnel } from "@/lib/analytics/authFunnel";

export default function MagicLinkClient() {
  const { t } = useI18n();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [msg, setMsg] = useState(() => t("auth.magicLink.signingIn"));
  const pathCtx = useRef<{ pathname: string; search: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    const pathname = window.location.pathname;
    const search = window.location.search;
    pathCtx.current = { pathname, search };
    trackAuthFunnel(
      "auth_callback_view",
      { auth_exchange: "hash_fragment", auth_surface: "magic_link" },
      { pathname, search }
    );

    async function completeMagicLink() {
      const ctx = pathCtx.current ?? { pathname, search };
      const existing = await supabase.auth.getSession();
      if (existing.data.session) {
        trackAuthFunnel(
          "auth_session_success",
          { auth_exchange: "existing_session", auth_surface: "magic_link" },
          ctx
        );
        trackAuthFunnel(
          "auth_dashboard_redirect_success",
          { auth_target: "/dashboard", auth_surface: "magic_link" },
          ctx
        );
        // /dashboard redirects to role-specific dashboard (clinic/doctor/auditor/patient)
        window.location.replace("/dashboard");
        return;
      }

      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!error) {
          trackAuthFunnel(
            "auth_session_success",
            { auth_exchange: "hash_fragment", auth_surface: "magic_link" },
            ctx
          );
          trackAuthFunnel(
            "auth_dashboard_redirect_success",
            { auth_target: "/dashboard", auth_surface: "magic_link" },
            ctx
          );
          // /dashboard applies role-based redirect (clinic/doctor/auditor/patient)
          window.location.replace("/dashboard");
          return;
        }
      }

      if (mounted) {
        trackAuthFunnel(
          "auth_session_failed",
          { auth_reason: "invalid_or_expired_magic_link", auth_surface: "magic_link" },
          ctx
        );
        setMsg(t("auth.magicLink.invalidOrExpired"));
      }
    }

    completeMagicLink();
    return () => {
      mounted = false;
    };
  }, [supabase, t]);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader variant="minimal" />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">{t("auth.magicLink.title")}</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{msg}</p>
          <div className="mt-6">
            <Link href="/login" className="text-sm font-medium text-amber-600 hover:text-amber-500">
              {t("auth.magicLink.backToLogin")}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

