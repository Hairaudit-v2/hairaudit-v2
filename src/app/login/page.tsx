"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import SiteHeader from "@/components/SiteHeader";
import { HA_HOME } from "@/config/platform-links";

export default function LoginPage() {
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busyProvider, setBusyProvider] = useState<"google" | "email" | "password" | null>(null);
  const [sendingReset, setSendingReset] = useState(false);

  const appUrl =
    (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || "").trim() ||
    HA_HOME;
  const oauthRedirectTo = `${appUrl}/auth/callback`;
  const magicLinkRedirectTo = `${appUrl}/auth/magic-link`;

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) window.location.href = "/dashboard";
    });
    return () => {
      mounted = false;
    };
  }, [supabase]);

  async function signInWithProvider(provider: "google") {
    setMsg(null);
    setBusyProvider(provider);

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
      window.location.href = "/dashboard";
    }
    setBusyProvider(null);
  }

  async function sendMagicLink() {
    setMsg(null);
    if (!email.trim()) {
      setMsg("Enter your email first to receive a magic link.");
      return;
    }
    setBusyProvider("email");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: magicLinkRedirectTo },
    });

    if (error) {
      setMsg(`❌ ${error.message}`);
    } else {
      setMsg("Check your email for a secure sign-in link.");
    }
    setBusyProvider(null);
  }

  async function sendPasswordReset() {
    setMsg(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setMsg("Enter your email first so we can send a recovery link.");
      return;
    }

    setSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${appUrl}/auth/recovery`,
    });

    if (error) {
      setMsg(`❌ ${error.message}`);
    } else {
      setMsg("Recovery link sent. Check your email to reset your password.");
    }
    setSendingReset(false);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader variant="minimal" />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-slate-500 hover:text-amber-400 mb-4 transition-colors"
          >
            ← Back to HairAudit
          </Link>
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-6 flex justify-center rounded-xl bg-slate-900 px-4 py-3">
              <Image
                src="/hair-audit-logo-white.png"
                alt="Hair Audit"
                width={220}
                height={48}
                className="h-10 w-auto object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
            <p className="mt-2 text-sm text-slate-600">
              Sign in to access your HairAudit workspace. Patient, doctor, and clinic experiences are all in beta testing.
            </p>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => signInWithProvider("google")}
                disabled={busyProvider !== null}
                className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 py-2.5 font-semibold hover:bg-slate-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Continue with Google
              </button>
            </div>

            <form onSubmit={signInWithPassword} className="mt-6 space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                  Email
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
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                  Password
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
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={busyProvider !== null}
                className="w-full rounded-lg bg-amber-500 text-slate-900 py-2.5 font-semibold hover:bg-amber-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              >
                Sign in with Email + Password
              </button>
            </form>
            <p className="mt-3 text-right text-sm text-slate-600">
              <button
                type="button"
                onClick={sendPasswordReset}
                disabled={busyProvider !== null || sendingReset}
                className="font-medium text-slate-700 hover:text-slate-900 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {sendingReset ? "Sending recovery link..." : "Lost password?"}
              </button>
            </p>

            <button
              type="button"
              onClick={sendMagicLink}
              disabled={busyProvider !== null}
              className="mt-3 w-full rounded-lg border border-slate-300 bg-white text-slate-900 py-2.5 font-semibold hover:bg-slate-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Continue with Email Magic Link
            </button>

            {msg && (
              <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {msg}
              </p>
            )}

            <p className="mt-6 text-center text-xs text-slate-500">
              By signing in, you&apos;ll be redirected to your role-based dashboard.
            </p>
            <p className="mt-2 text-center text-sm text-slate-600">
              Need an account?{" "}
              <Link href="/signup" className="font-medium text-amber-600 hover:text-amber-500">
                Sign up (Patient Beta, Doctor Beta, or Clinic Beta)
              </Link>
            </p>
            <p className="mt-2 text-center text-sm text-slate-600">
              Need auditor access?{" "}
              <Link href="/login/auditor" className="font-medium text-slate-700 hover:text-slate-900">
                Auditor login
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
