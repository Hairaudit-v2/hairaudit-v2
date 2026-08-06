"use client";

import { useRef, useState } from "react";
import CaptureReferencePanel from "./CaptureReferencePanel";
import type { GuidedCaptureViewDto } from "@/lib/outcomeIntelligence/guidedCaptureDto";
import { LONGITUDINAL_CAPTURE_WORKFLOW } from "@/lib/outcomeIntelligence/longitudinalFollowupUploadAllowance";
import {
  uploadPatientPhotoFiles,
  type PerFileUploadState,
} from "@/lib/uploads/uploadPatientPhotos";
import { toPatientFacingUploadError } from "@/lib/uploads/patientUploadClient";

type UploadPhase = "idle" | "uploading" | "uploaded" | "needs_retry";

function mapCaptureRoleToSessionRole(viewKey: string): string {
  const k = viewKey.toLowerCase();
  if (k.includes("top")) return "top";
  if (k.includes("crown")) return "crown";
  if (k.includes("donor") && k.includes("close")) return "donor_closeup";
  if (k.includes("donor")) return "donor_rear";
  if (k.includes("close")) return "recipient_closeup";
  if (k.includes("left")) return "left";
  if (k.includes("right")) return "right";
  return "front";
}

export default function GuidedCaptureViewStep({
  caseId,
  stage,
  view,
  recommendedNote,
  referenceMatchNote,
  representativeNote,
  capturePolicyVersion,
  canUpload,
  onUploaded,
  onContinue,
  onSkipRecommended,
  encouragement,
  photoSessionId,
}: {
  caseId: string;
  stage: string;
  view: GuidedCaptureViewDto;
  recommendedNote: string;
  referenceMatchNote: string;
  representativeNote: string;
  capturePolicyVersion: string;
  canUpload: boolean;
  onUploaded: () => Promise<void>;
  onContinue: () => void;
  onSkipRecommended?: () => void;
  encouragement?: string | null;
  photoSessionId?: string | null;
}) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<UploadPhase>(
    view.complete ? "uploaded" : "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [fileStates, setFileStates] = useState<PerFileUploadState[]>([]);
  const [busy, setBusy] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files?.length || !canUpload) return;
    setBusy(true);
    setError(null);
    setPhase("uploading");

    try {
      // If replacing, delete existing first when we have an upload id.
      if (view.currentImage.uploadId) {
        const del = await fetch(
          `/api/uploads/delete?uploadId=${encodeURIComponent(view.currentImage.uploadId)}`,
          { method: "DELETE" }
        );
        if (!del.ok) {
          const json = await del.json().catch(() => ({}));
          // Month-banded replaces may still fail if delete blocked; continue to upload additive.
          if (del.status !== 409) {
            throw new Error(
              String((json as { error?: string }).error ?? "Could not replace photo")
            );
          }
        }
      }

      const result = await uploadPatientPhotoFiles({
        caseId,
        category: view.uploadCategory,
        files: Array.from(files),
        submitterType: "patient",
        onFileStateChange: setFileStates,
        extraFormFields: {
          captureWorkflow: LONGITUDINAL_CAPTURE_WORKFLOW,
          captureStage: stage,
          captureRole: view.key,
          referenceUsed: view.referenceImage.available ? "true" : "false",
          capturePolicyVersion,
          clientCaptureTimestamp: new Date().toISOString(),
          ...(photoSessionId
            ? {
                photoSessionId,
                detectedRole: mapCaptureRoleToSessionRole(view.key),
                roleConfidence: "0.95",
              }
            : {}),
        },
      });

      if (result.successCount < 1) {
        setPhase("needs_retry");
        setError(
          result.partialErrors[0]?.error ??
            "That photo didn't upload. Your other photos are safe — please try this one again."
        );
        return;
      }

      setPhase("uploaded");
      await onUploaded();
    } catch (e) {
      setPhase("needs_retry");
      setError(
        toPatientFacingUploadError(
          (e as Error)?.message ??
            "That photo didn't upload. Your other photos are safe — please try this one again."
        )
      );
    } finally {
      setBusy(false);
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (libraryInputRef.current) libraryInputRef.current.value = "";
    }
  }

  const statusText =
    phase === "uploading"
      ? "Uploading"
      : phase === "uploaded" || view.complete
        ? "Uploaded"
        : phase === "needs_retry"
          ? "Needs retry"
          : view.required
            ? "Required"
            : "Recommended";

  return (
    <section
      className="space-y-4"
      data-testid="guided-capture-view-step"
      aria-labelledby="guided-capture-view-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {view.required ? "Required" : "Recommended"}
          </p>
          <h2
            id="guided-capture-view-title"
            className="mt-1 text-xl font-semibold text-slate-900"
          >
            {view.label}
          </h2>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-800"
          data-testid="guided-capture-view-status"
        >
          <span aria-hidden="true">
            {phase === "uploaded" || view.complete
              ? "✓"
              : phase === "needs_retry"
                ? "!"
                : "○"}
          </span>
          {statusText}
        </span>
      </div>

      {!view.required ? (
        <p className="text-sm text-slate-600">{recommendedNote}</p>
      ) : null}

      <p className="text-sm text-slate-600">{view.whyRequested}</p>

      <CaptureReferencePanel
        available={view.referenceImage.available}
        url={view.referenceImage.url}
        label={view.referenceImage.label}
        matchNote={referenceMatchNote}
        viewLabel={view.label}
      />

      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-medium text-slate-800">Capture this view</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          {view.instructions.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="pt-2 text-sm text-slate-600">{representativeNote}</p>
      </div>

      {view.currentImage.available && view.currentImage.url ? (
        <figure className="overflow-hidden rounded-xl border border-slate-200">
          <figcaption className="px-3 py-2 text-xs font-medium text-slate-600">
            Your upload
          </figcaption>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={view.currentImage.url}
            alt={`Uploaded ${view.label}`}
            className="max-h-64 w-full object-contain bg-slate-50"
          />
        </figure>
      ) : null}

      {encouragement ? (
        <p
          className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
          data-testid="guided-capture-encouragement"
          role="status"
        >
          {encouragement}
        </p>
      ) : null}

      {error ? (
        <p
          className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900"
          role="alert"
          data-testid="guided-capture-upload-error"
        >
          {error}
        </p>
      ) : null}

      {fileStates.some((s) => s.phase === "uploading" || s.phase === "compressing") ? (
        <p className="text-sm text-slate-600" aria-live="polite">
          Uploading… {fileStates[0]?.progress ?? 0}%
        </p>
      ) : null}

      {canUpload ? (
        <div className="flex flex-col gap-3 pt-1">
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            aria-label={`Take photo for ${view.label}`}
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <input
            ref={libraryInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label={`Choose existing photo for ${view.label}`}
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <button
            type="button"
            disabled={busy}
            className="min-h-12 w-full rounded-xl bg-slate-900 px-4 text-base font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-60"
            data-testid="guided-capture-take-photo"
            onClick={() => cameraInputRef.current?.click()}
          >
            {view.complete || phase === "uploaded" ? "Retake photo" : "Take photo"}
          </button>
          <button
            type="button"
            disabled={busy}
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base font-semibold text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-60"
            data-testid="guided-capture-choose-photo"
            onClick={() => libraryInputRef.current?.click()}
          >
            {view.complete || phase === "uploaded" ? "Replace from library" : "Choose existing photo"}
          </button>
          {(view.complete || phase === "uploaded") && (
            <button
              type="button"
              className="min-h-12 w-full rounded-xl bg-teal-700 px-4 text-base font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              data-testid="guided-capture-continue"
              onClick={onContinue}
            >
              Continue
            </button>
          )}
          {!view.required && onSkipRecommended ? (
            <button
              type="button"
              className="min-h-11 w-full text-sm font-medium text-slate-600 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
              data-testid="guided-capture-skip-recommended"
              onClick={onSkipRecommended}
            >
              Skip for now
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-slate-600">
          Photo upload is not available for this follow-up right now.
        </p>
      )}

      {/* Keep workflow constants referenced for future FormData wiring / tests */}
      <span className="sr-only">
        {LONGITUDINAL_CAPTURE_WORKFLOW}:{stage}:{capturePolicyVersion}
      </span>
    </section>
  );
}
