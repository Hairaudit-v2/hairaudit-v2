"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import SiteHeader from "@/components/SiteHeader";
import { HA_HOME } from "@/config/platform-links";

type SignupRole = "patient" | "doctor" | "clinic";

export default function SignUpPage() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupRole, setSignupRole] = useState<SignupRole>("patient");
  const [msg, setMsg] = useState<string | null>(null);
  const [msgKind, setMsgKind] = useState<"error" | "success">("error");
  const [busy, setBusy] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [resending, setResending] = useState<null | "confirm" | "magic">(null);

  /** Base URL for auth redirects. Prefer https in production (hairaudit.com) so confirmation emails never use http. */
  function getAppUrl() {
    const raw =
      (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || "").trim() || HA_HOME;
    try {
      const u = new URL(raw);
      if (u.hostname === "hairaudit.com" && u.protocol === "http:") u.protocol = "https:";
      return u.toString().replace(/\/+$/, "");
    } catch {
      return raw.replace(/\/+$/, "");
    }
  }

  /** Post-confirmation path for each role. Clinic must land on clinic dashboard, not site root. */
  function getRedirectPathForRole(role: SignupRole): string {
    if (role === "clinic") return "/dashboard/clinic";
    return "/dashboard";
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setMsgKind("error");
    setBusy(true);

    // IMPORTANT: Prevent localhost leaking into Supabase confirmation emails.
    // If NEXT_PUBLIC_APP_URL is not set, default to production domain.
    const appUrl = getAppUrl();
    if (!process.env.NEXT_PUBLIC_APP_URL) {
      console.warn("[signup] NEXT_PUBLIC_APP_URL is not set; using fallback domain for email redirect.", {
        fallback: appUrl,
      });
    }
    const nextPath = getRedirectPathForRole(signupRole);
    const emailRedirectTo = `${appUrl}/auth/callback?signup_role=${signupRole}&next=${encodeURIComponent(nextPath)}`;
    console.info("[signup] attempting signup", {
      emailRedirectTo,
      email: maskEmail(email),
      signupRole,
    });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: {
          role: signupRole,
        },
      },
    });

    if (error) {
      console.error("[signup] supabase.auth.signUp failed", {
        message: error.message,
        status: (error as { status?: number }).status,
        emailRedirectTo,
        email: maskEmail(email),
        signupRole,
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
        signupRole,
      });
      setMsg("✅ Check your email to confirm your address, then come back and sign in.");
      setMsgKind("success");
      setAwaitingConfirmation(true);
      setBusy(false);
      return;
    }

    try {
      const profileRes = await fetch("/api/profiles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: signupRole }),
      });
      if (!profileRes.ok) {
        const body = await profileRes.text();
        console.warn("[signup] profile upsert after signup failed", {
          status: profileRes.status,
          body: body.slice(0, 300),
          signupRole,
        });
      }
    } catch (profileErr) {
      console.warn("[signup] profile upsert request after signup threw", { error: profileErr });
    }

    router.push("/dashboard");
    router.refresh();
    setAwaitingConfirmation(false);
    setBusy(false);
  }

  async function resendConfirmationEmail() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setMsgKind("error");
      setMsg("Enter your email to resend confirmation.");
      return;
    }
    setResending("confirm");
    setMsg(null);
    try {
      const appUrl = getAppUrl();
      const nextPath = getRedirectPathForRole(signupRole);
      const emailRedirectTo = `${appUrl}/auth/callback?signup_role=${signupRole}&next=${encodeURIComponent(nextPath)}`;
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: trimmedEmail,
        options: { emailRedirectTo },
      });
      if (error) throw error;
      setMsgKind("success");
      setMsg("✅ Confirmation email resent. If it appears blank, use the magic-link fallback below.");
    } catch (error: unknown) {
      setMsgKind("error");
      setMsg(`❌ ${(error as Error)?.message ?? "Could not resend confirmation email."}`);
    } finally {
      setResending(null);
    }
  }

  async function sendMagicLinkFallback() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setMsgKind("error");
      setMsg("Enter your email to receive a magic link.");
      return;
    }
    setResending("magic");
    setMsg(null);
    try {
      const appUrl = getAppUrl();
      const emailRedirectTo = `${appUrl}/auth/magic-link`;
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: { emailRedirectTo },
      });
      if (error) throw error;
      setMsgKind("success");
      setMsg("✅ Magic link sent. You can use it to sign in while confirmation email templates are being fixed.");
    } catch (error: unknown) {
      setMsgKind("error");
      setMsg(`❌ ${(error as Error)?.message ?? "Could not send magic link."}`);
    } finally {
      setResending(null);
    }
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
            <h1 className="text-2xl font-bold text-slate-900">Create your HairAudit beta account</h1>
            <p className="mt-2 text-sm text-slate-600">
              Choose your account type. Patient, doctor, and clinic experiences are currently in beta testing.
            </p>

            <form onSubmit={signUp} className="mt-6 space-y-4">
              <div>
                <p className="block text-sm font-medium text-slate-700 mb-2">I am signing up as</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSignupRole("patient")}
                    className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                      signupRole === "patient"
                        ? "border-amber-500 bg-amber-50 text-amber-800"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Patient (Beta)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignupRole("doctor")}
                    className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                      signupRole === "doctor"
                        ? "border-violet-500 bg-violet-50 text-violet-800"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Doctor (Beta)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignupRole("clinic")}
                    className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                      signupRole === "clinic"
                        ? "border-cyan-500 bg-cyan-50 text-cyan-800"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Clinic (Beta)
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {signupRole === "clinic"
                    ? "Clinic beta accounts get access to the Clinic Intelligence Portal (Invited Contributions and Submitted Cases)."
                    : signupRole === "doctor"
                      ? "Doctor beta accounts get access to the Doctor Portal, defaults-first upload flow, and report visibility controls."
                      : "Patient beta accounts can submit transplant cases for independent forensic review."}
                </p>
              </div>
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
                {busy
                  ? "Creating..."
                  : `Sign up as ${
                      signupRole === "clinic" ? "Clinic" : signupRole === "doctor" ? "Doctor" : "Patient"
                    }`}
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
            {awaitingConfirmation && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-600">
                  Didn&apos;t get a usable confirmation email?
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={resendConfirmationEmail}
                    disabled={resending !== null}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                  >
                    {resending === "confirm" ? "Resending..." : "Resend confirmation"}
                  </button>
                  <button
                    type="button"
                    onClick={sendMagicLinkFallback}
                    disabled={resending !== null}
                    className="rounded-md border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800 hover:bg-cyan-100 disabled:opacity-60"
                  >
                    {resending === "magic" ? "Sending..." : "Send magic link instead"}
                  </button>
                </div>
              </div>
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
