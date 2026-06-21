"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { trackCta } from "@/lib/analytics/trackCta";
import { stashPendingAuthCtaContext } from "@/lib/analytics/authAttribution";
import {
  DEFAULT_PATIENT_REVIEW_PATHWAY,
  type PatientReviewPathway,
} from "@/lib/patient/patientReviewPathway";

type StartFreeAuditButtonProps = {
  className?: string;
  eventName?: string;
  /** HA-DUAL-PATHWAY-1 — stored on case as patient_review_pathway */
  pathway?: PatientReviewPathway;
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

/**
 * Premium, zero-friction "Start Free HairAudit" action.
 *
 * Creates an anonymous audit session server-side (no signup) via
 * `POST /api/audit/start`, then routes straight to the photo-upload step.
 * If hCaptcha is configured (NEXT_PUBLIC_HCAPTCHA_SITEKEY), an invisible
 * challenge is solved before the request. No browser-native dialogs — errors
 * render inline.
 */
export default function StartFreeAuditButton({
  className,
  eventName,
  pathway = DEFAULT_PATIENT_REVIEW_PATHWAY,
  children,
}: StartFreeAuditButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captchaContainerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

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
      // If the challenge can't run, proceed without a token; the server decides.
      return null;
    }
  }, []);

  const start = useCallback(async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    if (eventName) {
      trackCta(eventName, { href: "/api/audit/start" });
      stashPendingAuthCtaContext(eventName, "/api/audit/start");
    }
    try {
      const captchaToken = await solveCaptcha();
      const res = await fetch("/api/audit/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ captchaToken, pathway }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "Could not start your audit. Please try again.");
      }
      router.push(json.next ?? `/cases/${json.caseId}/patient/photos`);
    } catch (e) {
      setError((e as Error)?.message ?? "Could not start your audit. Please try again.");
      setBusy(false);
    }
  }, [busy, eventName, pathway, router, solveCaptcha]);

  return (
    <>
      <button type="button" onClick={start} disabled={busy} className={className} aria-busy={busy}>
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
