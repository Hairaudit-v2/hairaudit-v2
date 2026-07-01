"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import SiteHeader from "@/components/SiteHeader";
import ClaimInvitePanel from "@/components/nexus/ClaimInvitePanel";
import { useI18n } from "@/components/i18n/I18nProvider";
import { getCanonicalAppUrl, buildAuthRedirectUrl, sanitizeNextPath } from "@/lib/auth/redirects";
import { trackAuthFunnel } from "@/lib/analytics/authFunnel";
import { resolvePostLoginRedirectPath } from "@/lib/auth/patientLogin";
import { completeAuthWithOptionalClaim } from "@/lib/nexus/claimAccountAfterAuth";
import {
  buildAuthHrefWithClaimToken,
  claimErrorMessageKey,
  getClaimTokenFromSearchParams,
  persistClaimToken,
  readPersistedClaimToken,
} from "@/lib/nexus/claimTokenClient";
import { useClaimTokenValidation } from "@/lib/nexus/useClaimTokenValidation";

function LoginPageContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const claimToken = getClaimTokenFromSearchParams(searchParams);
  const claimValidation = useClaimTokenValidation(claimToken);
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busyProvider, setBusyProvider] = useState<"google" | "email" | "password" | null>(null);
  const [sendingReset, setSendingReset] = useState(false);

  const appUrl = getCanonicalAppUrl();
  const [loginNextPath, setLoginNextPath] = useState<string | null>(null);

  const authCallbackUrl = loginNextPath
    ? buildAuthRedirectUrl("/auth/callback", { next: loginNextPath })
    : `${appUrl}/auth/callback`;
  const oauthRedirectTo = authCallbackUrl;
  const magicLinkRedirectTo = authCallbackUrl;
  const funnelPageTracked = useRef(false);
  const [signupHref, setSignupHref] = useState("/signup");

  useEffect(() => {
    const s = window.location.search;
    const params = new URLSearchParams(s.startsWith("?") ? s.slice(1) : s);
    const token = getClaimTokenFromSearchParams(params);
    if (token) persistClaimToken(token);
    setSignupHref(token ? buildAuthHrefWithClaimToken(s ? `/signup${s}` : "/signup", token) : s ? `/signup${s}` : "/signup");
    setLoginNextPath(sanitizeNextPath(params.get("next")));
  }, []);

  useEffect(() => {
    if (funnelPageTracked.current) return;
    funnelPageTracked.current = true;
    const path = window.location.pathname;
    const search = window.location.search;
    trackAuthFunnel("auth_page_view", { auth_surface: "login" }, { pathname: path, search });

    const err = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("error");
    if (err === "auth_callback_failed") {
      const dedupeKey = `hairaudit:auth_cb_fail:${search}`;
      try {
        if (sessionStorage.getItem(dedupeKey)) return;
        sessionStorage.setItem(dedupeKey, "1");
      } catch {
        /* ignore */
      }
      trackAuthFunnel(
        "auth_session_failed",
        { auth_reason: "auth_callback_exchange_failed", auth_surface: "login" },
        { pathname: path, search }
      );
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted || !data.session) return;
      const defaultRedirect = await resolvePostLoginRedirectPath(supabase, loginNextPath);
      const claimResult = await completeAuthWithOptionalClaim({
        queryToken: claimToken,
        persistedToken: readPersistedClaimToken(),
        defaultRedirect,
      });
      if (!mounted) return;
      if (!claimResult.ok) {
        setMsg(`❌ ${t("auth.claim.claimFailedPrefix")} ${t(claimErrorMessageKey(claimResult.error))}`);
        return;
      }
      window.location.href = claimResult.redirectPath;
    });
    return () => {
      mounted = false;
    };
  }, [supabase, loginNextPath, claimToken, t]);

  async function redirectAfterAuth(defaultRedirect: string) {
    const claimResult = await completeAuthWithOptionalClaim({
      queryToken: claimToken,
      persistedToken: readPersistedClaimToken(),
      defaultRedirect,
    });
    if (!claimResult.ok) {
      setMsg(`❌ ${t("auth.claim.claimFailedPrefix")} ${t(claimErrorMessageKey(claimResult.error))}`);
      return;
    }
    window.location.href = claimResult.redirectPath;
  }

  async function signInWithProvider(provider: "google") {
    setMsg(null);
    const path = window.location.pathname;
    const search = window.location.search;
    trackAuthFunnel(
      "auth_email_submit",
      { auth_method: `oauth_${provider}`, auth_surface: "login" },
      { pathname: path, search }
    );
    setBusyProvider(provider);
    if (claimToken) persistClaimToken(claimToken);

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: oauthRedirectTo },
    });

    if (error) setMsg(`❌ ${error.message}`);
    setBusyProvider(null);
  }

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusyProvider("password");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMsg(`❌ ${error.message}`);
    } else {
      const path = window.location.pathname;
      const search = window.location.search;
      const defaultRedirect = await resolvePostLoginRedirectPath(supabase, loginNextPath);
      trackAuthFunnel(
        "auth_session_success",
        { auth_method: "password", auth_surface: "login" },
        { pathname: path, search }
      );
      trackAuthFunnel(
        "auth_dashboard_redirect_success",
        { auth_target: defaultRedirect, auth_surface: "login" },
        { pathname: path, search }
      );
      await redirectAfterAuth(defaultRedirect);
    }
    setBusyProvider(null);
  }

  async function sendMagicLink() {
    setMsg(null);
    if (!email.trim()) {
      setMsg(t("auth.login.enterEmailMagicLink"));
      return;
    }
    const path = window.location.pathname;
    const search = window.location.search;
    trackAuthFunnel("auth_email_submit", { auth_method: "magic_link", auth_surface: "login" }, { pathname: path, search });
    setBusyProvider("email");
    if (claimToken) persistClaimToken(claimToken);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: magicLinkRedirectTo },
    });

    if (error) {
      trackAuthFunnel(
        "auth_magic_link_send_failed",
        { auth_surface: "login", auth_error_code: (error as { code?: string }).code },
        { pathname: path, search }
      );
      setMsg(`❌ ${error.message}`);
    } else {
      trackAuthFunnel("auth_magic_link_sent", { auth_surface: "login" }, { pathname: path, search });
      setMsg(t("auth.login.magicLinkSent"));
    }
    setBusyProvider(null);
  }

  async function sendPasswordReset() {
    setMsg(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setMsg(t("auth.login.enterEmailReset"));
      return;
    }

    setSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${appUrl}/auth/recovery`,
    });

    if (error) {
      setMsg(`❌ ${error.message}`);
    } else {
      setMsg(t("auth.login.resetSent"));
    }
    setSendingReset(false);
  }

  const signupHrefWithClaim = buildAuthHrefWithClaimToken(signupHref, claimToken);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader variant="minimal" />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-slate-500 hover:text-amber-400 mb-4 transition-colors"
          >
            {t("auth.common.backToHairAudit")}
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
            <ClaimInvitePanel
              validation={claimValidation}
              loginHref={signupHrefWithClaim}
              showSignInLink={false}
            />
            <h1 className="text-2xl font-bold text-slate-900">{t("auth.login.title")}</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {claimToken && claimValidation.status === "valid"
                ? t("auth.claim.claimSubtitle")
                : t("auth.login.subtitle")}
            </p>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => signInWithProvider("google")}
                disabled={busyProvider !== null}
                className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 py-2.5 font-semibold hover:bg-slate-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {t("auth.login.continueGoogle")}
              </button>
            </div>

            <form onSubmit={signInWithPassword} className="mt-6 space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                  {t("auth.common.email")}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
                  placeholder={t("auth.common.emailPlaceholder")}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                  {t("auth.common.password")}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
                  placeholder={t("auth.common.passwordPlaceholderMasked")}
                />
              </div>
              <button
                type="submit"
                disabled={busyProvider !== null}
                className="w-full rounded-lg bg-amber-500 text-slate-900 py-2.5 font-semibold hover:bg-amber-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              >
                {t("auth.login.signInEmailPassword")}
              </button>
            </form>
            <p className="mt-3 text-right text-sm text-slate-600">
              <button
                type="button"
                onClick={sendPasswordReset}
                disabled={busyProvider !== null || sendingReset}
                className="font-medium text-slate-700 hover:text-slate-900 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {sendingReset ? t("auth.login.sendingRecovery") : t("auth.login.lostPassword")}
              </button>
            </p>

            <button
              type="button"
              onClick={sendMagicLink}
              disabled={busyProvider !== null}
              className="mt-3 w-full rounded-lg border border-slate-300 bg-white text-slate-900 py-2.5 font-semibold hover:bg-slate-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {t("auth.login.magicLink")}
            </button>

            {msg && (
              <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {msg}
              </p>
            )}

            <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">{t("auth.login.footerRedirect")}</p>
            <p className="mt-2 text-center text-sm text-slate-600">
              {t("auth.login.needAccount")}{" "}
              <Link href={signupHrefWithClaim} className="font-medium text-amber-600 hover:text-amber-500">
                {t("auth.login.signUpCta")}
              </Link>
            </p>
            <p className="mt-2 text-center text-sm text-slate-600">
              {t("auth.login.auditorPrompt")}{" "}
              <Link href="/login/auditor" className="font-medium text-slate-700 hover:text-slate-900">
                {t("auth.login.auditorLink")}
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <LoginPageContent />
    </Suspense>
  );
}
