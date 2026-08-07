/**
 * HA-PRE-SURGERY-INTELLIGENCE-2B — Patient-safe report projection from clinician workspace.
 *
 * Flows ONLY approved observations + approved graft-plan fields into Pre-Surgery Review.
 * Excludes: draft clinician notes, deleted annotations, correction history, unsafe projection internals.
 */

import { sanitizePatientReportText } from "@/lib/reports/postSurgeryPatientText";
import { OBSERVATION_DOMAIN_LABELS } from "./observations";
import { findUnsafeProjectionLabel } from "./projection/safety";
import type {
  ClinicalObservation,
  PreSurgeryGraftPlan,
  PreSurgeryIllustrativeProjection,
} from "./types";
import type { IllustrativeProjectedResultSection } from "./reportProjectionInclusion";
import { resolveIllustrativeProjectedResultForReport } from "./reportProjectionInclusion";
import type { PreSurgeryPlanningOutcomeId } from "@/lib/reports/preSurgeryPlanningReport";
import type { ClinicalImageReview } from "./types";

/** Domains safe to surface in patient report when clinician-confirmed/corrected. */
export const PATIENT_SAFE_OBSERVATION_DOMAINS = [
  "pattern_classification",
  "frontal_recession",
  "temple_recession",
  "mid_scalp_density",
  "crown_involvement",
  "donor_density_appearance",
  "likely_treatment_zones",
  "image_limitation",
  "suitability_uncertainty",
] as const;

export type PatientSafeObservationForReport = {
  domain: string;
  label: string;
  value: string;
  status: "confirmed" | "corrected";
};

export type PatientSafeGraftPlanForReport = {
  graftPlanId: string;
  graftPlanVersion: number;
  graftPlanChecksum: string;
  totalMinimumGrafts: number;
  totalTargetGrafts: number;
  totalMaximumGrafts: number;
  donorAvailabilityBand: PreSurgeryGraftPlan["donorAvailabilityBand"];
  deferredZones: string[];
  proposedSessionCount: 1 | 2 | 3;
  zoneSummaries: Array<{
    zone: string;
    priority: string;
    minimumGrafts: number;
    targetGrafts: number;
    maximumGrafts: number;
  }>;
  /** Patient-safe planning assumptions only (no internal draft notes). */
  planningAssumptions: string[];
};

export type PreSurgeryClinicianReportProvenance = {
  approvedGraftPlanId: string;
  approvedGraftPlanVersion: number;
  approvedGraftPlanChecksum: string;
  approvedObservationCount: number;
  /** Patient-visible illustrative projections only (clinician-approved). */
  approvedProjectionIds: string[];
  /**
   * 2C — Exact pinned projection id + version used by this report.
   * Reissue must not silently substitute a newer projection.
   */
  pinnedProjectionId: string | null;
  pinnedProjectionVersion: number | null;
  pinnedProjectionInputChecksum: string | null;
  frozenAt: string;
};

export type BuildClinicianReportSliceResult = {
  observations: PatientSafeObservationForReport[];
  graftPlan: PatientSafeGraftPlanForReport | null;
  provenance: PreSurgeryClinicianReportProvenance | null;
  /** Illustrative projection labels only — never storage paths or validation internals. */
  patientSafeProjectionLabels: string[];
  /**
   * HA-PRE-SURGERY-PROJECTION-REPORT-1A — Frozen illustrative projected-result section.
   * Auditor corrections are never included.
   */
  illustrativeProjectedResult: IllustrativeProjectedResultSection | null;
};

function isApprovedObservationStatus(
  status: ClinicalObservation["status"]
): status is "confirmed" | "corrected" {
  return status === "confirmed" || status === "corrected";
}

export function selectPatientSafeObservations(
  observations: ClinicalObservation[]
): PatientSafeObservationForReport[] {
  const allowed = new Set<string>(PATIENT_SAFE_OBSERVATION_DOMAINS);
  const out: PatientSafeObservationForReport[] = [];
  for (const obs of observations) {
    if (!allowed.has(obs.domain)) continue;
    if (!isApprovedObservationStatus(obs.status)) continue;
    const raw = obs.clinicianApprovedValue ?? obs.aiProposedValue;
    if (raw == null) continue;
    const value = sanitizePatientReportText(String(raw));
    if (!value) continue;
    // Never leak draft clinician notes into patient report.
    out.push({
      domain: obs.domain,
      label: OBSERVATION_DOMAIN_LABELS[obs.domain] ?? obs.domain,
      value,
      status: obs.status,
    });
  }
  return out;
}

export function selectApprovedGraftPlanForReport(
  plans: PreSurgeryGraftPlan[]
): PatientSafeGraftPlanForReport | null {
  const approved = [...plans]
    .filter((p) => p.status === "approved")
    .sort((a, b) => b.version - a.version)[0];
  if (!approved) return null;

  return {
    graftPlanId: approved.id,
    graftPlanVersion: approved.version,
    graftPlanChecksum: approved.checksum,
    totalMinimumGrafts: approved.totalMinimumGrafts,
    totalTargetGrafts: approved.totalTargetGrafts,
    totalMaximumGrafts: approved.totalMaximumGrafts,
    donorAvailabilityBand: approved.donorAvailabilityBand,
    deferredZones: [...approved.deferredZones],
    proposedSessionCount: approved.proposedSessionCount,
    zoneSummaries: approved.zones.map((z) => ({
      zone: z.zone,
      priority: z.priority,
      minimumGrafts: z.minimumGrafts,
      targetGrafts: z.targetGrafts,
      maximumGrafts: z.maximumGrafts,
    })),
    planningAssumptions: approved.planningAssumptions
      .map((a) => sanitizePatientReportText(a))
      .filter(Boolean)
      .filter((a) => !findUnsafeProjectionLabel(a)),
  };
}

/**
 * Patients see projections only after explicit clinician approval of the projection record.
 * Draft/generated/rejected projections and internal validation details are excluded.
 * Only projections tied to the approved graft-plan version (and not stale) are eligible.
 */
export function selectPatientSafeProjectionLabels(
  projections: PreSurgeryIllustrativeProjection[],
  graftPlan?: PatientSafeGraftPlanForReport | null
): string[] {
  const labels: string[] = [];
  for (const p of selectReportEligibleProjections(projections, graftPlan)) {
    labels.push(p.patientSafeLabel);
  }
  return labels;
}

export function selectReportEligibleProjections(
  projections: PreSurgeryIllustrativeProjection[],
  graftPlan?: PatientSafeGraftPlanForReport | null,
  /** When set (report reissue), pin to this exact projection — never substitute newer. */
  pinnedProjectionId?: string | null
): PreSurgeryIllustrativeProjection[] {
  const eligible = projections.filter((p) => {
    if (p.status !== "approved") return false;
    if (p.patientSharingEnabled === false) return false;
    if (p.staleAt) return false;
    if (p.shadowMode) return false;
    if (findUnsafeProjectionLabel(p.patientSafeLabel)) return false;
    // REAL-ASSET-1A — stubs / missing assets never enter the patient report.
    const path = typeof p.storagePath === "string" ? p.storagePath.trim() : "";
    if (!path || /\.stub$/i.test(path) || path.includes("/stub/")) return false;
    if (!p.outputChecksum) return false;
    if (graftPlan) {
      if (p.graftPlanId !== graftPlan.graftPlanId) return false;
      if (p.graftPlanVersion !== graftPlan.graftPlanVersion) return false;
    }
    return true;
  });
  if (pinnedProjectionId) {
    // Reissue: keep historically pinned projection readable even if later marked stale
    // for *new* inclusion — only when explicitly re-pinning the same id.
    const pinned = projections.filter((p) => {
      if (p.id !== pinnedProjectionId || p.status !== "approved") return false;
      const path = typeof p.storagePath === "string" ? p.storagePath.trim() : "";
      if (!path || /\.stub$/i.test(path) || path.includes("/stub/")) return false;
      return true;
    });
    return pinned.length > 0 ? pinned : eligible.filter((p) => p.id === pinnedProjectionId);
  }
  return eligible;
}

export function buildClinicianReportSlice(input: {
  observations: ClinicalObservation[];
  graftPlans: PreSurgeryGraftPlan[];
  projections: PreSurgeryIllustrativeProjection[];
  now?: string;
  /** Preserve exact projection from a prior report issuance. */
  pinnedProjectionId?: string | null;
  /** Required to resolve illustrative projected-result section (1A). */
  caseId?: string;
  pathway?: "pre_surgery" | string;
  planningOutcomeId?: PreSurgeryPlanningOutcomeId;
  stabilisationPriorityBand?: string | null;
  restorationSuitabilityBand?: string | null;
  graftEstimateRange?: { min: number; max: number } | null;
  imageReviews?: ClinicalImageReview[];
  sourceStoragePathByImageId?: Record<string, string | null>;
  inclusionActivationAllowed?: boolean;
}): BuildClinicianReportSliceResult {
  const observations = selectPatientSafeObservations(input.observations);
  const graftPlan = selectApprovedGraftPlanForReport(input.graftPlans);
  const eligible = selectReportEligibleProjections(
    input.projections,
    graftPlan,
    input.pinnedProjectionId
  );
  const patientSafeProjectionLabels = eligible.map((p) => p.patientSafeLabel);
  const approvedProjectionIds = eligible.map((p) => p.id);
  const pinned = eligible[0] ?? null;

  const provenance: PreSurgeryClinicianReportProvenance | null = graftPlan
    ? {
        approvedGraftPlanId: graftPlan.graftPlanId,
        approvedGraftPlanVersion: graftPlan.graftPlanVersion,
        approvedGraftPlanChecksum: graftPlan.graftPlanChecksum,
        approvedObservationCount: observations.length,
        approvedProjectionIds,
        pinnedProjectionId: pinned?.id ?? null,
        pinnedProjectionVersion: pinned?.projectionVersion ?? null,
        pinnedProjectionInputChecksum: pinned?.inputChecksum ?? null,
        frozenAt: input.now ?? new Date().toISOString(),
      }
    : null;

  const illustrativeProjectedResult =
    input.caseId && input.planningOutcomeId
      ? resolveIllustrativeProjectedResultForReport({
          caseId: input.caseId,
          pathway: input.pathway ?? "pre_surgery",
          projections: input.projections,
          graftPlans: input.graftPlans,
          imageReviews: input.imageReviews,
          pinnedProjectionId: input.pinnedProjectionId,
          planningOutcomeId: input.planningOutcomeId,
          stabilisationPriorityBand: input.stabilisationPriorityBand,
          restorationSuitabilityBand: input.restorationSuitabilityBand,
          graftEstimateRange:
            input.graftEstimateRange ??
            (graftPlan
              ? { min: graftPlan.totalMinimumGrafts, max: graftPlan.totalMaximumGrafts }
              : null),
          sourceStoragePathByImageId: input.sourceStoragePathByImageId,
          now: input.now,
          inclusionActivationAllowed: input.inclusionActivationAllowed,
        })
      : null;

  // Prefer pinning provenance to the report-selected projection (recommended mode).
  const selectedId = illustrativeProjectedResult?.projectionSnapshotId ?? pinned?.id ?? null;
  const selected = selectedId
    ? eligible.find((p) => p.id === selectedId) ?? pinned
    : pinned;
  const provenancePinned: PreSurgeryClinicianReportProvenance | null = provenance
    ? {
        ...provenance,
        pinnedProjectionId: selected?.id ?? provenance.pinnedProjectionId,
        pinnedProjectionVersion: selected?.projectionVersion ?? provenance.pinnedProjectionVersion,
        pinnedProjectionInputChecksum:
          selected?.inputChecksum ?? provenance.pinnedProjectionInputChecksum,
      }
    : null;

  return {
    observations,
    graftPlan,
    provenance: provenancePinned,
    patientSafeProjectionLabels,
    illustrativeProjectedResult,
  };
}
