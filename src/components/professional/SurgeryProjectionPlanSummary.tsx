"use client";

/**
 * HA-PRE-SURGERY-PHOTOREALISTIC-OUTCOME-2A — Surgery Projection Plan summary.
 * Compact tabs: Graft Allocation Map | Proposed Hairline Design | Illustrative Projected Outcome.
 * Shared review / correction drawer (form only after "Request correction").
 */

import { useMemo, useState, type ReactNode } from "react";
import type {
  ClinicalImageReview,
  PreSurgeryGraftPlan,
  PreSurgeryIllustrativeProjection,
} from "@/lib/preSurgeryIntelligence/types";
import { PRE_SURGERY_PROJECTION_PATIENT_LABELS } from "@/lib/preSurgeryIntelligence/types";
import { computeGraftPlanTotals } from "@/lib/preSurgeryIntelligence/graftPlanTotals";
import {
  classifyProjectionStoragePath,
  clinicianProjectionLifecycleLabel,
  projectionMatchesCurrentPlan,
} from "@/lib/preSurgeryIntelligence/projectionAssetStatus";
import {
  ARTIFACT_TYPE_LABELS,
  ILLUSTRATIVE_PROJECTED_OUTCOME_DISCLAIMER,
  PROJECTED_OUTCOME_PROVIDER_UNAVAILABLE_MESSAGE,
  resolveProjectionArtifactType,
  type PreSurgeryArtifactType,
} from "@/lib/preSurgeryIntelligence/projection/artifactTypes";
import {
  ILLUSTRATIVE_SURGERY_PLAN_SUPPORTING_TEXT,
  PROPOSED_HAIRLINE_DESIGN_SUPPORTING_TEXT,
  labelForProjectionArtifact,
} from "@/lib/preSurgeryIntelligence/projectionDisplayCopy";
import { isProjectionSourceRole } from "@/lib/preSurgeryIntelligence/imageRoles";
import ProjectionAuditorCorrectionPanel from "@/components/professional/ProjectionAuditorCorrectionPanel";

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
  artifactType: PreSurgeryArtifactType;
  confirmCurrentApprovedPlan: true;
  allowSupersededPlan?: boolean;
  graftPlanId: string;
};

type ArtifactTab = PreSurgeryArtifactType;

const TAB_ORDER: ArtifactTab[] = [
  "graft_allocation_map",
  "proposed_hairline_design",
  "illustrative_projected_outcome",
];

const TAB_TESTIDS: Record<ArtifactTab, string> = {
  graft_allocation_map: "psi-spp-tab-allocation",
  proposed_hairline_design: "psi-spp-tab-hairline",
  illustrative_projected_outcome: "psi-spp-tab-outcome",
};

const TAB_SHORT_LABELS: Record<ArtifactTab, string> = {
  graft_allocation_map: "Allocation Map",
  proposed_hairline_design: "Hairline Design",
  illustrative_projected_outcome: "Projected Outcome",
};

const MODES: PreSurgeryIllustrativeProjection["mode"][] = [
  "conservative",
  "planned",
  "optimistic_within_approved_range",
];

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
  /** When false (default), Outcome tab shows provider-unavailable messaging. */
  projectedOutcomeAvailable?: boolean;
  projectedOutcomeUnavailableMessage?: string;
  onRequestCorrection?: (projection: PreSurgeryIllustrativeProjection) => void;
  /** Optional override for the shared correction drawer body. */
  renderCorrectionDrawer?: (args: {
    projection: PreSurgeryIllustrativeProjection;
    onClose: () => void;
  }) => ReactNode;
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

function artifactOf(p: PreSurgeryIllustrativeProjection): PreSurgeryArtifactType {
  return resolveProjectionArtifactType({
    artifactType: p.artifactType,
    providerId: p.providerId,
  });
}

function supportingTextForTab(tab: ArtifactTab): string {
  if (tab === "illustrative_projected_outcome") return ILLUSTRATIVE_PROJECTED_OUTCOME_DISCLAIMER;
  if (tab === "proposed_hairline_design") return PROPOSED_HAIRLINE_DESIGN_SUPPORTING_TEXT;
  return ILLUSTRATIVE_SURGERY_PLAN_SUPPORTING_TEXT;
}

function sortNewestFirst(a: PreSurgeryIllustrativeProjection, b: PreSurgeryIllustrativeProjection): number {
  const aKey = a.generatedAt ?? a.requestedAt ?? "";
  const bKey = b.generatedAt ?? b.requestedAt ?? "";
  return bKey.localeCompare(aKey);
}

export default function SurgeryProjectionPlanSummary({
  caseId,
  approvedPlan,
  currentPlan,
  projections,
  mediaByProjectionId,
  imageReviews,
  sourceViews: _sourceViews,
  busy,
  onScrollToPlan,
  onGenerate,
  onRetryFailed,
  onReplace,
  onOpenApprove,
  onReject,
  onCorrect,
  onJumpToProjection,
  projectedOutcomeAvailable = false,
  projectedOutcomeUnavailableMessage = PROJECTED_OUTCOME_PROVIDER_UNAVAILABLE_MESSAGE,
  onRequestCorrection,
  renderCorrectionDrawer,
}: Props) {
  const plan = approvedPlan ?? currentPlan;
  const totals = plan ? computeGraftPlanTotals(plan.zones) : null;

  const [activeTab, setActiveTab] = useState<ArtifactTab>("graft_allocation_map");
  const [activeMode, setActiveMode] =
    useState<PreSurgeryIllustrativeProjection["mode"]>("planned");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingGenerate, setPendingGenerate] = useState<{
    mode: PreSurgeryIllustrativeProjection["mode"];
    artifactType: PreSurgeryArtifactType;
  } | null>(null);
  const [confirmPlan, setConfirmPlan] = useState(false);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [correctionRequestedId, setCorrectionRequestedId] = useState<string | null>(null);

  const sourceRoles = imageReviews
    .filter((r) => isProjectionSourceRole(r.assignedRole))
    .map((r) => `${r.assignedRole} (${r.reviewStatus})`);

  const tabProjections = useMemo(
    () =>
      projections
        .filter((p) => artifactOf(p) === activeTab)
        .slice()
        .sort(sortNewestFirst),
    [projections, activeTab]
  );

  const modeProjections = useMemo(
    () => tabProjections.filter((p) => p.mode === activeMode),
    [tabProjections, activeMode]
  );

  /** Newest for active mode is the current card; older are historical. */
  const currentForMode = modeProjections[0] ?? null;
  const historicalForMode = modeProjections.slice(1);
  const historicalAllTab = useMemo(() => {
    const latestByMode = new Map<string, string>();
    for (const mode of MODES) {
      const first = tabProjections.find((p) => p.mode === mode);
      if (first) latestByMode.set(mode, first.id);
    }
    return tabProjections.filter((p) => latestByMode.get(p.mode) !== p.id);
  }, [tabProjections]);

  const galleryItems = historyOpen
    ? modeProjections
    : currentForMode
      ? [currentForMode]
      : [];

  const inspectProjection = useMemo(
    () => (inspectId ? projections.find((p) => p.id === inspectId) ?? null : null),
    [inspectId, projections]
  );
  const inspectMedia = inspectProjection ? mediaByProjectionId[inspectProjection.id] : null;

  const inspectPeerHairline = useMemo(() => {
    if (!inspectProjection) return null;
    return (
      projections
        .filter(
          (p) =>
            p.mode === inspectProjection.mode &&
            artifactOf(p) === "proposed_hairline_design"
        )
        .sort(sortNewestFirst)[0] ?? null
    );
  }, [inspectProjection, projections]);

  const inspectPeerAllocation = useMemo(() => {
    if (!inspectProjection) return null;
    return (
      projections
        .filter(
          (p) =>
            p.mode === inspectProjection.mode && artifactOf(p) === "graft_allocation_map"
        )
        .sort(sortNewestFirst)[0] ?? null
    );
  }, [inspectProjection, projections]);

  const inspectPeerOutcome = useMemo(() => {
    if (!inspectProjection) return null;
    return (
      projections
        .filter(
          (p) =>
            p.mode === inspectProjection.mode &&
            artifactOf(p) === "illustrative_projected_outcome"
        )
        .sort(sortNewestFirst)[0] ?? null
    );
  }, [inspectProjection, projections]);

  const correctionProjection = useMemo(
    () =>
      correctionRequestedId
        ? projections.find((p) => p.id === correctionRequestedId) ?? null
        : null,
    [correctionRequestedId, projections]
  );

  function openCorrection(p: PreSurgeryIllustrativeProjection) {
    setCorrectionRequestedId(p.id);
    onRequestCorrection?.(p);
    onCorrect(p);
  }

  function beginGenerate(mode: PreSurgeryIllustrativeProjection["mode"]) {
    setPendingGenerate({ mode, artifactType: activeTab });
    setConfirmPlan(false);
  }

  const hairlinePaneProjection =
    inspectProjection && artifactOf(inspectProjection) === "proposed_hairline_design"
      ? inspectProjection
      : inspectPeerHairline;
  const allocationPaneProjection =
    inspectProjection && artifactOf(inspectProjection) === "graft_allocation_map"
      ? inspectProjection
      : inspectPeerAllocation;
  const mapPaneProjection = allocationPaneProjection ?? hairlinePaneProjection;
  const outcomePaneProjection =
    inspectProjection && artifactOf(inspectProjection) === "illustrative_projected_outcome"
      ? inspectProjection
      : inspectPeerOutcome;
  const hairlineMedia = hairlinePaneProjection
    ? mediaByProjectionId[hairlinePaneProjection.id]
    : null;
  const allocationMedia = allocationPaneProjection
    ? mediaByProjectionId[allocationPaneProjection.id]
    : null;
  const mapMedia = mapPaneProjection ? mediaByProjectionId[mapPaneProjection.id] : null;
  const outcomeMedia = outcomePaneProjection
    ? mediaByProjectionId[outcomePaneProjection.id]
    : null;

  return (
    <section
      id="psi-surgery-projection-plan"
      data-testid="psi-surgery-projection-plan"
      className="scroll-mt-4 space-y-3 rounded-lg border-2 border-[var(--ha-primary)]/40 bg-[var(--ha-card)] p-4 shadow-sm"
    >
      {/* Current-plan summary strip */}
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--ha-border)] pb-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ha-muted-foreground)]">
            Surgery Projection Plan
          </p>
          <h2 className="text-lg font-semibold text-[var(--ha-foreground)]">
            Current plan · planning overlays · illustrative outcomes
          </h2>
          {plan ? (
            <p className="mt-1 text-sm text-[var(--ha-muted-foreground)]">
              Plan v{plan.version} · {plan.status} · target{" "}
              {totals?.totalTargetGrafts.toLocaleString() ?? "—"} grafts
              {sourceRoles.length > 0 ? ` · sources: ${sourceRoles.join(", ")}` : ""}
            </p>
          ) : (
            <p className="mt-1 text-sm text-amber-800">
              No graft plan yet. Initialise or save a plan below.
            </p>
          )}
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

      {/* Artifact tabs */}
      <div
        className="flex flex-wrap gap-1 border-b border-[var(--ha-border)]"
        role="tablist"
        data-testid="psi-spp-tabs"
      >
        {TAB_ORDER.map((tab) => {
          const selected = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={selected}
              data-testid={TAB_TESTIDS[tab]}
              className={`rounded-t-md px-3 py-2 text-xs font-medium ${
                selected
                  ? "border border-b-0 border-[var(--ha-border)] bg-[var(--ha-background)] text-[var(--ha-foreground)]"
                  : "text-[var(--ha-muted-foreground)] hover:text-[var(--ha-foreground)]"
              }`}
              onClick={() => {
                setActiveTab(tab);
                setHistoryOpen(false);
              }}
            >
              {TAB_SHORT_LABELS[tab]}
            </button>
          );
        })}
      </div>

      <div className="space-y-3" role="tabpanel">
        <div>
          <h3 className="text-sm font-semibold text-[var(--ha-foreground)]">
            {ARTIFACT_TYPE_LABELS[activeTab]}
          </h3>
          <p className="mt-0.5 text-xs text-[var(--ha-muted-foreground)]">
            {supportingTextForTab(activeTab)}
          </p>
        </div>

        {activeTab === "illustrative_projected_outcome" && !projectedOutcomeAvailable ? (
          <p
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950"
            data-testid="psi-spp-outcome-unavailable"
          >
            {projectedOutcomeUnavailableMessage}
          </p>
        ) : null}

        {!approvedPlan ? (
          <p className="text-sm text-amber-800" data-testid="psi-spp-empty-needs-plan">
            Approve a graft plan before generating{" "}
            {ARTIFACT_TYPE_LABELS[activeTab].toLowerCase()} assets.
          </p>
        ) : (
          <>
            {/* Mode chips + generate */}
            <div className="flex flex-wrap items-center gap-2">
              {MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`rounded-md border px-2.5 py-1 text-xs ${
                    activeMode === mode
                      ? "border-[var(--ha-primary)] bg-[var(--ha-primary)]/10 font-semibold"
                      : "border-[var(--ha-border)]"
                  }`}
                  onClick={() => setActiveMode(mode)}
                >
                  {PRE_SURGERY_PROJECTION_PATIENT_LABELS[mode]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {MODES.map((mode) => (
                <button
                  key={`gen-${mode}`}
                  type="button"
                  disabled={busy}
                  className="rounded-md bg-[var(--ha-primary)] px-3 py-1.5 text-xs font-medium text-[var(--ha-primary-foreground)] disabled:opacity-50"
                  data-testid={`psi-spp-generate-${mode}`}
                  onClick={() => beginGenerate(mode)}
                >
                  Generate {PRE_SURGERY_PROJECTION_PATIENT_LABELS[mode]}
                </button>
              ))}
            </div>
          </>
        )}

        {approvedPlan && galleryItems.length === 0 && modeProjections.length === 0 ? (
          <p className="text-sm text-[var(--ha-muted-foreground)]" data-testid="psi-spp-empty-no-projections">
            No {ARTIFACT_TYPE_LABELS[activeTab].toLowerCase()} records for this mode yet.
          </p>
        ) : null}

        {galleryItems.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {galleryItems.map((p) => {
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
              const labels = labelForProjectionArtifact({
                artifactType: p.artifactType,
                providerId: p.providerId,
              });
              return (
                <article
                  key={p.id}
                  className="overflow-hidden rounded-md border border-[var(--ha-border)] bg-[var(--ha-background)]"
                  data-testid={`psi-spp-thumb-${p.mode}`}
                  data-projection-id={p.id}
                  data-artifact-type={artifactOf(p)}
                >
                  <div className="relative flex h-36 items-center justify-center bg-[var(--ha-muted)]/40">
                    {showImg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={media!.projectedSignedUrl!}
                        alt={`${labels.label} thumbnail`}
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
                      {labels.label}
                      {" · "}
                      {p.patientSafeLabel}
                    </div>
                    <div className="text-[var(--ha-muted-foreground)]">
                      {isStub || !match.matches
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
                    {!match.matches ? <p className="text-amber-800">{match.reason}</p> : null}
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
                      {showImg || media?.sourceSignedUrl ? (
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
                              Reject
                            </button>
                          </>
                        )}
                      {!isStub && p.status === "approved" ? (
                        <button
                          type="button"
                          className="rounded border px-2 py-0.5"
                          disabled={busy}
                          onClick={() => openCorrection(p)}
                        >
                          Request correction
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
        ) : null}

        <button
          type="button"
          className="text-xs font-medium text-[var(--ha-muted-foreground)] underline-offset-2 hover:underline"
          data-testid="psi-spp-history-toggle"
          aria-expanded={historyOpen}
          onClick={() => setHistoryOpen((v) => !v)}
        >
          {historyOpen
            ? "Hide historical versions"
            : `Show historical versions (${historicalForMode.length || historicalAllTab.length})`}
        </button>

        {historyOpen && historicalAllTab.length > 0 && activeMode ? (
          <ul className="space-y-1 rounded-md border border-[var(--ha-border)] p-2 text-xs text-[var(--ha-muted-foreground)]">
            {historicalAllTab.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {PRE_SURGERY_PROJECTION_PATIENT_LABELS[p.mode]} · {p.status} · plan v
                  {p.graftPlanVersion} · {p.id.slice(0, 8)}…
                </span>
                <button
                  type="button"
                  className="rounded border px-2 py-0.5"
                  onClick={() => onJumpToProjection(p.id)}
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Plan confirmation before generate */}
      {pendingGenerate && approvedPlan ? (
        <div
          className="rounded-md border border-[var(--ha-primary)]/50 bg-[var(--ha-background)] p-4"
          data-testid="psi-spp-plan-confirm"
        >
          <h3 className="text-sm font-semibold">Confirm plan source before generation</h3>
          <p className="mt-1 text-xs text-[var(--ha-muted-foreground)]">
            Generating {ARTIFACT_TYPE_LABELS[pendingGenerate.artifactType]} (
            {PRE_SURGERY_PROJECTION_PATIENT_LABELS[pendingGenerate.mode]}). Confirm plan v
            {approvedPlan.version} is the intended source.
          </p>
          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-[var(--ha-muted-foreground)]">Artifact</dt>
              <dd className="font-medium">{ARTIFACT_TYPE_LABELS[pendingGenerate.artifactType]}</dd>
            </div>
            <div>
              <dt className="text-[var(--ha-muted-foreground)]">Plan version</dt>
              <dd className="font-medium">v{approvedPlan.version}</dd>
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
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmPlan}
              data-testid="psi-spp-confirm-plan-checkbox"
              onChange={(e) => setConfirmPlan(e.target.checked)}
            />
            <span>
              I confirm approved plan v{approvedPlan.version} is the intended source for this{" "}
              {ARTIFACT_TYPE_LABELS[pendingGenerate.artifactType]}.
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
                  mode: pendingGenerate.mode,
                  artifactType: pendingGenerate.artifactType,
                  confirmCurrentApprovedPlan: true,
                  graftPlanId: approvedPlan.id,
                });
                setPendingGenerate(null);
                setConfirmPlan(false);
              }}
            >
              Generate from plan v{approvedPlan.version}
            </button>
            <button
              type="button"
              className="rounded-md border px-3 py-1.5 text-xs"
              onClick={() => {
                setPendingGenerate(null);
                setConfirmPlan(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {/* Side-by-side inspect: Original | Hairline | Allocation | Outcome */}
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
                <h3 className="text-base font-semibold">Accuracy review</h3>
                <p className="text-xs text-[var(--ha-muted-foreground)]">
                  Original · {ARTIFACT_TYPE_LABELS.proposed_hairline_design} ·{" "}
                  {ARTIFACT_TYPE_LABELS.graft_allocation_map} ·{" "}
                  {ARTIFACT_TYPE_LABELS.illustrative_projected_outcome} (when available). Rejecting
                  an illustration does not reject the graft plan.
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <figure className="space-y-1">
                <figcaption className="text-xs font-semibold">Original</figcaption>
                {inspectMedia.sourceSignedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={inspectMedia.sourceSignedUrl}
                    alt=""
                    className="max-h-[55vh] w-full rounded border object-contain"
                  />
                ) : (
                  <div className="rounded border p-6 text-center text-xs text-[var(--ha-muted-foreground)]">
                    Source unavailable
                  </div>
                )}
              </figure>
              <figure className="space-y-1">
                <figcaption className="text-xs font-semibold">
                  {ARTIFACT_TYPE_LABELS.proposed_hairline_design}
                </figcaption>
                {hairlineMedia?.projectedSignedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={hairlineMedia.projectedSignedUrl}
                    alt=""
                    className="max-h-[55vh] w-full rounded border object-contain"
                  />
                ) : (
                  <div className="rounded border p-6 text-center text-xs text-[var(--ha-muted-foreground)]">
                    Approved hairline design unavailable
                  </div>
                )}
              </figure>
              <figure className="space-y-1">
                <figcaption className="text-xs font-semibold">
                  {ARTIFACT_TYPE_LABELS.graft_allocation_map}
                </figcaption>
                {allocationMedia?.projectedSignedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={allocationMedia.projectedSignedUrl}
                    alt=""
                    className="max-h-[55vh] w-full rounded border object-contain"
                  />
                ) : mapMedia?.projectedSignedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mapMedia.projectedSignedUrl}
                    alt=""
                    className="max-h-[55vh] w-full rounded border object-contain"
                  />
                ) : (
                  <div className="rounded border p-6 text-center text-xs text-[var(--ha-muted-foreground)]">
                    Allocation map unavailable
                  </div>
                )}
              </figure>
              <figure className="space-y-1">
                <figcaption className="text-xs font-semibold">
                  {ARTIFACT_TYPE_LABELS.illustrative_projected_outcome}
                </figcaption>
                {outcomeMedia?.projectedSignedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={outcomeMedia.projectedSignedUrl}
                    alt=""
                    className="max-h-[55vh] w-full rounded border object-contain"
                  />
                ) : (
                  <div className="rounded border p-6 text-center text-xs text-[var(--ha-muted-foreground)]">
                    {projectedOutcomeAvailable
                      ? "Projected outcome unavailable for this mode"
                      : projectedOutcomeUnavailableMessage}
                  </div>
                )}
                {outcomeMedia?.projectedSignedUrl ? (
                  <p className="text-[10px] text-[var(--ha-muted-foreground)]">
                    {ILLUSTRATIVE_PROJECTED_OUTCOME_DISCLAIMER}
                  </p>
                ) : null}
              </figure>
            </div>
            <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-[var(--ha-muted-foreground)]">Source plan</dt>
                <dd>
                  v{inspectProjection.graftPlanVersion} · {inspectProjection.graftPlanId.slice(0, 8)}
                  …
                </dd>
              </div>
              <div>
                <dt className="text-[var(--ha-muted-foreground)]">Provider / model</dt>
                <dd>
                  {inspectProjection.providerId} / {inspectProjection.providerModelVersion}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--ha-muted-foreground)]">Lifecycle</dt>
                <dd>{clinicianProjectionLifecycleLabel(inspectProjection.status)}</dd>
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
                    Reject (keep graft plan)
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
                    openCorrection(inspectProjection);
                    setInspectId(null);
                  }}
                >
                  Request correction
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Shared correction drawer — panel only when correction requested */}
      {correctionRequestedId && correctionProjection ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40"
          data-testid="psi-spp-correction-drawer"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-full w-full max-w-md flex-col bg-[var(--ha-card)] shadow-xl">
            <div className="flex items-start justify-between gap-2 border-b border-[var(--ha-border)] p-3">
              <div>
                <h3 className="text-sm font-semibold">Request correction</h3>
                <p className="text-xs text-[var(--ha-muted-foreground)]">
                  {labelForProjectionArtifact({
                    artifactType: correctionProjection.artifactType,
                    providerId: correctionProjection.providerId,
                  }).label}{" "}
                  · {correctionProjection.patientSafeLabel}
                </p>
              </div>
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs"
                onClick={() => setCorrectionRequestedId(null)}
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-auto p-3">
              {renderCorrectionDrawer ? (
                renderCorrectionDrawer({
                  projection: correctionProjection,
                  onClose: () => setCorrectionRequestedId(null),
                })
              ) : (
                <ProjectionAuditorCorrectionPanel
                  caseId={caseId}
                  projectionSnapshotId={correctionProjection.id}
                  projectionVersion={correctionProjection.projectionVersion ?? 1}
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
