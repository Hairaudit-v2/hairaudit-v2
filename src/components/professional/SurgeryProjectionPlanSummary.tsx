"use client";

/**
 * HA-PRE-SURGERY-PROJECTION-REAL-ASSET-1A — Surgery Projection Plan summary.
 * Real-asset thumbnails, plan confirmation, accuracy review, historical stub marking.
 */

import { useMemo, useState } from "react";
import type { ClinicalImageReview, PreSurgeryGraftPlan, PreSurgeryIllustrativeProjection } from "@/lib/preSurgeryIntelligence/types";
import { PRE_SURGERY_PROJECTION_PATIENT_LABELS } from "@/lib/preSurgeryIntelligence/types";
import { computeGraftPlanTotals } from "@/lib/preSurgeryIntelligence/graftPlanTotals";
import {
  classifyProjectionStoragePath,
  clinicianProjectionLifecycleLabel,
  projectionMatchesCurrentPlan,
} from "@/lib/preSurgeryIntelligence/projectionAssetStatus";
import {
  ILLUSTRATIVE_SURGERY_PLAN_LABEL,
  ILLUSTRATIVE_SURGERY_PLAN_SUPPORTING_TEXT,
  labelForProjectionProvider,
} from "@/lib/preSurgeryIntelligence/projectionDisplayCopy";

export type ProjectionMediaState = {
  projectionId: string;
  assetKind: ReturnType<typeof classifyProjectionStoragePath>["kind"];
  assetMessage: string;
  sourceSignedUrl: string | null;
  projectedSignedUrl: string | null;
  loadError: string | null;
};

export type GenerateProjectionRequest = {
  mode: PreSurgeryIllustrativeProjection["mode"];
  confirmCurrentApprovedPlan: true;
  allowSupersededPlan?: boolean;
  graftPlanId: string;
};

type Props = {
  caseId: string;
  approvedPlan: PreSurgeryGraftPlan | null;
  currentPlan: PreSurgeryGraftPlan | null;
  projections: PreSurgeryIllustrativeProjection[];
  mediaByProjectionId: Record<string, ProjectionMediaState>;
  imageReviews: ClinicalImageReview[];
  sourceViews: Array<{ uploadId: string; signedUrl: string | null; role: string }>;
  busy: boolean;
  onScrollToPlan: () => void;
  onGenerate: (req: GenerateProjectionRequest) => void;
  onRetryFailed: (projection: PreSurgeryIllustrativeProjection) => void;
  onReplace: (projection: PreSurgeryIllustrativeProjection) => void;
  onOpenApprove: (projection: PreSurgeryIllustrativeProjection) => void;
  onReject: (projection: PreSurgeryIllustrativeProjection) => void;
  onCorrect: (projection: PreSurgeryIllustrativeProjection) => void;
  onJumpToProjection: (projectionId: string) => void;
};

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function sharingLabel(p: PreSurgeryIllustrativeProjection): string {
  if (p.status === "approved" && p.patientSharingEnabled) return "Approved for patient sharing";
  if (p.status === "approved") return "Clinician-only (sharing off)";
  return "Clinician-only";
}

export default function SurgeryProjectionPlanSummary({
  approvedPlan,
  currentPlan,
  projections,
  mediaByProjectionId,
  imageReviews,
  sourceViews,
  busy,
  onScrollToPlan,
  onGenerate,
  onRetryFailed,
  onReplace,
  onOpenApprove,
  onReject,
  onCorrect,
  onJumpToProjection,
}: Props) {
  const plan = approvedPlan ?? currentPlan;
  const totals = plan ? computeGraftPlanTotals(plan.zones) : null;
  const [pendingMode, setPendingMode] = useState<PreSurgeryIllustrativeProjection["mode"] | null>(
    null
  );
  const [confirmPlan, setConfirmPlan] = useState(false);
  const [inspectId, setInspectId] = useState<string | null>(null);

  const inspectProjection = useMemo(
    () => (inspectId ? projections.find((p) => p.id === inspectId) ?? null : null),
    [inspectId, projections]
  );
  const inspectMedia = inspectProjection ? mediaByProjectionId[inspectProjection.id] : null;

  const sourceRoles = imageReviews
    .filter((r) => r.assignedRole === "frontal" || r.assignedRole === "overhead")
    .map((r) => `${r.assignedRole} (${r.reviewStatus})`);

  return (
    <section
      id="psi-surgery-projection-plan"
      data-testid="psi-surgery-projection-plan"
      className="scroll-mt-4 space-y-4 rounded-lg border-2 border-[var(--ha-primary)]/40 bg-[var(--ha-card)] p-4 shadow-sm"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ha-muted-foreground)]">
            Surgery Projection Plan
          </p>
          <h2 className="text-lg font-semibold text-[var(--ha-foreground)]">
            Graft plan + {ILLUSTRATIVE_SURGERY_PLAN_LABEL}
          </h2>
          <p className="mt-1 text-sm text-[var(--ha-muted-foreground)]">
            {ILLUSTRATIVE_SURGERY_PLAN_SUPPORTING_TEXT} Distinct from source photos and from forensic
            correction requests. Reserve “Projected Outcome” for ImagingOS cosmetic simulations.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border border-[var(--ha-border)] px-3 py-1.5 text-xs font-medium"
            data-testid="psi-spp-view-full-plan"
            onClick={onScrollToPlan}
          >
            View full plan
          </button>
          <button
            type="button"
            className="rounded-md border border-[var(--ha-border)] px-3 py-1.5 text-xs font-medium"
            data-testid="psi-spp-edit-graft-plan"
            onClick={onScrollToPlan}
          >
            Edit graft plan
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-[var(--ha-border)] p-3 text-sm">
          <div className="text-[11px] font-semibold uppercase text-[var(--ha-muted-foreground)]">
            Graft / surgical plan
          </div>
          {plan ? (
            <>
              <div className="mt-1 font-medium">
                Status {plan.status} · v{plan.version}
              </div>
              <div className="text-xs text-[var(--ha-muted-foreground)]">
                Target {totals?.totalTargetGrafts.toLocaleString() ?? "—"} grafts
                {" · "}
                min {totals?.totalMinimumGrafts.toLocaleString() ?? "—"} / max{" "}
                {totals?.totalMaximumGrafts.toLocaleString() ?? "—"}
              </div>
              <ul className="mt-2 max-h-28 space-y-0.5 overflow-auto text-xs text-[var(--ha-muted-foreground)]">
                {plan.zones.map((z) => (
                  <li key={z.zone} className="flex justify-between gap-2">
                    <span className="capitalize">{z.zone.replaceAll("_", " ")}</span>
                    <span>
                      {z.priority === "defer" ? "deferred" : `${z.targetGrafts.toLocaleString()} tgt`}
                    </span>
                  </li>
                ))}
              </ul>
              {sourceRoles.length > 0 ? (
                <p className="mt-2 text-[11px] text-[var(--ha-muted-foreground)]">
                  Source views: {sourceRoles.join(", ")}
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-xs text-amber-800">No graft plan yet. Initialise or save a plan below.</p>
          )}
        </div>

        <div className="rounded-md border border-[var(--ha-border)] p-3 text-sm sm:col-span-2">
          <div className="text-[11px] font-semibold uppercase text-[var(--ha-muted-foreground)]">
            {ILLUSTRATIVE_SURGERY_PLAN_LABEL}
          </div>
          <p className="mt-1 text-xs text-[var(--ha-muted-foreground)]">
            {ILLUSTRATIVE_SURGERY_PLAN_SUPPORTING_TEXT}
          </p>
          {!approvedPlan ? (
            <p className="mt-2 text-sm text-amber-800" data-testid="psi-spp-empty-needs-plan">
              Approve a graft plan before generating illustrative projections.
            </p>
          ) : (
            <>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["planned", "conservative", "optimistic_within_approved_range"] as const).map(
                  (mode) => (
                    <button
                      key={mode}
                      type="button"
                      disabled={busy}
                      className="rounded-md bg-[var(--ha-primary)] px-3 py-1.5 text-xs font-medium text-[var(--ha-primary-foreground)] disabled:opacity-50"
                      data-testid={`psi-spp-generate-${mode}`}
                      onClick={() => {
                        setPendingMode(mode);
                        setConfirmPlan(false);
                      }}
                    >
                      Generate {PRE_SURGERY_PROJECTION_PATIENT_LABELS[mode]}
                    </button>
                  )
                )}
              </div>

              {projections.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--ha-muted-foreground)]" data-testid="psi-spp-empty-no-projections">
                  No illustrative projection records on this case yet.
                </p>
              ) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {projections.map((p) => {
                    const media = mediaByProjectionId[p.id];
                    const match = projectionMatchesCurrentPlan({
                      projectionGraftPlanId: p.graftPlanId,
                      projectionGraftPlanVersion: p.graftPlanVersion,
                      currentApprovedPlanId: approvedPlan?.id ?? null,
                      currentApprovedPlanVersion: approvedPlan?.version ?? null,
                    });
                    const asset = classifyProjectionStoragePath(p.storagePath);
                    const isStub = asset.kind === "stub_placeholder";
                    const failed = p.status === "failed" || p.status === "validation_failed";
                    const showImg = Boolean(media?.projectedSignedUrl) && !isStub;
                    const historicalUnavailable = isStub || !match.matches;
                    return (
                      <article
                        key={p.id}
                        className="overflow-hidden rounded-md border border-[var(--ha-border)] bg-[var(--ha-background)]"
                        data-testid={`psi-spp-thumb-${p.mode}`}
                        data-projection-id={p.id}
                      >
                        <div className="relative flex h-36 items-center justify-center bg-[var(--ha-muted)]/40">
                          {showImg ? (
                            // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={media!.projectedSignedUrl!}
                          alt={`${ILLUSTRATIVE_SURGERY_PLAN_LABEL} thumbnail`}
                          className="h-full w-full object-cover"
                        />
                          ) : media?.sourceSignedUrl && isStub ? (
                            <div className="relative h-full w-full">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={media.sourceSignedUrl}
                                alt=""
                                className="h-full w-full object-cover opacity-40"
                              />
                              <div className="absolute inset-0 flex items-center justify-center p-2 text-center text-[11px] font-semibold text-amber-950">
                                Stub generation — no image asset produced.
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 text-center text-xs text-[var(--ha-muted-foreground)]">
                              {failed
                                ? "Generation failed"
                                : media?.loadError
                                  ? "Asset loading error"
                                  : asset.message}
                            </div>
                          )}
                        </div>
                        <div className="space-y-1 p-2 text-xs">
                          <div className="font-medium">
                            {labelForProjectionProvider(p.providerId).label}
                            {" · "}
                            {p.patientSafeLabel}
                          </div>
                          <div className="text-[var(--ha-muted-foreground)]">
                            {historicalUnavailable && isStub
                              ? "Historical / unavailable"
                              : clinicianProjectionLifecycleLabel(p.status)}
                            {" · "}
                            {sharingLabel(p)}
                            {" · "}plan v{p.graftPlanVersion}
                          </div>
                          <div className="text-[10px] text-[var(--ha-muted-foreground)]">
                            {p.providerId ?? "—"} / {p.providerModelVersion ?? "—"}
                          </div>
                          {isStub ? (
                            <p className="font-medium text-amber-800" data-testid={`psi-spp-stub-${p.id}`}>
                              Stub generation — no image asset produced.
                            </p>
                          ) : null}
                          {!match.matches ? (
                            <p className="text-amber-800">{match.reason}</p>
                          ) : null}
                          {media?.loadError ? (
                            <p className="text-red-700" data-testid={`psi-spp-asset-error-${p.mode}`}>
                              Asset loading error: {media.loadError}
                            </p>
                          ) : null}
                          <p className="text-[10px] text-[var(--ha-muted-foreground)]">
                            Generated {formatWhen(p.generatedAt ?? p.requestedAt)}
                            {p.approvedAt ? ` · reviewed ${formatWhen(p.approvedAt)}` : ""}
                          </p>
                          <div className="flex flex-wrap gap-1 pt-1">
                            {showImg ? (
                              <button
                                type="button"
                                className="rounded border px-2 py-0.5"
                                data-testid={`psi-spp-inspect-${p.id}`}
                                onClick={() => setInspectId(p.id)}
                              >
                                Inspect
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="rounded border px-2 py-0.5"
                              onClick={() => onJumpToProjection(p.id)}
                            >
                              Open details
                            </button>
                            {!isStub &&
                              (p.status === "generated" || p.status === "clinician_review") && (
                                <>
                                  <button
                                    type="button"
                                    className="rounded border px-2 py-0.5"
                                    disabled={busy}
                                    data-testid={`psi-spp-approve-${p.mode}`}
                                    onClick={() => onOpenApprove(p)}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded border px-2 py-0.5"
                                    disabled={busy}
                                    onClick={() => onReject(p)}
                                  >
                                    Reject projection
                                  </button>
                                </>
                              )}
                            {!isStub && p.status === "approved" ? (
                              <button
                                type="button"
                                className="rounded border px-2 py-0.5"
                                disabled={busy}
                                onClick={() => onCorrect(p)}
                              >
                                Correct
                              </button>
                            ) : null}
                            {failed || isStub ? (
                              <button
                                type="button"
                                className="rounded border border-red-300 px-2 py-0.5 text-red-800"
                                disabled={busy}
                                data-testid={`psi-spp-retry-${p.mode}`}
                                onClick={() => onRetryFailed(p)}
                              >
                                {isStub ? "Regenerate with real asset" : "Retry failed generation"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="rounded border px-2 py-0.5"
                                disabled={busy || !approvedPlan}
                                data-testid={`psi-spp-replace-${p.mode}`}
                                onClick={() => onReplace(p)}
                              >
                                Replace / Regenerate
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {pendingMode && approvedPlan ? (
        <div
          className="rounded-md border border-[var(--ha-primary)]/50 bg-[var(--ha-background)] p-4"
          data-testid="psi-spp-plan-confirm"
        >
          <h3 className="text-sm font-semibold">Confirm plan source before generation</h3>
          <p className="mt-1 text-xs text-[var(--ha-muted-foreground)]">
            Projection generation defaults to the latest approved plan. Confirm plan v
            {approvedPlan.version} is the intended source.
          </p>
          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-[var(--ha-muted-foreground)]">Plan version</dt>
              <dd className="font-medium">v{approvedPlan.version}</dd>
            </div>
            <div>
              <dt className="text-[var(--ha-muted-foreground)]">Approval status</dt>
              <dd className="font-medium">{approvedPlan.status}</dd>
            </div>
            <div>
              <dt className="text-[var(--ha-muted-foreground)]">Total grafts (min / target / max)</dt>
              <dd className="font-medium">
                {totals?.totalMinimumGrafts.toLocaleString()} /{" "}
                {totals?.totalTargetGrafts.toLocaleString()} /{" "}
                {totals?.totalMaximumGrafts.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--ha-muted-foreground)]">Source-image views</dt>
              <dd className="font-medium">{sourceRoles.join(", ") || "—"}</dd>
            </div>
          </dl>
          <ul className="mt-2 max-h-24 space-y-0.5 overflow-auto text-xs text-[var(--ha-muted-foreground)]">
            {approvedPlan.zones.map((z) => (
              <li key={z.zone}>
                {z.zone}: {z.priority === "defer" ? "deferred" : `${z.targetGrafts} target`}
              </li>
            ))}
          </ul>
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmPlan}
              data-testid="psi-spp-confirm-plan-checkbox"
              onChange={(e) => setConfirmPlan(e.target.checked)}
            />
            <span>
              I confirm approved plan v{approvedPlan.version} is the intended source for this{" "}
              {PRE_SURGERY_PROJECTION_PATIENT_LABELS[pendingMode]} projection.
            </span>
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !confirmPlan}
              className="rounded-md bg-[var(--ha-primary)] px-3 py-1.5 text-xs font-medium text-[var(--ha-primary-foreground)] disabled:opacity-50"
              data-testid="psi-spp-confirm-generate"
              onClick={() => {
                onGenerate({
                  mode: pendingMode,
                  confirmCurrentApprovedPlan: true,
                  graftPlanId: approvedPlan.id,
                });
                setPendingMode(null);
                setConfirmPlan(false);
              }}
            >
              Generate from plan v{approvedPlan.version}
            </button>
            <button
              type="button"
              className="rounded-md border px-3 py-1.5 text-xs"
              onClick={() => {
                setPendingMode(null);
                setConfirmPlan(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {inspectProjection && inspectMedia ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          data-testid="psi-spp-inspect-modal"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[95vh] w-full max-w-6xl overflow-auto rounded-lg bg-[var(--ha-card)] p-4 shadow-xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">
                  Accuracy review — {ILLUSTRATIVE_SURGERY_PLAN_LABEL}
                </h3>
                <p className="text-xs text-[var(--ha-muted-foreground)]">
                  Source photograph · proposed hairline and graft-zone overlay · generated planning
                  illustration. {ILLUSTRATIVE_SURGERY_PLAN_SUPPORTING_TEXT} Rejecting the illustration
                  does not reject the graft plan.
                </p>
              </div>
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs"
                onClick={() => setInspectId(null)}
              >
                Close
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <figure className="space-y-1">
                <figcaption className="text-xs font-semibold">Source patient photograph</figcaption>
                {inspectMedia.sourceSignedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={inspectMedia.sourceSignedUrl}
                    alt=""
                    className="max-h-[60vh] w-full rounded border object-contain"
                  />
                ) : (
                  <div className="rounded border p-6 text-center text-xs text-[var(--ha-muted-foreground)]">
                    Source unavailable
                  </div>
                )}
              </figure>
              <figure className="space-y-1">
                <figcaption className="text-xs font-semibold">
                  {ILLUSTRATIVE_SURGERY_PLAN_LABEL} (hairline + zones)
                </figcaption>
                {inspectMedia.projectedSignedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={inspectMedia.projectedSignedUrl}
                    alt=""
                    className="max-h-[60vh] w-full rounded border object-contain opacity-95"
                  />
                ) : (
                  <div className="rounded border p-6 text-center text-xs text-[var(--ha-muted-foreground)]">
                    Overlay asset unavailable
                  </div>
                )}
                <p className="text-[10px] text-[var(--ha-muted-foreground)]">
                  Local illustrative composer embeds zone fills and hairline guidance on the source
                  view.
                </p>
              </figure>
              <figure className="space-y-1">
                <figcaption className="text-xs font-semibold">
                  Generated {ILLUSTRATIVE_SURGERY_PLAN_LABEL}
                </figcaption>
                {inspectMedia.projectedSignedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={inspectMedia.projectedSignedUrl}
                    alt=""
                    className="max-h-[60vh] w-full rounded border object-contain"
                  />
                ) : (
                  <div className="rounded border p-6 text-center text-xs text-[var(--ha-muted-foreground)]">
                    Projected result unavailable
                  </div>
                )}
              </figure>
            </div>
            <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-[var(--ha-muted-foreground)]">Source plan</dt>
                <dd>
                  v{inspectProjection.graftPlanVersion} · {inspectProjection.graftPlanId.slice(0, 8)}…
                </dd>
              </div>
              <div>
                <dt className="text-[var(--ha-muted-foreground)]">Provider / model</dt>
                <dd>
                  {inspectProjection.providerId} / {inspectProjection.providerModelVersion}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--ha-muted-foreground)]">Generated</dt>
                <dd>{formatWhen(inspectProjection.generatedAt)}</dd>
              </div>
              <div>
                <dt className="text-[var(--ha-muted-foreground)]">Clinician approval</dt>
                <dd>{clinicianProjectionLifecycleLabel(inspectProjection.status)}</dd>
              </div>
              <div>
                <dt className="text-[var(--ha-muted-foreground)]">Patient sharing</dt>
                <dd>{sharingLabel(inspectProjection)}</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              {(inspectProjection.status === "generated" ||
                inspectProjection.status === "clinician_review") && (
                <>
                  <button
                    type="button"
                    className="rounded border px-3 py-1.5 text-xs"
                    disabled={busy}
                    onClick={() => {
                      onOpenApprove(inspectProjection);
                      setInspectId(null);
                    }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="rounded border px-3 py-1.5 text-xs"
                    disabled={busy}
                    onClick={() => {
                      onReject(inspectProjection);
                      setInspectId(null);
                    }}
                  >
                    Reject projection (keep graft plan)
                  </button>
                </>
              )}
              <button
                type="button"
                className="rounded border px-3 py-1.5 text-xs"
                disabled={busy}
                onClick={() => {
                  onReplace(inspectProjection);
                  setInspectId(null);
                }}
              >
                Replace / Regenerate
              </button>
              {inspectProjection.status === "approved" ? (
                <button
                  type="button"
                  className="rounded border px-3 py-1.5 text-xs"
                  disabled={busy}
                  onClick={() => {
                    onCorrect(inspectProjection);
                    setInspectId(null);
                  }}
                >
                  Correct
                </button>
              ) : null}
            </div>
            {sourceViews.length === 0 ? null : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
