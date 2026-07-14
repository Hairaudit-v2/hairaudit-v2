"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * "Where should we send your report?" — collects the patient's email (required)
 * and first name (optional), creates their account automatically, then submits
 * the case for audit. Zero browser-native dialogs: all feedback is inline.
 */
export default function PatientContactClient({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);

    if (!emailValid) {
      setError("Please enter a valid email address.");
      return;
    }

    setBusy(true);
    try {
      // 1) Create the account automatically (upgrades the anonymous session).
      const claimRes = await fetch("/api/audit/claim-account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, email: email.trim(), firstName: firstName.trim() || undefined }),
      });
      const claimJson = await claimRes.json().catch(() => ({}));
      if (!claimRes.ok || !claimJson?.ok) {
        if (claimRes.status === 409 || claimJson?.code === "email_exists") {
          setError(
            typeof claimJson?.error === "string" && claimJson.error
              ? claimJson.error
              : "That email is already registered. Please sign in to continue."
          );
          setBusy(false);
          return;
        }
        throw new Error(claimJson?.error ?? "Could not save your email. Please try again.");
      }

      // 2) Submit the case to start report generation.
      const submitRes = await fetch("/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId }),
      });
      const submitJson = await submitRes.json().catch(() => ({}));
      if (!submitRes.ok) {
        throw new Error(submitJson?.error ?? "Could not start your audit. Please try again.");
      }

      router.push(`/cases/${caseId}`);
    } catch (err) {
      setError((err as Error)?.message ?? "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 sm:p-8 text-white">
      <div className="pointer-events-none absolute -top-20 -right-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative">
        <h1 className="text-2xl sm:text-3xl font-semibold">Where should we send your report?</h1>
        <p className="mt-2 text-sm text-slate-300/80">
          We&apos;ll create your secure account automatically and email your report the moment it&apos;s ready.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="patient-email" className="block text-sm font-medium text-slate-200 mb-1">
              Email <span className="text-emerald-300">*</span>
            </label>
            <input
              id="patient-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 disabled:opacity-60"
            />
          </div>

          <div>
            <label htmlFor="patient-first-name" className="block text-sm font-medium text-slate-200 mb-1">
              First name <span className="text-slate-500">(optional)</span>
            </label>
            <input
              id="patient-first-name"
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={busy}
              placeholder="Alex"
              className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 disabled:opacity-60"
            />
          </div>

          {error && (
            <div role="alert" className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200 space-y-2">
              <p>{error}</p>
              {/sign in/i.test(error) ? (
                <p>
                  <Link href="/login" className="underline underline-offset-2 hover:text-rose-100">
                    Sign in to continue
                  </Link>
                </p>
              ) : null}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !emailValid}
            aria-busy={busy}
            className="w-full rounded-xl bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Preparing your report…" : "Get my report →"}
          </button>

          <p className="text-xs text-slate-400 text-center">
            By continuing you agree to our{" "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-slate-200">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-slate-200">
              Privacy Policy
            </Link>
            . We&apos;ll send a verification link with your report.
          </p>
        </form>

        <div className="mt-5 border-t border-white/10 pt-4">
          <Link
            href={`/cases/${caseId}/patient/questions`}
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            ← Back to questions
          </Link>
        </div>
      </div>
    </section>
  );
}
