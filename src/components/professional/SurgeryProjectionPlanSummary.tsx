"use client";

/**
 * Surgery Projection Plan — current-first clinical workspace (UX regression fix).
 * One current generation · four inspection views · collapsed attempt history · shared drawer.
 */

import { useMemo, useState, type ReactNode } from "react";
import type {
  ClinicalImageReview,
  PreSurgeryGraftPlan,
  PreSurgeryIllustrativeProjection,
  PreSurgeryProjectionRejectionReason,
} from "@/lib/preSurgeryIntelligence/types";
import { PRE_SURGERY_PROJECTION_PATIENT_LABELS } from "@/lib/preSurgeryIntelligence/types";
import { computeGraftPlanTotals } from "@/lib/preSurgeryIntelligence/graftPlanTotals";
import {
  classifyProjectionStoragePath,
  clinicianProjectionLifecycleLabel,
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
} from "@/lib/preSurgeryIntelligence/projectionDisplayCopy";
import { isProjectionSourceRole } from "@/lib/preSurgeryIntelligence/imageRoles";
import {
  CLINICAL_REVIEW_REASON_CODES,
  CLINICAL_REVIEW_REASON_LABELS,
} from "@/lib/preSurgeryIntelligence/projection/approval";
import {
  selectCurrentProjectionAttempt,
  readGenerationLatencyMs,
  hairAuditDecisionLabel,
  technicalValidationVerdict,
} from "@/lib/preSurgeryIntelligence/projection/currentAttempt";
import { assertApprovedHairlineDesignForOutcome } from "@/lib/preSurgeryIntelligence/projection/hairlineApprovalGate";
import ProjectionAuditorCorrectionPanel from "@/components/professional/ProjectionAuditorCorrectionPanel";
import ProjectionInspectionCanvas, {
  type InspectionViewId,
} from "@/components/professional/ProjectionInspectionCanvas";

export type ProjectionMediaState = {
  projectionId: string;
  assetKind: ReturnType<typeof classifyProjectionStoragePath>["kind"];
  assetMessage: string;
  sourceSignedUrl: string | null;
  projectedSignedUrl: string | null;
  maskSignedUrl?: string | null;
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

type ReviewDrawerMode = "approve" | "reject" | "correct" | "regenerate" | null;

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
  onReject: (
    projection: PreSurgeryIllustrativeProjection,
    opts?: { reasonCode: PreSurgeryProjectionRejectionReason; reason: string }
  ) => void;
  onCorrect: (projection: PreSurgeryIllustrativeProjection) => void;
  onJumpToProjection: (projectionId: string) => void;
  projectedOutcomeAvailable?: boolean;
  projectedOutcomeUnavailableMessage?: string;
  onRequestCorrection?: (projection: PreSurgeryIllustrativeProjection) => void;
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

function sharingStateLabel(p: PreSurgeryIllustrativeProjection | null): string {
  if (!p) return "Unavailable";
  if (p.status === "approved" && p.patientSharingEnabled) return "Enabled for patient sharing";
  if (p.status === "approved") return "Clinician-only (sharing off)";
  return "Unavailable — not approved for sharing";
}

function attemptDecision(p: PreSurgeryIllustrativeProjection): string {
  if (p.status === "approved") return "Approved";
  if (p.status === "rejected") return "Rejected";
  if (p.status === "validation_failed" || p.status === "failed") return "Technically rejected";
  if (p.status === "superseded") return "Superseded";
  return "Pending";
}

function attemptReason(p: PreSurgeryIllustrativeProjection): string {
  return (
    p.rejectionReason ||
    p.failureMessage ||
    (p.rejectionReasonCode ? String(p.rejectionReasonCode).replaceAll("_", " ") : "") ||
    "—"
  );
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
  onJumpToProjection: _onJumpToProjection,
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
  const [inspectView, setInspectView] = useState<InspectionViewId>("outcome");
  const [historyInspectId, setHistoryInspectId] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<ReviewDrawerMode>(null);
  const [drawerProjectionId, setDrawerProjectionId] = useState<string | null>(null);
  const [reasonCodes, setReasonCodes] = useState<PreSurgeryProjectionRejectionReason[]>([]);
  const [reasonNote, setReasonNote] = useState("");

  const frontalReview =
    imageReviews.find((r) => r.assignedRole === "frontal" && r.reviewStatus === "confirmed") ??
    imageReviews.find((r) => r.assignedRole === "frontal") ??
    imageReviews.find((r) => isProjectionSourceRole(r.assignedRole)) ??
    null;

  const hairlineGate = useMemo(() => {
    if (!plan) return null;
    return assertApprovedHairlineDesignForOutcome({
      projections,
      plan,
      annotations: [],
      sourceImageId: frontalReview?.imageId,
      allowApprovedAnnotationFallback: false,
    });
  }, [plan, projections, frontalReview?.imageId]);

  const hairlineVersion =
    hairlineGate && hairlineGate.ok ? hairlineGate.hairlineVersion : null;

  const sourceImageId = frontalReview?.imageId ?? projections[0]?.sourceImageId ?? "";

  const { current, historical } = useMemo(() => {
    if (!plan || !sourceImageId) return { current: null, historical: [] as PreSurgeryIllustrativeProjection[] };
    return selectCurrentProjectionAttempt({
      projections,
      key: {
        graftPlanId: plan.id,
        graftPlanVersion: plan.version,
        sourceImageId,
        mode: activeMode,
        artifactType: activeTab,
        hairlineDesignVersion:
          activeTab === "illustrative_projected_outcome" ? hairlineVersion : null,
      },
    });
  }, [plan, sourceImageId, projections, activeMode, activeTab, hairlineVersion]);

  const peerAllocation = useMemo(() => {
    if (!plan || !sourceImageId) return null;
    return selectCurrentProjectionAttempt({
      projections,
      key: {
        graftPlanId: plan.id,
        graftPlanVersion: plan.version,
        sourceImageId,
        mode: activeMode,
        artifactType: "graft_allocation_map",
      },
    }).current;
  }, [plan, sourceImageId, projections, activeMode]);

  const peerHairline = useMemo(() => {
    if (!plan || !sourceImageId) return null;
    return selectCurrentProjectionAttempt({
      projections,
      key: {
        graftPlanId: plan.id,
        graftPlanVersion: plan.version,
        sourceImageId,
        mode: activeMode,
        artifactType: "proposed_hairline_design",
      },
    }).current;
  }, [plan, sourceImageId, projections, activeMode]);

  const peerOutcome = useMemo(() => {
    if (!plan || !sourceImageId) return null;
    return selectCurrentProjectionAttempt({
      projections,
      key: {
        graftPlanId: plan.id,
        graftPlanVersion: plan.version,
        sourceImageId,
        mode: activeMode,
        artifactType: "illustrative_projected_outcome",
        hairlineDesignVersion: hairlineVersion,
      },
    }).current;
  }, [plan, sourceImageId, projections, activeMode, hairlineVersion]);

  const historyInspect = historyInspectId
    ? projections.find((p) => p.id === historyInspectId) ?? null
    : null;

  const focusProjection = historyInspect ?? current;
  const focusIsHistorical = Boolean(historyInspect && historyInspect.id !== current?.id);

  const currentMedia = current ? mediaByProjectionId[current.id] : null;
  const focusMedia = focusProjection ? mediaByProjectionId[focusProjection.id] : null;
  const allocationMedia = peerAllocation ? mediaByProjectionId[peerAllocation.id] : null;
  const hairlineMedia = peerHairline ? mediaByProjectionId[peerHairline.id] : null;
  const outcomeMedia = peerOutcome ? mediaByProjectionId[peerOutcome.id] : null;

  const sourceUrl =
    focusMedia?.sourceSignedUrl ??
    currentMedia?.sourceSignedUrl ??
    allocationMedia?.sourceSignedUrl ??
    null;

  const drawerProjection = drawerProjectionId
    ? projections.find((p) => p.id === drawerProjectionId) ?? null
    : null;

  function beginGenerate(mode: PreSurgeryIllustrativeProjection["mode"]) {
    setPendingGenerate({ mode, artifactType: activeTab });
    setConfirmPlan(false);
  }

  function openDrawer(mode: ReviewDrawerMode, p: PreSurgeryIllustrativeProjection) {
    setDrawerMode(mode);
    setDrawerProjectionId(p.id);
    setReasonCodes([]);
    setReasonNote("");
    if (mode === "correct") {
      onRequestCorrection?.(p);
      onCorrect(p);
    }
  }

  function closeDrawer() {
    setDrawerMode(null);
    setDrawerProjectionId(null);
    setReasonCodes([]);
    setReasonNote("");
  }

  function toggleReason(code: PreSurgeryProjectionRejectionReason) {
    setReasonCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  function submitRejectOrCorrect() {
    if (!drawerProjection || !drawerMode) return;
    if (reasonCodes.length === 0) return;
    const primary = reasonCodes[0]!;
    const label = reasonCodes
      .map((c) => CLINICAL_REVIEW_REASON_LABELS[c as keyof typeof CLINICAL_REVIEW_REASON_LABELS] ?? c)
      .join("; ");
    const reason = reasonNote.trim() ? `${label}. ${reasonNote.trim()}` : label;
    if (drawerMode === "reject") {
      onReject(drawerProjection, { reasonCode: primary, reason });
      closeDrawer();
      return;
    }
    // Correction panel records structured codes itself when custom renderer unused.
    closeDrawer();
  }

  const defaultInspectView: InspectionViewId =
    activeTab === "graft_allocation_map"
      ? "allocation"
      : activeTab === "proposed_hairline_design"
        ? "hairline"
        : "outcome";

  const views = [
    {
      id: "original" as const,
      label: "Original",
      url: sourceUrl,
      emptyHint: "Original photograph unavailable",
    },
    {
      id: "hairline" as const,
      label: "Approved Hairline",
      url: hairlineMedia?.projectedSignedUrl ?? null,
      emptyHint: "Approved hairline design unavailable",
    },
    {
      id: "allocation" as const,
      label: "Allocation Map",
      url: allocationMedia?.projectedSignedUrl ?? null,
      emptyHint: "Allocation map unavailable",
    },
    {
      id: "outcome" as const,
      label: "Projected Outcome",
      url:
        activeTab === "illustrative_projected_outcome"
          ? focusMedia?.projectedSignedUrl ?? null
          : outcomeMedia?.projectedSignedUrl ?? null,
      emptyHint:
        activeTab === "illustrative_projected_outcome" && !projectedOutcomeAvailable
          ? projectedOutcomeUnavailableMessage
          : "Projected outcome unavailable",
    },
  ];

  return (
    <section
      id="psi-surgery-projection-plan"
      data-testid="psi-surgery-projection-plan"
      className="scroll-mt-4 space-y-3 rounded-lg border-2 border-[var(--ha-primary)]/40 bg-[var(--ha-card)] p-4 shadow-sm"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--ha-border)] pb-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ha-muted-foreground)]">
            Surgery Projection Plan
          </p>
          <h2 className="text-lg font-semibold text-[var(--ha-foreground)]">
            Current generation workspace
          </h2>
          <p className="mt-1 text-sm text-[var(--ha-muted-foreground)]">
            One current generation per plan · hairline · source · view · mode. Historical attempts stay
            collapsed below.
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
                setHistoryInspectId(null);
                setInspectView(
                  tab === "graft_allocation_map"
                    ? "allocation"
                    : tab === "proposed_hairline_design"
                      ? "hairline"
                      : "outcome"
                );
              }}
            >
              {TAB_SHORT_LABELS[tab]}
            </button>
          );
        })}
      </div>

      {/* Clinical decision summary — always visible */}
      <dl
        className="grid gap-2 rounded-md border border-[var(--ha-border)] bg-[var(--ha-background)] p-3 text-xs sm:grid-cols-2 lg:grid-cols-4"
        data-testid="psi-spp-decision-summary"
      >
        <div>
          <dt className="text-[var(--ha-muted-foreground)]">Plan version</dt>
          <dd className="font-medium">{plan ? `v${plan.version}` : "—"}</dd>
        </div>
        <div>
          <dt className="text-[var(--ha-muted-foreground)]">Hairline version</dt>
          <dd className="font-medium">{hairlineVersion != null ? `v${hairlineVersion}` : "—"}</dd>
        </div>
        <div>
          <dt className="text-[var(--ha-muted-foreground)]">Graft total</dt>
          <dd className="font-medium">{totals?.totalTargetGrafts.toLocaleString() ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[var(--ha-muted-foreground)]">Projection mode</dt>
          <dd className="font-medium">{PRE_SURGERY_PROJECTION_PATIENT_LABELS[activeMode]}</dd>
        </div>
        <div>
          <dt className="text-[var(--ha-muted-foreground)]">Provider / model</dt>
          <dd className="font-medium">
            {focusProjection
              ? `${focusProjection.providerId ?? "—"} / ${focusProjection.providerModelVersion ?? "—"}`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--ha-muted-foreground)]">Lifecycle</dt>
          <dd className="font-medium">
            {focusProjection
              ? clinicianProjectionLifecycleLabel(focusProjection.status)
              : "No current generation"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--ha-muted-foreground)]">Technical validation</dt>
          <dd className="font-medium" data-testid="psi-spp-validation-verdict">
            {focusProjection ? technicalValidationVerdict(focusProjection) : "n/a"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--ha-muted-foreground)]">FiOS decision</dt>
          <dd className="font-medium" data-testid="psi-spp-fios-decision">
            Not linked
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[var(--ha-muted-foreground)]">HairAudit decision</dt>
          <dd className="font-medium" data-testid="psi-spp-ha-decision">
            {focusProjection ? hairAuditDecisionLabel(focusProjection) : "—"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[var(--ha-muted-foreground)]">Patient sharing</dt>
          <dd className="font-medium" data-testid="psi-spp-sharing-state">
            {sharingStateLabel(focusProjection)}
          </dd>
        </div>
      </dl>

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
            Approve a graft plan before generating {ARTIFACT_TYPE_LABELS[activeTab].toLowerCase()}{" "}
            assets.
          </p>
        ) : (
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
                onClick={() => {
                  setActiveMode(mode);
                  setHistoryInspectId(null);
                }}
              >
                {PRE_SURGERY_PROJECTION_PATIENT_LABELS[mode]}
              </button>
            ))}
            <button
              type="button"
              disabled={busy}
              className="rounded-md bg-[var(--ha-primary)] px-3 py-1.5 text-xs font-medium text-[var(--ha-primary-foreground)] disabled:opacity-50"
              data-testid={`psi-spp-generate-${activeMode}`}
              onClick={() => beginGenerate(activeMode)}
            >
              Generate {PRE_SURGERY_PROJECTION_PATIENT_LABELS[activeMode]}
            </button>
          </div>
        )}

        {focusIsHistorical ? (
          <div
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950"
            data-testid="psi-spp-historical-badge"
          >
            <span>
              Historical attempt — not current. Immutable inspection only.
            </span>
            <button
              type="button"
              className="rounded border border-amber-400 px-2 py-0.5"
              onClick={() => setHistoryInspectId(null)}
            >
              Return to current
            </button>
          </div>
        ) : null}

        {approvedPlan && !current && !focusIsHistorical ? (
          <p className="text-sm text-[var(--ha-muted-foreground)]" data-testid="psi-spp-empty-no-projections">
            No current {ARTIFACT_TYPE_LABELS[activeTab].toLowerCase()} for this mode. Generate one or
            open Attempt History for prior rejected/failed attempts.
          </p>
        ) : null}

        {(current || focusIsHistorical) && (
          <div
            className="space-y-3 rounded-md border border-[var(--ha-border)] p-3"
            data-testid="psi-spp-current-workspace"
            data-projection-id={focusProjection?.id}
            data-artifact-type={focusProjection ? artifactOf(focusProjection) : undefined}
            data-current={!focusIsHistorical}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ha-muted-foreground)]">
                  {focusIsHistorical ? "Historical inspection" : "Current generation"}
                </p>
                <p className="text-sm font-medium">
                  {focusProjection?.patientSafeLabel ?? ARTIFACT_TYPE_LABELS[activeTab]}
                  {focusProjection ? ` · attempt #${focusProjection.projectionVersion ?? 1}` : ""}
                </p>
              </div>
              {!focusIsHistorical && focusProjection ? (
                <div className="flex flex-wrap gap-1">
                  {(focusProjection.status === "generated" ||
                    focusProjection.status === "clinician_review") && (
                    <>
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs"
                        disabled={busy}
                        data-testid={`psi-spp-approve-${activeMode}`}
                        onClick={() => {
                          openDrawer("approve", focusProjection);
                          onOpenApprove(focusProjection);
                        }}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs"
                        disabled={busy}
                        data-testid="psi-spp-open-reject"
                        onClick={() => openDrawer("reject", focusProjection)}
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {focusProjection.status === "approved" ? (
                    <button
                      type="button"
                      className="rounded border px-2 py-1 text-xs"
                      disabled={busy}
                      data-testid="psi-spp-open-correct"
                      onClick={() => openDrawer("correct", focusProjection)}
                    >
                      Request correction
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rounded border px-2 py-1 text-xs"
                    disabled={busy}
                    data-testid={`psi-spp-replace-${activeMode}`}
                    onClick={() => openDrawer("regenerate", focusProjection)}
                  >
                    Regenerate
                  </button>
                </div>
              ) : null}
            </div>

            <ProjectionInspectionCanvas
              views={views}
              activeView={
                views.some((v) => v.id === inspectView) || inspectView === "compare"
                  ? inspectView
                  : defaultInspectView
              }
              onViewChange={setInspectView}
              beforeUrl={sourceUrl}
              afterUrl={
                activeTab === "illustrative_projected_outcome"
                  ? focusMedia?.projectedSignedUrl
                  : outcomeMedia?.projectedSignedUrl
              }
              maskUrl={focusMedia?.maskSignedUrl ?? outcomeMedia?.maskSignedUrl ?? null}
            />
          </div>
        )}

        {/* Collapsed Attempt History */}
        <div className="rounded-md border border-[var(--ha-border)]" data-testid="psi-spp-attempt-history">
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium"
            data-testid="psi-spp-history-toggle"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen((v) => !v)}
          >
            <span>
              Attempt History ({historical.length})
              {!historyOpen ? " — collapsed" : ""}
            </span>
            <span className="text-[var(--ha-muted-foreground)]">
              {historyOpen ? "Hide" : "Show"}
            </span>
          </button>
          {historyOpen ? (
            historical.length === 0 ? (
              <p className="border-t border-[var(--ha-border)] px-3 py-2 text-xs text-[var(--ha-muted-foreground)]">
                No prior attempts for this plan · hairline · source · view · mode.
              </p>
            ) : (
              <ul className="divide-y border-t border-[var(--ha-border)] text-xs">
                {historical.map((p, idx) => {
                  const media = mediaByProjectionId[p.id];
                  const latency = readGenerationLatencyMs(p);
                  return (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center gap-3 px-3 py-2"
                      data-testid={`psi-spp-history-row-${p.id}`}
                      data-status={p.status}
                    >
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded border bg-[var(--ha-muted)]/40">
                        {media?.projectedSignedUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={media.projectedSignedUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="font-medium">
                          Attempt #{p.projectionVersion ?? historical.length - idx} ·{" "}
                          {formatWhen(p.generatedAt ?? p.requestedAt)}
                        </div>
                        <div className="text-[var(--ha-muted-foreground)]">
                          {clinicianProjectionLifecycleLabel(p.status)} · {attemptDecision(p)}
                        </div>
                        <div className="text-[var(--ha-muted-foreground)]">
                          Reason: {attemptReason(p)}
                        </div>
                        <div className="text-[10px] text-[var(--ha-muted-foreground)]">
                          Cost: Not metered · Latency:{" "}
                          {latency != null ? `${Math.round(latency)} ms` : "—"}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="rounded border px-2 py-1"
                        data-testid={`psi-spp-history-open-${p.id}`}
                        onClick={() => {
                          setHistoryInspectId(p.id);
                          setInspectView(
                            artifactOf(p) === "graft_allocation_map"
                              ? "allocation"
                              : artifactOf(p) === "proposed_hairline_design"
                                ? "hairline"
                                : "outcome"
                          );
                        }}
                      >
                        Inspect record
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : null}
        </div>
      </div>

      {pendingGenerate && approvedPlan ? (
        <div
          className="rounded-md border border-[var(--ha-primary)]/50 bg-[var(--ha-background)] p-4"
          data-testid="psi-spp-generate-confirm"
        >
          <p className="text-sm font-semibold">Confirm generation against current approved plan</p>
          <p className="mt-1 text-xs text-[var(--ha-muted-foreground)]">
            Plan v{approvedPlan.version} · {ARTIFACT_TYPE_LABELS[pendingGenerate.artifactType]} ·{" "}
            {PRE_SURGERY_PROJECTION_PATIENT_LABELS[pendingGenerate.mode]}
          </p>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmPlan}
              onChange={(e) => setConfirmPlan(e.target.checked)}
            />
            I confirm this uses the current approved graft plan
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!confirmPlan || busy}
              className="rounded-md bg-[var(--ha-primary)] px-3 py-1.5 text-xs font-medium text-[var(--ha-primary-foreground)] disabled:opacity-50"
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
              Generate
            </button>
            <button
              type="button"
              className="rounded border px-3 py-1.5 text-xs"
              onClick={() => setPendingGenerate(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {/* Shared review / correction drawer */}
      {drawerMode && drawerProjection ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          data-testid="psi-spp-review-drawer"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-lg bg-[var(--ha-card)] p-4 shadow-xl">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">
                  {drawerMode === "approve"
                    ? "Approve"
                    : drawerMode === "reject"
                      ? "Reject"
                      : drawerMode === "correct"
                        ? "Request correction"
                        : "Regenerate"}
                </h3>
                <p className="text-xs text-[var(--ha-muted-foreground)]">
                  {drawerProjection.patientSafeLabel} · {drawerProjection.id.slice(0, 8)}…
                </p>
              </div>
              <button type="button" className="rounded border px-2 py-1 text-xs" onClick={closeDrawer}>
                Close
              </button>
            </div>

            {drawerMode === "approve" ? (
              <p className="text-sm text-[var(--ha-muted-foreground)]">
                Complete the shared approval checklist that opened with this action. Patient sharing
                stays off unless explicitly enabled after approval.
              </p>
            ) : null}

            {drawerMode === "regenerate" ? (
              <div className="space-y-3 text-sm">
                <p>
                  Regenerate a new attempt for this mode. The current record will remain in Attempt
                  History and will not stay designated current once the replacement succeeds.
                </p>
                <button
                  type="button"
                  className="rounded-md bg-[var(--ha-primary)] px-3 py-1.5 text-xs font-medium text-[var(--ha-primary-foreground)]"
                  disabled={busy}
                  onClick={() => {
                    const failed =
                      drawerProjection.status === "failed" ||
                      drawerProjection.status === "validation_failed";
                    if (failed) onRetryFailed(drawerProjection);
                    else onReplace(drawerProjection);
                    closeDrawer();
                  }}
                >
                  Confirm regenerate
                </button>
              </div>
            ) : null}

            {(drawerMode === "reject" || drawerMode === "correct") && (
              <div className="space-y-3">
                <p className="text-xs text-[var(--ha-muted-foreground)]">
                  Select at least one structured clinical reason
                  {drawerMode === "reject" ? " before rejecting." : "."}
                </p>
                <div className="grid gap-1" data-testid="psi-spp-reason-codes">
                  {CLINICAL_REVIEW_REASON_CODES.map((code) => (
                    <label key={code} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={reasonCodes.includes(code)}
                        onChange={() => toggleReason(code)}
                      />
                      {CLINICAL_REVIEW_REASON_LABELS[code]}
                    </label>
                  ))}
                </div>
                <label className="block text-xs">
                  Notes
                  <textarea
                    className="mt-1 w-full rounded border px-2 py-1 text-sm"
                    rows={3}
                    value={reasonNote}
                    onChange={(e) => setReasonNote(e.target.value)}
                  />
                </label>
                {drawerMode === "reject" ? (
                  <button
                    type="button"
                    className="rounded-md border border-red-400 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-900 disabled:opacity-50"
                    disabled={busy || reasonCodes.length === 0}
                    data-testid="psi-spp-confirm-reject"
                    onClick={submitRejectOrCorrect}
                  >
                    Confirm reject
                  </button>
                ) : renderCorrectionDrawer ? (
                  renderCorrectionDrawer({
                    projection: drawerProjection,
                    onClose: closeDrawer,
                  })
                ) : (
                  <ProjectionAuditorCorrectionPanel
                    caseId={caseId}
                    projectionSnapshotId={drawerProjection.id}
                    projectionVersion={drawerProjection.projectionVersion ?? 1}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
