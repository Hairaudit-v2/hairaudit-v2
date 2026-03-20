"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { useI18n } from "@/components/i18n/I18nProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function MagicLinkClient() {
  const { t } = useI18n();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [msg, setMsg] = useState(() => t("auth.magicLink.signingIn"));

  useEffect(() => {
    let mounted = true;

    async function completeMagicLink() {
      const existing = await supabase.auth.getSession();
      if (existing.data.session) {
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
          // /dashboard applies role-based redirect (clinic/doctor/auditor/patient)
          window.location.replace("/dashboard");
          return;
        }
      }

      if (mounted) {
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

