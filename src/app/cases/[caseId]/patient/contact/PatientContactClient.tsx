"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getPatientContactCopy } from "@/lib/patient/patientContactCopy";
import type { PatientReviewPathway } from "@/lib/patient/patientReviewPathway";

type MismatchState = {
  maskedSessionEmail: string;
  maskedEnteredEmail: string;
};

type EmailExistsState = {
  signInHref: string;
  maskedEmail?: string;
  requiresSignOut: boolean;
};

/**
 * Account confirmation step — claims/reconciles the patient account, then
 * continues to the final review submission step (does not submit here).
 */
export default function PatientContactClient({
  caseId,
  pathway,
  handoffToken,
  sessionEmail,
  isAnonymous,
}: {
  caseId: string;
  pathway: PatientReviewPathway;
  handoffToken?: string | null;
  sessionEmail?: string | null;
  isAnonymous: boolean;
}) {
  const router = useRouter();
  const copy = useMemo(() => getPatientContactCopy(pathway), [pathway]);
  const [email, setEmail] = useState(sessionEmail && !isAnonymous ? sessionEmail : "");
  const [firstName, setFirstName] = useState("");
  const [busy, setBusy] = useState(false);
  const [handoffBusy, setHandoffBusy] = useState(Boolean(handoffToken));
  const [error, setError] = useState<string | null>(null);
  const [mismatch, setMismatch] = useState<MismatchState | null>(null);
  const [emailExists, setEmailExists] = useState<EmailExistsState | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  useEffect(() => {
    if (!handoffToken) return;
    let cancelled = false;
    (async () => {
      setHandoffBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/audit/redeem-intake-handoff", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: handoffToken }),
        });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !json?.ok) {
          setError(
            typeof json?.error === "string" && json.error
              ? json.error
              : "Could not restore your review after sign-in. Please try again."
          );
          setHandoffBusy(false);
          return;
        }
        // Drop handoff from the URL; ownership now holds on this account.
        router.replace(`/cases/${caseId}/patient/contact`);
        router.refresh();
        setHandoffBusy(false);
      } catch {
        if (!cancelled) {
          setError("Could not restore your review after sign-in. Please try again.");
          setHandoffBusy(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handoffToken, caseId, router]);

  async function continueWithCurrentAccount() {
    if (!sessionEmail || isAnonymous) return;
    setEmail(sessionEmail);
    setMismatch(null);
    setError(null);
  }

  async function signOutAndSignIn(signInHref: string) {
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      window.location.href = signInHref;
    } catch {
      window.location.href = signInHref;
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || handoffBusy) return;
    setError(null);
    setMismatch(null);
    setEmailExists(null);

    if (!emailValid) {
      setError("Please enter a valid email address.");
      return;
    }

    setBusy(true);
    try {
      const claimRes = await fetch("/api/audit/claim-account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, email: email.trim(), firstName: firstName.trim() || undefined }),
      });
      const claimJson = await claimRes.json().catch(() => ({}));

      if (!claimRes.ok || !claimJson?.ok) {
        if (claimJson?.code === "account_mismatch") {
          setMismatch({
            maskedSessionEmail:
              typeof claimJson.maskedSessionEmail === "string" ? claimJson.maskedSessionEmail : "***",
            maskedEnteredEmail:
              typeof claimJson.maskedEnteredEmail === "string" ? claimJson.maskedEnteredEmail : "***",
          });
          setBusy(false);
          return;
        }
        if (claimRes.status === 409 || claimJson?.code === "email_exists") {
          const signInHref =
            typeof claimJson?.signInHref === "string" && claimJson.signInHref.startsWith("/login")
              ? claimJson.signInHref
              : `/login?from=patient&next=${encodeURIComponent(`/cases/${caseId}/patient/contact`)}`;
          setEmailExists({
            signInHref,
            maskedEmail: typeof claimJson?.maskedEmail === "string" ? claimJson.maskedEmail : undefined,
            requiresSignOut: claimJson?.requiresSignOut !== false,
          });
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

      const next =
        typeof claimJson?.next === "string" && claimJson.next.startsWith(`/cases/${caseId}`)
          ? claimJson.next
          : `/cases/${caseId}/patient/review`;
      router.push(next);
    } catch (err) {
      setError((err as Error)?.message ?? "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  if (handoffBusy) {
    return (
      <section className="relative overflow-hidden rounded-2xl border border-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 sm:p-8 text-white">
        <p className="text-sm text-slate-300">Restoring your Pre-Surgery Review…</p>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 sm:p-8 text-white">
      <div className="pointer-events-none absolute -top-20 -right-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-300/90">{copy.progressLabel}</p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-semibold">{copy.pageTitle}</h1>
        <p className="mt-2 text-sm text-slate-300/80">{copy.supportingText}</p>

        {mismatch ? (
          <div role="alert" className="mt-6 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-100 space-y-3">
            <p>
              You are signed in as <span className="font-medium">{mismatch.maskedSessionEmail}</span>, but you
              entered <span className="font-medium">{mismatch.maskedEnteredEmail}</span>.
            </p>
            <p>We will not attach this review to the wrong account.</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void continueWithCurrentAccount()}
                className="rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-300"
              >
                Continue with {mismatch.maskedSessionEmail}
              </button>
              <button
                type="button"
                onClick={() =>
                  void signOutAndSignIn(
                    `/login?from=patient&next=${encodeURIComponent(`/cases/${caseId}/patient/contact`)}`
                  )
                }
                className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/5"
              >
                Sign out and sign in with the entered email
              </button>
              <button
                type="button"
                onClick={() => {
                  setMismatch(null);
                  setError(null);
                }}
                className="text-sm text-slate-300 underline underline-offset-2 hover:text-white"
              >
                Change the entered email
              </button>
            </div>
          </div>
        ) : (
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
                {emailExists ? (
                  <div className="space-y-2">
                    {emailExists.maskedEmail ? (
                      <p className="text-rose-100/90">Account: {emailExists.maskedEmail}</p>
                    ) : null}
                    <p>
                      <button
                        type="button"
                        className="underline underline-offset-2 hover:text-rose-100"
                        onClick={() => void signOutAndSignIn(emailExists.signInHref)}
                      >
                        Sign in to continue
                      </button>
                    </p>
                  </div>
                ) : null}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || !emailValid}
              aria-busy={busy}
              className="w-full rounded-xl bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? copy.primaryBusy : copy.primaryButton}
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
              .
            </p>
          </form>
        )}

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
