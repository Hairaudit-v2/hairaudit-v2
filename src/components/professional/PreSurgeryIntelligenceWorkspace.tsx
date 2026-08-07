"use client";

/**
 * HA-PRE-SURGERY-INTELLIGENCE-2A — Clinician planning workspace client.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IMAGE_QUALITY_FLAGS,
  type ClinicalImageAnnotation,
  type ClinicalImageReview,
  type ClinicalObservation,
  type GraftPlanZone,
  type GraftZonePriority,
  type PreSurgeryApprovalChecklist,
  type PreSurgeryAuditEvent,
  type PreSurgeryGraftPlan,
  type PreSurgeryGraftPlanZoneRow,
  type PreSurgeryIllustrativeProjection,
  type PreSurgeryProjectionMode,
  type PreSurgeryProjectionRejectionReason,
  PRE_SURGERY_PROJECTION_PATIENT_LABELS,
} from "@/lib/preSurgeryIntelligence/types";
import {
  APPROVAL_CHECKLIST_KEYS,
  REJECTION_REASONS,
  emptyApprovalChecklist,
} from "@/lib/preSurgeryIntelligence/projection/approval";
import {
  IMAGE_ROLE_LABELS,
  PRE_SURGERY_IMAGE_ROLES,
  type PreSurgeryImageRole,
} from "@/lib/preSurgeryIntelligence/imageRoles";
import {
  OBSERVATION_DOMAIN_LABELS,
  OBSERVATION_CHOICE_SETS,
} from "@/lib/preSurgeryIntelligence/observations";
import { ANNOTATION_TYPE_LABELS } from "@/lib/preSurgeryIntelligence/annotations";
import { AUDIT_EVENT_LABELS } from "@/lib/preSurgeryIntelligence/auditTimeline";
import { computeGraftPlanTotals } from "@/lib/preSurgeryIntelligence/graftPlanTotals";
import ProjectionAuditorCorrectionPanel from "@/components/professional/ProjectionAuditorCorrectionPanel";
import SurgeryProjectionPlanSummary, {
  type ProjectionMediaState,
} from "@/components/professional/SurgeryProjectionPlanSummary";
import type { PlanComparisonView } from "@/lib/preSurgeryIntelligence/graftPlanCompare";
import { classifyProjectionStoragePath } from "@/lib/preSurgeryIntelligence/projectionAssetStatus";
import { ILLUSTRATIVE_SURGERY_PLAN_LABEL } from "@/lib/preSurgeryIntelligence/projectionDisplayCopy";

type WorkspaceImage = {
  uploadId: string;
  type: string | null;
  signedUrl: string | null;
  createdAt: string | null;
  review: ClinicalImageReview;
};

type WorkspacePayload = {
  ok: boolean;
  error?: string;
  images?: WorkspaceImage[];
  annotations?: ClinicalImageAnnotation[];
  observations?: ClinicalObservation[];
  graftPlans?: PreSurgeryGraftPlan[];
  planComparison?: PlanComparisonView;
  projections?: PreSurgeryIllustrativeProjection[];
  projectionMedia?: ProjectionMediaState[];
  auditEvents?: PreSurgeryAuditEvent[];
};

const PRIORITIES: GraftZonePriority[] = ["essential", "recommended", "optional", "defer"];
const PROJECTION_MODES: PreSurgeryProjectionMode[] = [
  "conservative",
  "planned",
  "optimistic_within_approved_range",
];

export default function PreSurgeryIntelligenceWorkspace({ caseId }: { caseId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<WorkspaceImage[]>([]);
  const [annotations, setAnnotations] = useState<ClinicalImageAnnotation[]>([]);
  const [observations, setObservations] = useState<ClinicalObservation[]>([]);
  const [graftPlans, setGraftPlans] = useState<PreSurgeryGraftPlan[]>([]);
  const [comparison, setComparison] = useState<PlanComparisonView | null>(null);
  const [projections, setProjections] = useState<PreSurgeryIllustrativeProjection[]>([]);
  const [projectionMedia, setProjectionMedia] = useState<Record<string, ProjectionMediaState>>({});
  const [auditEvents, setAuditEvents] = useState<PreSurgeryAuditEvent[]>([]);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [hideAnnotations, setHideAnnotations] = useState(false);
  const [showAiAnnotations, setShowAiAnnotations] = useState(true);
  const [showClinicianAnnotations, setShowClinicianAnnotations] = useState(true);
  const [draftZones, setDraftZones] = useState<PreSurgeryGraftPlanZoneRow[]>([]);
  const [clinicianNote, setClinicianNote] = useState("");
  const [donorBand, setDonorBand] = useState<PreSurgeryGraftPlan["donorAvailabilityBand"]>("not_assessable");
  const [sessionCount, setSessionCount] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);
  const [annotationType, setAnnotationType] =
    useState<ClinicalImageAnnotation["annotationType"]>("proposed_hairline");
  const [hairlineConfirmed, setHairlineConfirmed] = useState(false);
  const [treatmentConfirmed, setTreatmentConfirmed] = useState(false);
  const [approvalTargetId, setApprovalTargetId] = useState<string | null>(null);
  const [approvalChecklist, setApprovalChecklist] = useState<PreSurgeryApprovalChecklist>(
    emptyApprovalChecklist()
  );
  const [approvalNote, setApprovalNote] = useState("");
  const [rejectReasonCode, setRejectReasonCode] =
    useState<PreSurgeryProjectionRejectionReason>("other_safety_concern");

  const CHECKLIST_LABELS: Record<keyof PreSurgeryApprovalChecklist, string> = {
    correctPatientAndCase: "Correct patient and case",
    correctSourceImages: "Correct source images",
    correctApprovedGraftPlanVersion: "Correct approved graft-plan version",
    hairlineWithinApprovedPlan: "Hairline representation is within the approved plan",
    coverageZonesDoNotExceedPlan: "Coverage zones do not exceed the plan",
    deferredZonesRemainVisiblyDeferred: "Deferred zones remain visibly deferred",
    donorLimitationsNotMisrepresented: "Donor limitations are not misrepresented",
    densityNotPresentedAsGuaranteed: "Density is not presented as guaranteed",
    visualOutputDoesNotImplyExactFutureGrowth: "Visual output does not imply exact future growth",
    patientSafeDisclaimerPresent: "Patient-safe disclaimer is present",
    suitableToShare: "Projection is suitable to share",
  };

  const base = `/api/cases/${caseId}/pre-surgery-intelligence`;

  const applyPayload = useCallback((data: WorkspacePayload) => {
    if (data.images) setImages(data.images);
    if (data.annotations) setAnnotations(data.annotations);
    if (data.observations) setObservations(data.observations);
    if (data.graftPlans) {
      setGraftPlans(data.graftPlans);
      const current =
        [...data.graftPlans].reverse().find((p) => p.status !== "superseded") ?? data.graftPlans.at(-1);
      if (current) {
        setDraftZones(current.zones.map((z) => ({ ...z, evidenceImageIds: [...z.evidenceImageIds] })));
        setClinicianNote(current.clinicianNote ?? "");
        setDonorBand(current.donorAvailabilityBand);
        setSessionCount(current.proposedSessionCount);
      }
    }
    if (data.planComparison) setComparison(data.planComparison);
    if (data.projections) setProjections(data.projections);
    if (data.projectionMedia) {
      const next: Record<string, ProjectionMediaState> = {};
      for (const row of data.projectionMedia) next[row.projectionId] = row;
      setProjectionMedia(next);
    }
    if (data.auditEvents) setAuditEvents(data.auditEvents);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(base, { cache: "no-store" });
      const data = (await res.json()) as WorkspacePayload;
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to load workspace");
      applyPayload(data);
      if (!selectedImageId && data.images?.[0]) setSelectedImageId(data.images[0].uploadId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [applyPayload, base, selectedImageId]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, [caseId]);

  const initialise = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = (await res.json()) as WorkspacePayload;
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Initialise failed");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Initialise failed");
    } finally {
      setBusy(false);
    }
  };

  const selected = images.find((i) => i.uploadId === selectedImageId) ?? null;
  const currentPlan =
    [...graftPlans].reverse().find((p) => p.status !== "superseded") ?? graftPlans.at(-1) ?? null;
  const approvedPlan = [...graftPlans].reverse().find((p) => p.status === "approved") ?? null;

  const draftTotals = useMemo(() => computeGraftPlanTotals(draftZones), [draftZones]);

  const imageAnnotations = useMemo(() => {
    if (!selectedImageId || hideAnnotations) return [];
    return annotations.filter((a) => {
      if (a.imageId !== selectedImageId || a.deletedAt) return false;
      if (a.source === "ai_suggestion") return showAiAnnotations;
      return showClinicianAnnotations;
    });
  }, [annotations, hideAnnotations, selectedImageId, showAiAnnotations, showClinicianAnnotations]);

  const patchImage = async (patch: Record<string, unknown>) => {
    if (!selectedImageId) return;
    setBusy(true);
    try {
      const res = await fetch(`${base}/images`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId: selectedImageId, ...patch }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Update failed");
      setImages((prev) =>
        prev.map((img) =>
          img.uploadId === selectedImageId ? { ...img, review: data.review as ClinicalImageReview } : img
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const patchObservation = async (
    observation: ClinicalObservation,
    status: ClinicalObservation["status"],
    value?: ClinicalObservation["clinicianApprovedValue"]
  ) => {
    setBusy(true);
    try {
      const res = await fetch(`${base}/observations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          observationId: observation.id,
          status,
          clinicianApprovedValue: value ?? observation.clinicianApprovedValue ?? observation.aiProposedValue,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Observation update failed");
      setObservations((prev) =>
        prev.map((o) => (o.id === observation.id ? (data.observation as ClinicalObservation) : o))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Observation update failed");
    } finally {
      setBusy(false);
    }
  };

  const updateZone = (zone: GraftPlanZone, field: keyof PreSurgeryGraftPlanZoneRow, value: unknown) => {
    setDraftZones((prev) =>
      prev.map((z) => {
        if (z.zone !== zone) return z;
        const next = { ...z, [field]: value } as PreSurgeryGraftPlanZoneRow;
        if (field === "priority" && value === "defer") {
          next.minimumGrafts = 0;
          next.targetGrafts = 0;
          next.maximumGrafts = 0;
        }
        return next;
      })
    );
  };

  const savePlan = async (action: "save" | "approve", forceRebaseFromHead = false) => {
    if (!currentPlan) return;
    setBusy(true);
    try {
      const evidenceIds = images.slice(0, 3).map((i) => i.uploadId);
      const zones = draftZones.map((z) => ({
        ...z,
        evidenceImageIds: z.evidenceImageIds.length ? z.evidenceImageIds : evidenceIds,
      }));
      const res = await fetch(`${base}/graft-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          basePlanId: currentPlan.id,
          expectedBaseVersion: currentPlan.version,
          forceRebaseFromHead,
          zones,
          proposedSessionCount: sessionCount,
          donorAvailabilityBand: donorBand,
          clinicianNote,
          stageOneZones: zones
            .filter((z) => z.priority === "essential" || z.priority === "recommended")
            .map((z) => z.zone),
        }),
      });
      const data = await res.json();
      if (res.status === 409 && data.conflict) {
        setError(
          `Version conflict (head v${data.conflict.currentHeadVersion}). Reload, or force rebase from head.`
        );
        return;
      }
      if (!res.ok || !data.ok) {
        const issues = Array.isArray(data.issues)
          ? data.issues.map((i: { message: string }) => i.message).join("; ")
          : data.error;
        throw new Error(issues || "Plan save failed");
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Plan save failed");
    } finally {
      setBusy(false);
    }
  };

  const addPolylineAnnotation = async () => {
    if (!selectedImageId) return;
    // Bounded first-version: mid-scalp horizontal polyline (normalised).
    const coordinates =
      annotationType === "proposed_hairline" || annotationType === "existing_hairline"
        ? [
            { x: 0.2, y: 0.35 },
            { x: 0.35, y: 0.32 },
            { x: 0.5, y: 0.3 },
            { x: 0.65, y: 0.32 },
            { x: 0.8, y: 0.35 },
          ]
        : [
            { x: 0.3, y: 0.3 },
            { x: 0.7, y: 0.3 },
            { x: 0.7, y: 0.55 },
            { x: 0.3, y: 0.55 },
          ];
    const geometryType =
      annotationType === "proposed_hairline" || annotationType === "existing_hairline"
        ? "polyline"
        : "polygon";
    setBusy(true);
    try {
      const res = await fetch(`${base}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageId: selectedImageId,
          annotationType,
          geometryType,
          coordinates,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Annotation failed");
      setAnnotations((prev) => [...prev, data.annotation as ClinicalImageAnnotation]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Annotation failed");
    } finally {
      setBusy(false);
    }
  };

  const requestProjection = async (
    mode: PreSurgeryProjectionMode,
    opts?: {
      confirmCurrentApprovedPlan?: boolean;
      graftPlanId?: string;
      regeneratesFromProjectionId?: string | null;
      allowSupersededPlan?: boolean;
    }
  ) => {
    if (!selectedImageId || !approvedPlan) return;
    setBusy(true);
    try {
      const res = await fetch(`${base}/projection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          sourceImageId: selectedImageId,
          graftPlanId: opts?.graftPlanId ?? approvedPlan.id,
          proposedHairlineConfirmed: hairlineConfirmed,
          treatmentAreaConfirmed: treatmentConfirmed,
          confirmCurrentApprovedPlan: opts?.confirmCurrentApprovedPlan === true,
          allowSupersededPlan: opts?.allowSupersededPlan === true,
          regeneratesFromProjectionId: opts?.regeneratesFromProjectionId ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const errs = Array.isArray(data.errors)
          ? data.errors.map((e: { message: string }) => e.message).join("; ")
          : data.error;
        throw new Error(errs || "Projection failed");
      }
      setProjections((prev) => [data.projection as PreSurgeryIllustrativeProjection, ...prev]);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Projection failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-[var(--ha-muted-foreground)]">Loading planning workspace…</p>;
  }

  return (
    <div className="space-y-10" data-testid="pre-surgery-intelligence-workspace">
      {error ? (
        <div
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900"
          data-testid="psi-error"
        >
          {error}
          {error.includes("Version conflict") ? (
            <button
              type="button"
              className="ml-3 underline"
              data-testid="psi-force-rebase"
              onClick={() => void savePlan("save", true)}
            >
              Force rebase from head
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void initialise()}
          className="rounded-md bg-[var(--ha-primary)] px-3 py-1.5 text-sm font-medium text-[var(--ha-primary-foreground)] disabled:opacity-50"
        >
          Initialise AI proposals
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="rounded-md border border-[var(--ha-border)] px-3 py-1.5 text-sm"
        >
          Refresh
        </button>
      </div>

      {/* AREA 1 — Image analysis */}
      <section className="space-y-4">
        <header>
          <h2 className="text-lg font-semibold">Image analysis</h2>
          <p className="text-sm text-[var(--ha-muted-foreground)]">
            Confirm or correct each clinical image. Original AI assignments are preserved.
          </p>
        </header>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((img) => (
            <button
              key={img.uploadId}
              type="button"
              onClick={() => setSelectedImageId(img.uploadId)}
              className={`overflow-hidden rounded-md border text-left ${
                selectedImageId === img.uploadId
                  ? "border-[var(--ha-primary)] ring-1 ring-[var(--ha-ring)]"
                  : "border-[var(--ha-border)]"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {img.signedUrl ? (
                <img
                  src={img.signedUrl}
                  alt=""
                  className="h-36 w-full object-cover"
                  style={{
                    transform: `rotate(${img.review.orientationDegrees}deg)${img.review.mirrored ? " scaleX(-1)" : ""}`,
                  }}
                />
              ) : (
                <div className="flex h-36 items-center justify-center bg-[var(--ha-muted)] text-xs">No preview</div>
              )}
              <div className="space-y-0.5 p-2 text-xs">
                <div className="font-medium">{IMAGE_ROLE_LABELS[img.review.assignedRole]}</div>
                <div className="text-[var(--ha-muted-foreground)]">
                  {img.review.reviewStatus} · {img.review.requiredOrOptional} · {img.review.imageSource}
                </div>
                {img.review.originalAiConfidence != null ? (
                  <div className="text-[var(--ha-muted-foreground)]">
                    Classifier confidence: {Math.round(img.review.originalAiConfidence * 100)}%
                  </div>
                ) : null}
              </div>
            </button>
          ))}
          {images.length === 0 ? (
            <p className="text-sm text-[var(--ha-muted-foreground)]">No clinical images on this case yet.</p>
          ) : null}
        </div>

        {selected ? (
          <div className="grid gap-4 rounded-md border border-[var(--ha-border)] bg-[var(--ha-card)] p-4 lg:grid-cols-2">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {selected.signedUrl ? (
                <button type="button" onClick={() => setZoomUrl(selected.signedUrl)} className="block w-full">
                  <img
                    src={selected.signedUrl}
                    alt=""
                    className="max-h-80 w-full rounded object-contain"
                    style={{
                      transform: `rotate(${selected.review.orientationDegrees}deg)${
                        selected.review.mirrored ? " scaleX(-1)" : ""
                      }`,
                    }}
                  />
                </button>
              ) : null}
              {!hideAnnotations && imageAnnotations.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-[var(--ha-muted-foreground)]">
                  {imageAnnotations.map((a) => (
                    <li key={a.id} className={a.source === "ai_suggestion" ? "text-amber-700" : "text-emerald-700"}>
                      {a.source === "ai_suggestion" ? "AI" : "Clinician"}: {ANNOTATION_TYPE_LABELS[a.annotationType]} (
                      {a.geometryType}, {a.coordinates.length} pts)
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="space-y-3 text-sm">
              <label className="block">
                <span className="text-xs text-[var(--ha-muted-foreground)]">Assigned role</span>
                <select
                  className="mt-1 w-full rounded border border-[var(--ha-border)] bg-transparent px-2 py-1"
                  value={selected.review.assignedRole}
                  onChange={(e) => void patchImage({ assignedRole: e.target.value as PreSurgeryImageRole, reason: "Clinician role correction" })}
                >
                  {PRE_SURGERY_IMAGE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {IMAGE_ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-[var(--ha-muted-foreground)]">
                Original AI role: {selected.review.originalAiRole ? IMAGE_ROLE_LABELS[selected.review.originalAiRole] : "—"}
              </p>
              {selected.review.originalAiWarnings.length > 0 ? (
                <p className="text-xs text-amber-700">Warnings: {selected.review.originalAiWarnings.join("; ")}</p>
              ) : null}
              {selected.review.originalAiObservations.length > 0 ? (
                <p className="text-xs">AI observations: {selected.review.originalAiObservations.join("; ")}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => void patchImage({ orientationDegrees: ((selected.review.orientationDegrees + 90) % 360) as 0 | 90 | 180 | 270 })}>
                  Rotate 90°
                </button>
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => void patchImage({ mirrored: !selected.review.mirrored })}>
                  {selected.review.mirrored ? "Unmark mirrored" : "Mark mirrored"}
                </button>
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => void patchImage({ reviewStatus: "confirmed" })}>
                  Confirm image
                </button>
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => void patchImage({ reviewStatus: "unusable" })}>
                  Mark unusable
                </button>
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => void patchImage({ reviewStatus: "supplementary_only" })}>
                  Supplementary only
                </button>
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => void patchImage({ reviewStatus: "replacement_requested" })}>
                  Request replacement
                </button>
              </div>
              <fieldset className="space-y-1">
                <legend className="text-xs text-[var(--ha-muted-foreground)]">Quality flags</legend>
                <div className="flex flex-wrap gap-2">
                  {IMAGE_QUALITY_FLAGS.map((flag) => {
                    const on = selected.review.qualityFlags.includes(flag);
                    return (
                      <button
                        key={flag}
                        type="button"
                        className={`rounded px-2 py-0.5 text-xs ${on ? "bg-[var(--ha-muted)]" : "border border-[var(--ha-border)]"}`}
                        onClick={() => {
                          const next = on
                            ? selected.review.qualityFlags.filter((f) => f !== flag)
                            : [...selected.review.qualityFlags, flag];
                          void patchImage({ qualityFlags: next });
                        }}
                      >
                        {flag.replaceAll("_", " ")}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <label className="block">
                <span className="text-xs text-[var(--ha-muted-foreground)]">Image note</span>
                <textarea
                  className="mt-1 w-full rounded border border-[var(--ha-border)] bg-transparent px-2 py-1 text-sm"
                  rows={2}
                  defaultValue={selected.review.clinicianNote ?? ""}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (selected.review.clinicianNote ?? "")) {
                      void patchImage({ clinicianNote: v || null });
                    }
                  }}
                />
              </label>
            </div>
          </div>
        ) : null}
      </section>

      <SurgeryProjectionPlanSummary
        caseId={caseId}
        approvedPlan={approvedPlan}
        currentPlan={currentPlan}
        projections={projections}
        mediaByProjectionId={projectionMedia}
        imageReviews={images.map((img) => img.review)}
        sourceViews={images.map((img) => ({
          uploadId: img.uploadId,
          signedUrl: img.signedUrl,
          role: img.review.assignedRole,
        }))}
        busy={busy}
        onScrollToPlan={() => {
          document.getElementById("psi-graft-plan")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
        onGenerate={(req) =>
          void requestProjection(req.mode, {
            confirmCurrentApprovedPlan: true,
            graftPlanId: req.graftPlanId,
            allowSupersededPlan: req.allowSupersededPlan,
          })
        }
        onRetryFailed={(p) => {
          void requestProjection(p.mode, {
            confirmCurrentApprovedPlan: true,
            graftPlanId: approvedPlan?.id,
            regeneratesFromProjectionId: p.id,
          });
        }}
        onReplace={(p) => {
          const isStub =
            typeof p.storagePath === "string" && /\.stub$/i.test(p.storagePath);
          if (
            p.status === "failed" ||
            p.status === "validation_failed" ||
            p.status === "rejected" ||
            isStub
          ) {
            void requestProjection(p.mode, {
              confirmCurrentApprovedPlan: true,
              graftPlanId: approvedPlan?.id,
              regeneratesFromProjectionId: p.id,
            });
            return;
          }
          void requestProjection(p.mode, {
            confirmCurrentApprovedPlan: true,
            graftPlanId: approvedPlan?.id,
          });
        }}
        onOpenApprove={(p) => {
          setApprovalTargetId(p.id);
          setApprovalChecklist(emptyApprovalChecklist());
          setApprovalNote("");
          document.getElementById(`psi-projection-card-${p.id}`)?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }}
        onReject={(p) => {
          document.getElementById(`psi-projection-card-${p.id}`)?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
          setRejectReasonCode("other_safety_concern");
        }}
        onCorrect={(p) => {
          document.getElementById(`psi-projection-card-${p.id}`)?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }}
        onJumpToProjection={(id) => {
          document.getElementById(`psi-projection-card-${id}`)?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }}
      />

      {/* AREA 2 — Annotations */}
      <section className="space-y-3">
        <header>
          <h2 className="text-lg font-semibold">Structured annotations</h2>
          <p className="text-sm text-[var(--ha-muted-foreground)]">
            Normalised overlays. AI suggestions (amber) stay distinct from clinician-approved (green).
          </p>
        </header>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select
            className="rounded border border-[var(--ha-border)] bg-transparent px-2 py-1"
            value={annotationType}
            onChange={(e) => setAnnotationType(e.target.value as ClinicalImageAnnotation["annotationType"])}
          >
            {Object.entries(ANNOTATION_TYPE_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <button type="button" disabled={busy || !selectedImageId} className="rounded border px-2 py-1 text-xs" onClick={() => void addPolylineAnnotation()}>
            Add annotation on selected image
          </button>
          <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => setHideAnnotations((v) => !v)}>
            {hideAnnotations ? "Show annotations" : "Hide annotations"}
          </button>
          <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => setShowAiAnnotations((v) => !v)}>
            {showAiAnnotations ? "Hide AI suggestions" : "Show AI suggestions"}
          </button>
          <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => setShowClinicianAnnotations((v) => !v)}>
            {showClinicianAnnotations ? "Hide clinician-approved" : "Show clinician-approved"}
          </button>
        </div>
      </section>

      {/* AREA 3 — Observations */}
      <section className="space-y-3">
        <header>
          <h2 className="text-lg font-semibold">AI observation review</h2>
          <p className="text-sm text-[var(--ha-muted-foreground)]">
            Structured findings only — no internal model reasoning.
          </p>
        </header>
        <div className="space-y-2">
          {observations.map((obs) => {
            const choices = OBSERVATION_CHOICE_SETS[obs.domain];
            return (
              <div key={obs.id} className="rounded-md border border-[var(--ha-border)] p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{OBSERVATION_DOMAIN_LABELS[obs.domain]}</div>
                    <div className="text-xs text-[var(--ha-muted-foreground)]">
                      AI proposed: {obs.aiProposedValue == null ? "—" : String(obs.aiProposedValue)}
                      {obs.aiConfidence != null ? ` (${Math.round(obs.aiConfidence * 100)}%)` : ""}
                    </div>
                    <div className="text-xs">Status: {obs.status}</div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button type="button" className="rounded border px-2 py-0.5 text-xs" onClick={() => void patchObservation(obs, "confirmed", obs.aiProposedValue)}>
                      Confirm
                    </button>
                    <button type="button" className="rounded border px-2 py-0.5 text-xs" onClick={() => void patchObservation(obs, "insufficient_evidence", "Unable to assess from these images")}>
                      Unable to assess
                    </button>
                    <button type="button" className="rounded border px-2 py-0.5 text-xs" onClick={() => void patchObservation(obs, "rejected")}>
                      Reject
                    </button>
                  </div>
                </div>
                {choices ? (
                  <select
                    className="mt-2 w-full max-w-md rounded border border-[var(--ha-border)] bg-transparent px-2 py-1 text-xs"
                    value={String(obs.clinicianApprovedValue ?? "")}
                    onChange={(e) => void patchObservation(obs, "corrected", e.target.value)}
                  >
                    <option value="">Correct value…</option>
                    {choices.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            );
          })}
          {observations.length === 0 ? (
            <p className="text-sm text-[var(--ha-muted-foreground)]">Initialise AI proposals to load observations.</p>
          ) : null}
        </div>
      </section>

      {/* AREA 4 — Graft planning */}
      <section className="space-y-3 scroll-mt-4" id="psi-graft-plan" data-testid="psi-graft-plan">
        <header>
          <h2 className="text-lg font-semibold">Editable graft planning</h2>
          <p className="text-sm text-[var(--ha-muted-foreground)]">
            Graft / surgical plan (distinct from {ILLUSTRATIVE_SURGERY_PLAN_LABEL} images below). Totals recalculate from
            zone rows. Deferred zones do not contribute to procedure totals.
          </p>
        </header>

        <div className="overflow-x-auto rounded-md border border-[var(--ha-border)]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--ha-muted)] text-xs">
              <tr>
                <th className="px-2 py-2">Zone</th>
                <th className="px-2 py-2">Priority</th>
                <th className="px-2 py-2">Min</th>
                <th className="px-2 py-2">Target</th>
                <th className="px-2 py-2">Max</th>
              </tr>
            </thead>
            <tbody>
              {draftZones.map((z) => (
                <tr key={z.zone} className="border-t border-[var(--ha-border)]">
                  <td className="px-2 py-1.5 capitalize">{z.zone.replaceAll("_", " ")}</td>
                  <td className="px-2 py-1.5">
                    <select
                      className="rounded border border-[var(--ha-border)] bg-transparent px-1 py-0.5 text-xs"
                      value={z.priority}
                      onChange={(e) => updateZone(z.zone, "priority", e.target.value as GraftZonePriority)}
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </td>
                  {(["minimumGrafts", "targetGrafts", "maximumGrafts"] as const).map((field) => (
                    <td key={field} className="px-2 py-1.5">
                      <input
                        type="number"
                        min={0}
                        className="w-20 rounded border border-[var(--ha-border)] bg-transparent px-1 py-0.5 text-xs"
                        value={z[field]}
                        disabled={z.priority === "defer"}
                        onChange={(e) => updateZone(z.zone, field, Number(e.target.value) || 0)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-md border border-[var(--ha-border)] bg-[var(--ha-card)] p-4">
          <h3 className="text-sm font-medium">Scalp planning map</h3>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {draftZones.map((z) => (
              <li key={z.zone} className="flex justify-between gap-2 border-b border-[var(--ha-border)]/40 py-1">
                <span className="capitalize">{z.zone.replaceAll("_", " ")}</span>
                <span className="text-[var(--ha-muted-foreground)]">
                  {z.priority === "defer"
                    ? "deferred"
                    : `${z.minimumGrafts.toLocaleString()}–${z.maximumGrafts.toLocaleString()}`}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm font-medium">
            Total target: {draftTotals.totalTargetGrafts.toLocaleString()} grafts
            <span className="ml-2 font-normal text-[var(--ha-muted-foreground)]">
              (min {draftTotals.totalMinimumGrafts.toLocaleString()} · max {draftTotals.totalMaximumGrafts.toLocaleString()})
            </span>
          </p>
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <label>
            Sessions{" "}
            <select
              className="rounded border border-[var(--ha-border)] bg-transparent px-2 py-1"
              value={sessionCount}
              onChange={(e) => setSessionCount(Number(e.target.value) as 1 | 2 | 3)}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>
          <label>
            Donor availability{" "}
            <select
              className="rounded border border-[var(--ha-border)] bg-transparent px-2 py-1"
              value={donorBand}
              onChange={(e) => setDonorBand(e.target.value as PreSurgeryGraftPlan["donorAvailabilityBand"])}
            >
              <option value="apparently_limited">Apparently limited</option>
              <option value="cautious">Cautious</option>
              <option value="moderate">Moderate</option>
              <option value="favourable">Favourable</option>
              <option value="not_assessable">Not assessable</option>
            </select>
          </label>
        </div>
        <label className="block text-sm">
          Clinician rationale / note
          <textarea
            className="mt-1 w-full rounded border border-[var(--ha-border)] bg-transparent px-2 py-1"
            rows={2}
            value={clinicianNote}
            onChange={(e) => setClinicianNote(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy || !currentPlan} className="rounded-md border px-3 py-1.5 text-sm" data-testid="psi-save-plan" onClick={() => void savePlan("save")}>
            Save plan version
          </button>
          <button type="button" disabled={busy || !currentPlan} className="rounded-md bg-[var(--ha-primary)] px-3 py-1.5 text-sm font-medium text-[var(--ha-primary-foreground)]" data-testid="psi-approve-plan" onClick={() => void savePlan("approve")}>
            Approve graft plan
          </button>
        </div>
        {currentPlan ? (
          <p className="text-xs text-[var(--ha-muted-foreground)]">
            Current plan v{currentPlan.version} · status {currentPlan.status}
            {approvedPlan ? ` · approved v${approvedPlan.version}` : ""}
          </p>
        ) : (
          <p className="text-sm text-[var(--ha-muted-foreground)]">Initialise to seed an AI starting plan.</p>
        )}
      </section>

      </section>

      {/* AREA 6–8 — Projections detail */}
      <section className="space-y-3" data-testid="psi-projection-section" id="psi-projection-details">
        <header>
          <h2 className="text-lg font-semibold">{ILLUSTRATIVE_SURGERY_PLAN_LABEL} images</h2>
          <p className="text-sm text-[var(--ha-muted-foreground)]">
            Generated only after an approved graft plan and explicit clinician request. Labels are illustrative —
            never guaranteed results. Clinician approval with checklist is required before patient visibility.
            Forensic correction forms below are separate from the projected image itself.
          </p>
        </header>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={hairlineConfirmed} onChange={(e) => setHairlineConfirmed(e.target.checked)} />
            Proposed hairline confirmed
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={treatmentConfirmed} onChange={(e) => setTreatmentConfirmed(e.target.checked)} />
            Treatment area confirmed
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {PROJECTION_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              disabled={busy || !approvedPlan || !selectedImageId}
              className="rounded-md border border-[var(--ha-border)] px-3 py-1.5 text-sm disabled:opacity-50"
              data-testid={`psi-generate-projection-${mode}`}
              onClick={() =>
                void requestProjection(mode, {
                  confirmCurrentApprovedPlan: true,
                  graftPlanId: approvedPlan?.id,
                })
              }
            >
              Generate {PRE_SURGERY_PROJECTION_PATIENT_LABELS[mode]}
            </button>
          ))}
        </div>
        {!approvedPlan ? (
          <p className="text-sm text-amber-800">Approve a graft plan before generating projections.</p>
        ) : null}
        {projections.length === 0 ? (
          <p className="text-sm text-[var(--ha-muted-foreground)]" data-testid="psi-projection-empty">
            No illustrative projection records yet. Use Generate above or from the Surgery Projection Plan summary.
          </p>
        ) : null}
        <ul className="space-y-2 text-sm">
          {projections.map((p) => {
            const media = projectionMedia[p.id];
            const asset = classifyProjectionStoragePath(p.storagePath);
            const failed = p.status === "failed" || p.status === "validation_failed";
            return (
            <li
              key={p.id}
              id={`psi-projection-card-${p.id}`}
              className="scroll-mt-4 rounded-md border border-[var(--ha-border)] p-3"
              data-testid={`psi-projection-${p.mode}`}
            >
              <div className="mb-2 overflow-hidden rounded border border-[var(--ha-border)] bg-[var(--ha-muted)]/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {media?.projectedSignedUrl ? (
                  <img
                    src={media.projectedSignedUrl}
                    alt=""
                    className="max-h-64 w-full object-contain"
                    data-testid={`psi-projection-image-${p.mode}`}
                  />
                ) : (
                  <div
                    className="flex min-h-28 flex-col items-center justify-center gap-1 p-4 text-center text-xs"
                    data-testid={`psi-projection-asset-state-${p.mode}`}
                  >
                    {failed ? (
                      <p className="font-semibold text-red-800">Generation failed — use Retry failed generation above.</p>
                    ) : media?.loadError ? (
                      <p className="font-semibold text-red-800">
                        Asset loading error: {media.loadError}
                      </p>
                    ) : asset.kind === "stub_placeholder" ? (
                      <>
                        <p className="font-semibold text-amber-900">Stub placeholder — no illustrative image file stored</p>
                        <p className="text-[var(--ha-muted-foreground)]">{asset.message}</p>
                        {media?.sourceSignedUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={media.sourceSignedUrl}
                            alt=""
                            className="mt-2 max-h-32 opacity-50"
                          />
                        ) : null}
                      </>
                    ) : (
                      <p className="text-[var(--ha-muted-foreground)]">{asset.message}</p>
                    )}
                  </div>
                )}
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ha-muted-foreground)]">
                {ILLUSTRATIVE_SURGERY_PLAN_LABEL}
              </div>
              <div className="font-medium">{p.patientSafeLabel}</div>
              <div className="text-xs text-[var(--ha-muted-foreground)]">
                Status {p.status} · plan v{p.graftPlanVersion} · attempt v{p.projectionVersion ?? 1} · engine{" "}
                {p.engineVersion}
                {p.status !== "approved" ? " · not patient-visible" : " · clinician-approved for patient view"}
                {p.patientSharingEnabled ? " · sharing enabled" : ""}
              </div>
              {p.patientSafeDisclaimer ? (
                <p className="mt-1 text-xs text-[var(--ha-muted-foreground)]">{p.patientSafeDisclaimer}</p>
              ) : null}
              <ul className="mt-1 list-disc pl-4 text-xs text-[var(--ha-muted-foreground)]">
                {p.limitations.slice(0, 3).map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              {(p.status === "generated" || p.status === "clinician_review") && approvalTargetId !== p.id ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded border px-2 py-0.5 text-xs"
                    data-testid={`psi-open-approve-projection-${p.mode}`}
                    disabled={busy}
                    onClick={() => {
                      setApprovalTargetId(p.id);
                      setApprovalChecklist(emptyApprovalChecklist());
                      setApprovalNote("");
                    }}
                  >
                    Open clinician approval checklist
                  </button>
                  <label className="flex items-center gap-1 text-xs">
                    Reject
                    <select
                      className="rounded border px-1 py-0.5"
                      value={rejectReasonCode}
                      onChange={(e) =>
                        setRejectReasonCode(e.target.value as PreSurgeryProjectionRejectionReason)
                      }
                      data-testid={`psi-reject-reason-${p.mode}`}
                    >
                      {REJECTION_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="rounded border px-2 py-0.5 text-xs"
                    data-testid={`psi-reject-projection-${p.mode}`}
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const res = await fetch(`${base}/projection/approve`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            projectionId: p.id,
                            action: "reject",
                            reasonCode: rejectReasonCode,
                            reason: rejectReasonCode,
                          }),
                        });
                        const data = await res.json();
                        if (!res.ok || !data.ok) throw new Error(data.error ?? "Reject failed");
                        await refresh();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Reject failed");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Reject
                  </button>
                </div>
              ) : null}
              {approvalTargetId === p.id ? (
                <div
                  className="mt-3 space-y-2 rounded border border-[var(--ha-border)] bg-[var(--ha-muted)]/20 p-3"
                  data-testid={`psi-approval-checklist-${p.mode}`}
                >
                  <p className="text-xs font-medium">Confirm all items before approving for patient view</p>
                  {APPROVAL_CHECKLIST_KEYS.map((key) => (
                    <label key={key} className="flex items-start gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={approvalChecklist[key]}
                        data-testid={`psi-checklist-${key}`}
                        onChange={(e) =>
                          setApprovalChecklist((prev) => ({ ...prev, [key]: e.target.checked }))
                        }
                      />
                      <span>{CHECKLIST_LABELS[key]}</span>
                    </label>
                  ))}
                  <textarea
                    className="w-full rounded border px-2 py-1 text-xs"
                    rows={2}
                    placeholder="Optional approval note"
                    value={approvalNote}
                    onChange={(e) => setApprovalNote(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded border bg-[var(--ha-primary)] px-2 py-1 text-xs text-[var(--ha-primary-foreground)]"
                      data-testid={`psi-approve-projection-${p.mode}`}
                      disabled={busy || !APPROVAL_CHECKLIST_KEYS.every((k) => approvalChecklist[k])}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const res = await fetch(`${base}/projection/approve`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              projectionId: p.id,
                              action: "approve",
                              checklist: approvalChecklist,
                              approvalNote: approvalNote || null,
                            }),
                          });
                          const data = await res.json();
                          if (!res.ok || !data.ok) throw new Error(data.error ?? "Approve failed");
                          setApprovalTargetId(null);
                          await refresh();
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Approve failed");
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Approve for patient view
                    </button>
                    <button
                      type="button"
                      className="rounded border px-2 py-1 text-xs"
                      onClick={() => setApprovalTargetId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
              {(p.status === "rejected" || p.status === "failed" || p.status === "validation_failed") ? (
                <button
                  type="button"
                  className="mt-2 rounded border px-2 py-0.5 text-xs"
                  data-testid={`psi-regenerate-projection-${p.mode}`}
                  disabled={busy || !approvedPlan || !selectedImageId}
                  onClick={async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      const res = await fetch(`${base}/projection`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          mode: p.mode,
                          sourceImageId: selectedImageId ?? p.sourceImageId,
                          graftPlanId: approvedPlan?.id,
                          proposedHairlineConfirmed: hairlineConfirmed,
                          treatmentAreaConfirmed: treatmentConfirmed,
                          regeneratesFromProjectionId: p.id,
                          confirmCurrentApprovedPlan: true,
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok || !data.ok) {
                        throw new Error(data.errors?.[0]?.message ?? data.error ?? "Regenerate failed");
                      }
                      await refresh();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Regenerate failed");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Regenerate (new attempt)
                </button>
              ) : null}
              {p.status === "approved" ? (
                <button
                  type="button"
                  className="mt-2 rounded border px-2 py-0.5 text-xs"
                  data-testid={`psi-revoke-sharing-${p.mode}`}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const res = await fetch(`${base}/projection/approve`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ projectionId: p.id, action: "revoke_sharing" }),
                      });
                      const data = await res.json();
                      if (!res.ok || !data.ok) throw new Error(data.error ?? "Revoke failed");
                      await refresh();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Revoke failed");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Revoke patient sharing
                </button>
              ) : null}
              {p.status === "approved" ? (
                <div className="mt-3">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                    Projection correction request (forensic / internal)
                  </p>
                  <ProjectionAuditorCorrectionPanel
                    caseId={caseId}
                    projectionSnapshotId={p.id}
                    projectionVersion={p.projectionVersion ?? 1}
                  />
                </div>
              ) : null}
            </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-2" data-testid="psi-plan-comparison-audit">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md border border-[var(--ha-border)] px-3 py-2 text-left text-sm"
          data-testid="psi-timeline-toggle"
          aria-expanded={timelineOpen}
          onClick={() => setTimelineOpen((v) => !v)}
        >
          <span>
            <span className="font-semibold">Plan comparison & audit timeline</span>
            <span className="ml-2 text-xs text-[var(--ha-muted-foreground)]">
              {auditEvents.length} event{auditEvents.length === 1 ? "" : "s"}
              {auditEvents[0]
                ? ` · latest: ${AUDIT_EVENT_LABELS[auditEvents[0].eventType] ?? auditEvents[0].eventType}`
                : ""}
            </span>
          </span>
          <span className="text-xs text-[var(--ha-muted-foreground)]">{timelineOpen ? "Collapse" : "Expand"}</span>
        </button>
        {timelineOpen ? (
          <div className="space-y-3 rounded-md border border-[var(--ha-border)] p-3">
            {comparison?.vsAi ? (
              <div className="text-sm">
                <p>
                  vs AI start: target Δ {comparison.vsAi.totalTargetDelta >= 0 ? "+" : ""}
                  {comparison.vsAi.totalTargetDelta}; zones added [{comparison.vsAi.zonesAdded.join(", ") || "—"}];
                  removed [{comparison.vsAi.zonesRemoved.join(", ") || "—"}]; session changed:{" "}
                  {comparison.vsAi.sessionCountChanged ? "yes" : "no"}; donor caution changed:{" "}
                  {comparison.vsAi.donorCautionChanged ? "yes" : "no"}; hairline changed:{" "}
                  {comparison.vsAi.proposedHairlineChanged ? "yes" : "no"}; deferred changed:{" "}
                  {comparison.vsAi.deferredTreatmentChanged ? "yes" : "no"}
                </p>
              </div>
            ) : (
              <p className="text-sm text-[var(--ha-muted-foreground)]">No comparison yet.</p>
            )}
            <ol className="space-y-1 border-l border-[var(--ha-border)] pl-4 text-sm">
              {auditEvents.map((ev) => (
                <li key={ev.id}>
                  <span className="text-xs text-[var(--ha-muted-foreground)]">
                    {new Date(ev.createdAt).toLocaleString()}
                  </span>{" "}
                  {AUDIT_EVENT_LABELS[ev.eventType] ?? ev.eventType}
                </li>
              ))}
              {auditEvents.length === 0 ? (
                <li className="text-[var(--ha-muted-foreground)]">No audit events yet.</li>
              ) : null}
            </ol>
          </div>
        ) : null}
      </section>

      {zoomUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setZoomUrl(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoomUrl} alt="" className="max-h-full max-w-full object-contain" />
        </div>
      ) : null}
    </div>
  );
}
