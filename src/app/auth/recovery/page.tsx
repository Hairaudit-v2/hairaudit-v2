"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import SiteHeader from "@/components/SiteHeader";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function RecoveryPage() {
  const { t } = useI18n();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function bootstrapRecoverySession() {
      // If session already exists, user can update password immediately.
      const existing = await supabase.auth.getSession();
      if (existing.data.session) {
        if (mounted) setSessionReady(true);
        return;
      }

      // Support hash-based recovery links: #access_token=...&refresh_token=...&type=recovery
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
        if (error) {
          if (mounted) setMsg(`❌ ${error.message}`);
        } else if (mounted) {
          setSessionReady(true);
          return;
        }
      }

      if (mounted) {
        setMsg(t("auth.recovery.sessionMissing"));
        setSessionReady(true);
      }
    }

    bootstrapRecoverySession();
    return () => {
      mounted = false;
    };
  }, [supabase, t]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (password.length < 8) {
      setMsg(t("auth.recovery.passwordMinLength"));
      return;
    }
    if (password !== confirmPassword) {
      setMsg(t("auth.recovery.passwordMismatch"));
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMsg(`❌ ${error.message}`);
      setBusy(false);
      return;
    }
    setMsg(t("auth.recovery.successRedirect"));
    setBusy(false);
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader variant="minimal" />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Link
            href="/login"
            className="inline-flex items-center text-sm text-slate-500 hover:text-amber-400 mb-4 transition-colors"
          >
            {t("auth.common.backToLogin")}
          </Link>
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-6 flex justify-center rounded-xl bg-slate-900 px-4 py-3">
              <Image
                src="/hair-audit-logo-white.png"
                alt={t("auth.common.logoAlt")}
                width={220}
                height={48}
                className="h-10 w-auto object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{t("auth.recovery.title")}</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{t("auth.recovery.subtitle")}</p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                  {t("auth.recovery.newPassword")}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">
                  {t("auth.recovery.confirmNewPassword")}
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={busy || !sessionReady}
                className="w-full rounded-lg bg-slate-900 text-white py-2.5 font-semibold hover:bg-slate-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {busy
                  ? t("auth.recovery.updating")
                  : sessionReady
                    ? t("auth.recovery.updatePassword")
                    : t("auth.recovery.preparingSession")}
              </button>
            </form>

            {msg && (
              <p className="mt-4 text-sm text-slate-700 bg-slate-100 rounded-lg px-3 py-2">
                {msg}
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
