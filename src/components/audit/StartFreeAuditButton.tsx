"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import TrackedLink from "@/components/analytics/TrackedLink";
import { trackCta } from "@/lib/analytics/trackCta";
import { stashPendingAuthCtaContext } from "@/lib/analytics/authAttribution";
import {
  bindEntryContextToCase,
  clearPendingEntryContext,
  readPendingEntryContext,
} from "@/lib/patient/patientEntryContext";
import { parseDonorEntryContext } from "@/lib/patient/donorHealingEntry";
import {
  DEFAULT_PATIENT_REVIEW_PATHWAY,
  PATHWAY_CHOOSER_HREF,
  type PatientReviewPathway,
} from "@/lib/patient/patientReviewPathway";
import { buildPatientLoginHref } from "@/lib/auth/patientLogin";

function authReturnPathForPathway(pathway: PatientReviewPathway): string {
  return `/request-review?pathway=${encodeURIComponent(pathway)}`;
}

type StartFreeAuditButtonProps = {
  className?: string;
  eventName?: string;
  /** HA-DUAL-PATHWAY-1 — stored on case as patient_review_pathway. Omit to route to pathway chooser. */
  pathway?: PatientReviewPathway;
  /**
   * HA-DONOR-HEALING-1A — optional validated entry context (e.g. donor_healing).
   * Only applied when pathway is post_surgery. Falls back to pending session stash.
   */
  entryContext?: string;
  /** Test-only escape hatch — never use on public CTAs. */
  allowDefaultPostSurgeryForLegacyTestOnly?: boolean;
  children: React.ReactNode;
};

const HCAPTCHA_SITEKEY = process.env.NEXT_PUBLIC_HCAPTCHA_SITEKEY;

type HcaptchaApi = {
  render: (container: HTMLElement, opts: Record<string, unknown>) => string;
  execute: (id: string, opts: { async: true }) => Promise<{ response: string }>;
  reset: (id: string) => void;
};

declare global {
  interface Window {
    hcaptcha?: HcaptchaApi;
  }
}

let hcaptchaScriptPromise: Promise<void> | null = null;

function loadHcaptchaScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.hcaptcha) return Promise.resolve();
  if (hcaptchaScriptPromise) return hcaptchaScriptPromise;
  hcaptchaScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.hcaptcha.com/1/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("hcaptcha_load_failed"));
    document.head.appendChild(script);
  });
  return hcaptchaScriptPromise;
}

type StartApiJson = {
  ok?: boolean;
  error?: string;
  code?: string;
  message?: string;
  next?: string;
  caseId?: string;
  pathway?: string;
};

/**
 * Starts a patient audit when `pathway` is explicit, or routes to the pathway chooser when missing.
 *
 * Never silently defaults to post-surgery on public surfaces unless
 * `allowDefaultPostSurgeryForLegacyTestOnly` is set (tests/internal only).
 *
 * HA-PATHWAY-START-403-FIX: maps structured API codes to signup/login/resume/
 * role-specific UX — never surfaces raw "Forbidden".
 */
export default function StartFreeAuditButton({
  className,
  eventName,
  pathway,
  entryContext,
  allowDefaultPostSurgeryForLegacyTestOnly = false,
  children,
}: StartFreeAuditButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captchaContainerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  const effectivePathway =
    pathway ??
    (allowDefaultPostSurgeryForLegacyTestOnly ? DEFAULT_PATIENT_REVIEW_PATHWAY : undefined);

  const solveCaptcha = useCallback(async (): Promise<string | null> => {
    if (!HCAPTCHA_SITEKEY) return null;
    try {
      await loadHcaptchaScript();
      const api = window.hcaptcha;
      if (!api || !captchaContainerRef.current) return null;
      if (widgetIdRef.current == null) {
        widgetIdRef.current = api.render(captchaContainerRef.current, {
          sitekey: HCAPTCHA_SITEKEY,
          size: "invisible",
        });
      } else {
        api.reset(widgetIdRef.current);
      }
      const { response } = await api.execute(widgetIdRef.current, { async: true });
      return response ?? null;
    } catch {
      return null;
    }
  }, []);

  const start = useCallback(async () => {
    if (!effectivePathway || busy) return;
    setError(null);
    setBusy(true);
    if (eventName) {
      trackCta(eventName, { href: "/api/audit/start" });
      stashPendingAuthCtaContext(eventName, "/api/audit/start");
    }
    try {
      const pending = readPendingEntryContext();
      const resolvedEntry =
        effectivePathway === "post_surgery"
          ? parseDonorEntryContext(entryContext) ?? pending?.entryContext ?? null
          : null;

      if (effectivePathway === "post_surgery" && resolvedEntry) {
        trackCta("donor_pathway_confirmed", {
          entry_context: resolvedEntry,
          pathway: effectivePathway,
        });
      }

      const captchaToken = await solveCaptcha();
      const res = await fetch("/api/audit/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          captchaToken,
          pathway: effectivePathway,
          ...(resolvedEntry
            ? {
                entryContext: resolvedEntry,
                entry_context: resolvedEntry,
                concern: pending?.concern ?? "donor_healing",
                entry_source: pending?.sourceGuide ?? null,
              }
            : {}),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as StartApiJson;
      const code = json.code ?? json.error;

      // 409 EXISTING_CASE — resume without treating as failure noise
      if (res.status === 409 && code === "EXISTING_CASE" && (json.next || json.caseId)) {
        if (resolvedEntry && json.caseId) {
          bindEntryContextToCase(String(json.caseId), {
            entryContext: resolvedEntry,
            concern: pending?.concern ?? "donor_healing",
            sourceGuide: pending?.sourceGuide ?? null,
            ts: Date.now(),
          });
          clearPendingEntryContext();
        }
        router.push(json.next ?? `/cases/${json.caseId}/patient/photos`);
        return;
      }

      if (res.status === 401 || code === "UNAUTHORIZED") {
        const next =
          typeof json.next === "string" && json.next.startsWith("/")
            ? json.next
            : buildPatientLoginHref(authReturnPathForPathway(effectivePathway));
        router.push(next);
        return;
      }

      if (res.status === 403 && code === "PROFILE_REQUIRED") {
        router.push(
          typeof json.next === "string" && json.next.startsWith("/")
            ? json.next
            : `/beta-access-message?pathway=${encodeURIComponent(effectivePathway)}`
        );
        return;
      }

      if (res.status === 403 && code === "ROLE_NOT_ALLOWED") {
        setError(
          json.message ??
            "This account cannot start a patient review. Use the professional dashboard instead."
        );
        setBusy(false);
        if (typeof json.next === "string" && json.next.startsWith("/dashboard")) {
          // Controlled navigation for professionals — avoid patient dashboard invent.
          window.setTimeout(() => router.push(json.next!), 1200);
        }
        return;
      }

      if (!res.ok || !json?.ok) {
        const msg = json.message ?? json.error;
        if (msg === "Forbidden" || msg === "ROLE_NOT_ALLOWED") {
          throw new Error(
            "This account cannot start a patient review from this page. Please use your professional dashboard."
          );
        }
        throw new Error(msg ?? "Could not start your audit. Please try again.");
      }
      if (resolvedEntry && json.caseId) {
        bindEntryContextToCase(String(json.caseId), {
          entryContext: resolvedEntry,
          concern: pending?.concern ?? "donor_healing",
          sourceGuide: pending?.sourceGuide ?? null,
          ts: Date.now(),
        });
        clearPendingEntryContext();
        trackCta("donor_case_created", {
          entry_context: resolvedEntry,
          pathway: effectivePathway,
        });
      }
      router.push(json.next ?? `/cases/${json.caseId}/patient/photos`);
    } catch (e) {
      setError((e as Error)?.message ?? "Could not start your audit. Please try again.");
      setBusy(false);
    }
  }, [busy, effectivePathway, entryContext, eventName, router, solveCaptcha]);

  if (!effectivePathway) {
    return (
      <TrackedLink
        href={PATHWAY_CHOOSER_HREF}
        eventName={eventName ?? "cta_choose_review_pathway"}
        className={className}
        data-testid="choose-review-pathway"
      >
        {children}
      </TrackedLink>
    );
  }

  const pathwayTestId =
    effectivePathway === "pre_surgery" ? "start-pre-surgery-review" : "start-post-surgery-audit";

  return (
    <>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className={className}
        aria-busy={busy}
        data-testid={pathwayTestId}
        data-entry-context={
          effectivePathway === "post_surgery"
            ? parseDonorEntryContext(entryContext) ?? undefined
            : undefined
        }
      >
        {busy ? "Starting…" : children}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-rose-300">
          {error}
        </p>
      )}
      <div ref={captchaContainerRef} aria-hidden className="hidden" />
    </>
  );
}
