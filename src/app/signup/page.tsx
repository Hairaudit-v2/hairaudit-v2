"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import SiteHeader from "@/components/SiteHeader";

export default function SignUpPage() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [msgKind, setMsgKind] = useState<"error" | "success">("error");
  const [busy, setBusy] = useState(false);

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setMsgKind("error");
    setBusy(true);

    // IMPORTANT: Prevent localhost leaking into Supabase confirmation emails.
    // If NEXT_PUBLIC_APP_URL is not set, default to production domain.
    const appUrl =
      (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || "").trim() ||
      "https://hairaudit.com";
    if (!process.env.NEXT_PUBLIC_APP_URL) {
      console.warn("[signup] NEXT_PUBLIC_APP_URL is not set; using fallback domain for email redirect.", {
        fallback: appUrl,
      });
    }
    const emailRedirectTo = `${appUrl}/auth/callback`;
    console.info("[signup] attempting signup", {
      emailRedirectTo,
      email: maskEmail(email),
    });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
      },
    });

    if (error) {
      console.error("[signup] supabase.auth.signUp failed", {
        message: error.message,
        status: (error as { status?: number }).status,
        emailRedirectTo,
        email: maskEmail(email),
      });
      setMsg(`❌ ${error.message}`);
      setBusy(false);
      return;
    }

    // If email confirmations are enabled in Supabase, signUp() succeeds but returns no session.
    // In that case, the user must click the email link (which hits /auth/callback) before they can be signed in.
    if (!data.session) {
      console.info("[signup] signup succeeded without session; awaiting email confirmation", {
        userId: data.user?.id,
        emailRedirectTo,
        email: maskEmail(email),
      });
      setMsg("✅ Check your email to confirm your address, then come back and sign in.");
      setMsgKind("success");
      setBusy(false);
      return;
    }

    try {
      const profileRes = await fetch("/api/profiles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!profileRes.ok) {
        const body = await profileRes.text();
        console.warn("[signup] profile upsert after signup failed", {
          status: profileRes.status,
          body: body.slice(0, 300),
        });
      }
    } catch (profileErr) {
      console.warn("[signup] profile upsert request after signup threw", { error: profileErr });
    }

    router.push("/dashboard");
    router.refresh();
    setBusy(false);
  }

  function maskEmail(value: string): string {
    const [localPart, domain] = value.trim().split("@");
    if (!localPart || !domain) return value;
    if (localPart.length <= 2) return `${localPart[0] ?? "*"}*@${domain}`;
    return `${localPart.slice(0, 2)}***@${domain}`;
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
            <h1 className="text-2xl font-bold text-slate-900">Create account</h1>
            <p className="mt-2 text-sm text-slate-600">
              Create a patient beta account to start your HairAudit workflow.
            </p>

            <form onSubmit={signUp} className="mt-6 space-y-4">
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
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-amber-500 text-slate-900 py-2.5 font-semibold hover:bg-amber-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              >
                {busy ? "Creating…" : "Sign up"}
              </button>
            </form>

            {msg && (
              <p
                className={`mt-4 text-sm rounded-lg px-3 py-2 ${
                  msgKind === "success"
                    ? "text-emerald-700 bg-emerald-50"
                    : "text-red-600 bg-red-50"
                }`}
              >
                {msg}
              </p>
            )}

            <p className="mt-6 text-center text-sm text-slate-600">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-amber-600 hover:text-amber-500">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
