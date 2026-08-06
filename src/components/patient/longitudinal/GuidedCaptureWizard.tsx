"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  GuidedCaptureViewDto,
  GuidedCaptureWizardStep,
  GuidedLongitudinalCaptureDto,
} from "@/lib/outcomeIntelligence/guidedCaptureDto";
import {
  canUploadForMilestoneStatus,
  formatTargetDateForPatient,
  nextViewStep,
  orderedGuidedViews,
  primaryCtaLabel,
  resolveGuidedCaptureInitialStep,
} from "@/lib/outcomeIntelligence/guidedCaptureWizard";
import { LONGITUDINAL_CAPTURE_WORKFLOW } from "@/lib/outcomeIntelligence/longitudinalFollowupUploadAllowance";
import CaptureProgress from "./CaptureProgress";
import CaptureReview from "./CaptureReview";
import CaptureComplete from "./CaptureComplete";
import GuidedCaptureViewStep from "./GuidedCaptureView";
import type { PhotoSessionMilestone } from "@/lib/photoSessions/types";

function stageToSessionMilestone(stage: string): PhotoSessionMilestone {
  if (
    stage === "month_3" ||
    stage === "month_6" ||
    stage === "month_9" ||
    stage === "month_12" ||
    stage === "month_1" ||
    stage === "month_18"
  ) {
    return stage;
  }
  return "month_6";
}

export default function GuidedCaptureWizard({
  caseId,
  initialDto,
  backHref,
}: {
  caseId: string;
  initialDto: GuidedLongitudinalCaptureDto;
  backHref: string;
}) {
  const [dto, setDto] = useState(initialDto);
  const [step, setStep] = useState<GuidedCaptureWizardStep>(() =>
    resolveGuidedCaptureInitialStep(initialDto)
  );
  const [encouragement, setEncouragement] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [allPhotosOpen, setAllPhotosOpen] = useState(false);
  const [photoSessionId, setPhotoSessionId] = useState<string | null>(null);

  const canUpload = canUploadForMilestoneStatus(dto.status, Boolean(dto.earlyUploadNote));
  const ordered = useMemo(() => orderedGuidedViews(dto.views), [dto.views]);

  useEffect(() => {
    let cancelled = false;
    const milestone = stageToSessionMilestone(dto.stage);
    void fetch(`/api/patient/cases/${encodeURIComponent(caseId)}/photo-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ milestone, patientConfirmed: true }),
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) return;
        setPhotoSessionId(String(json.sessionId));
      })
      .catch(() => {
        /* non-blocking — uploads still work via category; reconcile attaches later */
      });
    return () => {
      cancelled = true;
    };
  }, [caseId, dto.stage]);

  const refreshDto = useCallback(async () => {
    setRefreshError(null);
    const res = await fetch(
      `/api/patient/cases/${encodeURIComponent(caseId)}/guided-capture?stage=${encodeURIComponent(dto.stage)}`
    );
    if (res.status === 401) {
      setRefreshError("Your session expired. Please sign in again to continue.");
      return null;
    }
    if (!res.ok) {
      setRefreshError(
        "We couldn’t refresh your photo progress. Your uploads are safe — please try again."
      );
      return null;
    }
    const next = (await res.json()) as GuidedLongitudinalCaptureDto;
    setDto(next);
    return next;
  }, [caseId, dto.stage]);

  const currentView: GuidedCaptureViewDto | null =
    step.mode === "view"
      ? ordered.find((v) => v.key === step.viewKey) ?? ordered[step.index] ?? null
      : null;

  async function handleUploaded() {
    const next = await refreshDto();
    if (!next || !currentView) return;
    const remaining = next.views.filter((v) => v.required && !v.complete).length;
    const label = currentView.label;
    if (remaining === 0) {
      setEncouragement("Your required photos are complete.");
    } else if (remaining === 1) {
      setEncouragement(`Great — ${label} added. One required photo remaining.`);
    } else {
      setEncouragement(
        `Great — ${label} added. ${remaining} required photos remaining.`
      );
    }
  }

  function startCapture() {
    if (dto.status === "future" && !dto.earlyUploadNote) {
      const first = ordered[0];
      if (first) {
        setStep({ mode: "view", viewKey: first.key, index: 0 });
      }
      return;
    }

    if (allRequiredDone()) {
      setStep({ mode: "review" });
      return;
    }

    const missing = ordered.find((v) => v.required && !v.complete) ?? ordered[0];
    if (missing) {
      const index = ordered.findIndex((v) => v.key === missing.key);
      setStep({ mode: "view", viewKey: missing.key, index: Math.max(0, index) });
    }
  }

  function allRequiredDone() {
    return dto.views.filter((v) => v.required).every((v) => v.complete);
  }

  return (
    <div
      className="mx-auto min-h-[100dvh] max-w-lg px-4 py-5 pb-10"
      data-testid="guided-capture-wizard"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href={backHref}
          className="text-sm font-medium text-slate-600 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          ← HairAudit follow-ups
        </Link>
        <button
          type="button"
          className="text-sm font-medium text-slate-600 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          onClick={() => setAllPhotosOpen((v) => !v)}
          data-testid="guided-capture-view-all"
        >
          {allPhotosOpen ? "Hide all photos" : "View all photos"}
        </button>
      </div>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {dto.title}
        </h1>
        <p className="text-sm leading-relaxed text-slate-600">{dto.subtitle}</p>
        <CaptureProgress progress={dto.progress} />
      </header>

      {refreshError ? (
        <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900" role="alert">
          {refreshError}
        </p>
      ) : null}

      {allPhotosOpen ? (
        <div className="mt-6" data-testid="guided-capture-all-photos">
          <CaptureReview
            dto={dto}
            onSelectView={(v) => {
              const idx = ordered.findIndex((x) => x.key === v.key);
              setAllPhotosOpen(false);
              setStep({ mode: "view", viewKey: v.key, index: Math.max(0, idx) });
            }}
            onFinish={() => {
              setAllPhotosOpen(false);
              setStep({ mode: "complete" });
            }}
          />
        </div>
      ) : null}

      {!allPhotosOpen && step.mode === "status_only" ? (
        <section className="mt-6 space-y-5" data-testid="guided-capture-entry">
          <p className="text-base font-medium text-slate-900" data-testid="guided-capture-status-message">
            {dto.statusMessage}
          </p>
          {dto.status === "future" ? (
            <p className="text-sm text-slate-600">
              Opens on {formatTargetDateForPatient(dto.targetDate)}. You can review
              photo guidance now.
            </p>
          ) : null}
          {dto.earlyUploadNote ? (
            <p className="text-sm text-slate-600">{dto.earlyUploadNote}</p>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-800">Before you start</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {dto.photographyGuidance.slice(0, 6).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          {dto.status === "ready_for_review" || dto.status === "observed" ? (
            <CaptureComplete dto={dto} backHref={backHref} />
          ) : (
            <button
              type="button"
              className="min-h-12 w-full rounded-xl bg-slate-900 px-4 text-base font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              data-testid="guided-capture-primary-cta"
              onClick={startCapture}
            >
              {primaryCtaLabel(dto.status)}
            </button>
          )}
        </section>
      ) : null}

      {!allPhotosOpen && step.mode === "view" && currentView ? (
        <div className="mt-6">
          <GuidedCaptureViewStep
            caseId={caseId}
            stage={dto.stage}
            view={currentView}
            recommendedNote={dto.recommendedNote}
            referenceMatchNote={dto.referenceMatchNote}
            representativeNote={dto.representativeCaptureNote}
            capturePolicyVersion={dto.capturePolicyVersion}
            canUpload={canUpload}
            encouragement={encouragement}
            photoSessionId={photoSessionId}
            onUploaded={async () => {
              // Pass longitudinal metadata by re-invoking upload with extra fields —
              // GuidedCaptureView already uploaded; refresh canonical state here.
              await handleUploaded();
            }}
            onContinue={() => {
              setEncouragement(null);
              setStep(nextViewStep(dto.views, currentView.key));
            }}
            onSkipRecommended={
              !currentView.required
                ? () => setStep(nextViewStep(dto.views, currentView.key))
                : undefined
            }
          />
        </div>
      ) : null}

      {!allPhotosOpen && step.mode === "review" ? (
        <div className="mt-6">
          <CaptureReview
            dto={dto}
            onSelectView={(v) => {
              const idx = ordered.findIndex((x) => x.key === v.key);
              setStep({ mode: "view", viewKey: v.key, index: Math.max(0, idx) });
            }}
            onFinish={async () => {
              const next = await refreshDto();
              if (next && next.views.filter((v) => v.required).every((v) => v.complete)) {
                setStep({ mode: "complete" });
              }
            }}
          />
        </div>
      ) : null}

      {!allPhotosOpen && step.mode === "complete" ? (
        <div className="mt-6">
          <CaptureComplete dto={dto} backHref={backHref} />
        </div>
      ) : null}

      <p className="sr-only">
        Workflow {LONGITUDINAL_CAPTURE_WORKFLOW}
      </p>
    </div>
  );
}
