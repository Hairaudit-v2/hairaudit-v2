/**
 * HA-PROJECTION-1A — Deterministic builder for SurgeryDayProcedureReconstruction.
 *
 * Derives from existing audit/report/evidence inputs. No migration / persistence in 1A.
 * Makes no future-result claims.
 */

import {
  assessSurgeryDayEvidence,
  resolveProjectionEvidenceRole,
  SURGERY_DAY_EVIDENCE_POLICY,
} from "./surgeryDayEvidence";
import {
  buildBaselineComparisonFeatures,
  buildObservedFeaturesFromForensic,
  type ForensicAuditLike,
} from "./surgeryDayObservedFeatures";
import {
  resolveSurgeryDayProcedureContext,
  type ProcedureContextSources,
} from "./surgeryDayProcedureContext";
import {
  assertNoFutureResultClaims,
  SAFE_LIMITATION_TEMPLATES,
  sanitizeObservedText,
} from "./surgeryDayReconstructionSafety";
import type {
  GraftEvidenceSource,
  ProjectionEvidenceContext,
  ProjectionUploadInput,
  ReconstructionConfidence,
  SurgeryDayProcedureReconstruction,
  SurgeryDayReconstructionAssessmentType,
} from "./types";

export type GraftIntegrityLike = {
  estimated_implanted_min?: number | null;
  estimated_implanted_max?: number | null;
  estimated_extracted_min?: number | null;
  estimated_extracted_max?: number | null;
  confidence_label?: string | null;
  confidence?: number | null;
  auditor_status?: string | null;
};

export type BuildSurgeryDayProcedureReconstructionInput = {
  uploads: ProjectionUploadInput[];
  evidenceContext?: ProjectionEvidenceContext;
  procedureSources?: ProcedureContextSources;
  forensicAudit?: ForensicAuditLike | null;
  graftIntegrity?: GraftIntegrityLike | null;
};

export type BuildSurgeryDayProcedureReconstructionResult =
  | {
      ok: true;
      reconstruction: SurgeryDayProcedureReconstruction;
      insufficient: false;
    }
  | {
      ok: false;
      insufficient: true;
      reason: string;
      evidence: ReturnType<typeof assessSurgeryDayEvidence>;
      reconstruction: null;
    };

function mapGiiConfidence(label: string | null | undefined): ReconstructionConfidence {
  const l = String(label ?? "").toLowerCase();
  if (l === "high") return "high";
  if (l === "medium" || l === "moderate") return "moderate";
  return "low";
}

function refineConfidence(
  base: ReconstructionConfidence,
  opts: {
    hasStructuredMetadata: boolean;
    hasDonor: boolean;
    hasDesign: boolean;
    baselineAvailable: boolean;
    usedAnyDay0Fallback: boolean;
  }
): ReconstructionConfidence {
  if (opts.usedAnyDay0Fallback) return "low";
  if (
    base !== "low" &&
    opts.hasStructuredMetadata &&
    opts.hasDonor &&
    opts.hasDesign &&
    opts.baselineAvailable
  ) {
    return "high";
  }
  if (base === "high") return "high";
  if (
    opts.hasStructuredMetadata ||
    opts.hasDonor ||
    opts.hasDesign ||
    opts.baselineAvailable
  ) {
    return base === "low" ? "moderate" : base;
  }
  return "low";
}

function collectAllTexts(r: SurgeryDayProcedureReconstruction): string[] {
  const texts: string[] = [
    ...r.evidence.limitations,
    ...r.baseline.limitations,
    ...r.overallObservations.map((o) => o.observation),
  ];
  const pushFeature = (f: { observation: string } | null | undefined) => {
    if (f?.observation) texts.push(f.observation);
  };
  pushFeature(r.recipient.hairlineDesign);
  pushFeature(r.recipient.recipientPlacement);
  pushFeature(r.recipient.densityDistribution);
  pushFeature(r.recipient.directionAndAngulation);
  pushFeature(r.recipient.symmetryAndTransition);
  if (r.donor) {
    pushFeature(r.donor.extractionPattern);
    pushFeature(r.donor.extractionDistribution);
    for (const c of r.donor.visibleConcerns) texts.push(c.observation);
  }
  pushFeature(r.baseline.nativeHairPattern);
  pushFeature(r.baseline.treatmentRelationship);
  return texts;
}

/**
 * Build canonical surgery-day procedure reconstruction (derived, not persisted).
 */
export function buildSurgeryDayProcedureReconstruction(
  input: BuildSurgeryDayProcedureReconstructionInput
): BuildSurgeryDayProcedureReconstructionResult {
  const evidenceCtx = input.evidenceContext ?? {};
  const procedure = resolveSurgeryDayProcedureContext(input.procedureSources ?? {});

  // Prefer procedure date from metadata when context omitted
  const context: ProjectionEvidenceContext = {
    ...evidenceCtx,
    procedureDate: evidenceCtx.procedureDate ?? procedure.procedureDate,
  };

  const evidence = assessSurgeryDayEvidence({
    uploads: input.uploads ?? [],
    context,
  });

  if (!evidence.sufficient || !evidence.mode) {
    return {
      ok: false,
      insufficient: true,
      reason: "Acceptable surgery-day recipient evidence is required for procedure reconstruction.",
      evidence,
      reconstruction: null,
    };
  }

  const assessmentType: SurgeryDayReconstructionAssessmentType =
    evidence.mode === "baseline_plus_surgery_day"
      ? "surgery_day_reconstruction_with_baseline"
      : "surgery_day_reconstruction";

  const hasDonor = evidence.presentRoles.includes("surgery_day_donor");
  const hasDesign = evidence.presentRoles.includes("surgery_day_design");

  const observed = buildObservedFeaturesFromForensic({
    forensic: input.forensicAudit,
    presentRoles: evidence.presentRoles,
    treatedAreaZones: procedure.treatedAreaZones,
    hasDonorEvidence: hasDonor,
    hasBaseline: evidence.baselineAvailable,
  });

  const baselineRoles = evidence.presentRoles.filter((r) =>
    (SURGERY_DAY_EVIDENCE_POLICY.baselineRoles as readonly string[]).includes(r)
  );

  const baselineFeatures = buildBaselineComparisonFeatures({
    hasBaseline: evidence.baselineAvailable,
    treatedAreas: procedure.treatedAreas,
    presentBaselineRoles: baselineRoles,
  });

  // Graft integrity — only when implanted range is present (existing GII path)
  const gii = input.graftIntegrity;
  const giiMin = gii?.estimated_implanted_min;
  const giiMax = gii?.estimated_implanted_max;
  const hasGii =
    gii != null &&
    giiMin != null &&
    giiMax != null &&
    Number.isFinite(Number(giiMin)) &&
    Number.isFinite(Number(giiMax));

  const imageDerivedEstimate = hasGii
    ? {
        min: Math.round(Number(giiMin)),
        max: Math.round(Number(giiMax)),
        confidence: mapGiiConfidence(gii?.confidence_label),
      }
    : null;

  // Image-derived estimates stay in imageDerivedEstimate only — never averaged into reported counts.

  let graftSource: GraftEvidenceSource = null;
  const clinicReportedCount =
    procedure.graftProvenance.find((p) => p.source === "clinic_reported")?.value ??
    procedure.actualGraftCount;
  const patientReported = procedure.graftProvenance.find((p) => p.source === "patient_reported");
  if (clinicReportedCount != null && (hasGii || patientReported)) graftSource = "mixed";
  else if (clinicReportedCount != null) graftSource = "clinic_reported";
  else if (patientReported) graftSource = "patient_reported";
  else if (hasGii) graftSource = "ai_estimated";

  const confidence = refineConfidence(evidence.confidence, {
    hasStructuredMetadata: procedure.hasStructuredMetadata,
    hasDonor,
    hasDesign,
    baselineAvailable: evidence.baselineAvailable,
    usedAnyDay0Fallback: evidence.usedAnyDay0Fallback,
  });

  const limitations = [
    ...evidence.limitations,
    ...procedure.limitations,
    ...baselineFeatures.limitations,
    SAFE_LIMITATION_TEMPLATES.noDensityMeasure,
    SAFE_LIMITATION_TEMPLATES.noSiteCount,
    SAFE_LIMITATION_TEMPLATES.noFinalGrowth,
    SAFE_LIMITATION_TEMPLATES.noGeometry,
  ];

  if (hasDonor && evidence.missingRecommendedRoles.length === 0) {
    // keep
  } else if (!hasDonor) {
    // already in evidence.limitations
  }

  const uniqueLimitations = [...new Set(limitations.map((l) => sanitizeObservedText(l) ?? l).filter(Boolean))];

  const reconstruction: SurgeryDayProcedureReconstruction = {
    assessmentType,
    evidence: {
      confidence,
      presentRoles: evidence.presentRoles,
      limitations: uniqueLimitations,
    },
    procedureContext: {
      procedureDate: procedure.procedureDate,
      procedureType: procedure.procedureType,
      reportedGraftCount: procedure.reportedGraftCount,
      actualGraftCount: procedure.actualGraftCount,
      estimatedHairCount: procedure.estimatedHairCount,
      averageHairsPerGraft: procedure.averageHairsPerGraft,
      punchSizeMm: procedure.punchSizeMm,
      extractionMethod: procedure.extractionMethod,
      implantationMethod: procedure.implantationMethod,
      treatedAreas: procedure.treatedAreas,
    },
    recipient: {
      observedTreatedAreas: observed.observedTreatedAreas.length
        ? observed.observedTreatedAreas
        : procedure.treatedAreas,
      hairlineDesign: observed.hairlineDesign,
      recipientPlacement: observed.recipientPlacement,
      densityDistribution: observed.densityDistribution,
      directionAndAngulation: observed.directionAndAngulation,
      symmetryAndTransition: observed.symmetryAndTransition,
    },
    donor: hasDonor
      ? {
          extractionPattern: observed.extractionPattern,
          extractionDistribution: observed.extractionDistribution,
          visibleConcerns: observed.visibleDonorConcerns,
        }
      : null,
    baseline: {
      available: evidence.baselineAvailable,
      nativeHairPattern: baselineFeatures.nativeHairPattern,
      treatmentRelationship: baselineFeatures.treatmentRelationship,
      limitations: baselineFeatures.limitations,
    },
    graftEvidence: {
      clinicReportedCount: clinicReportedCount ?? null,
      imageDerivedEstimate,
      source: graftSource,
      provenance: procedure.graftProvenance,
    },
    overallObservations: observed.overallObservations,
  };

  const safety = assertNoFutureResultClaims(collectAllTexts(reconstruction));
  if (!safety.ok) {
    // Drop violating overall observations; keep structured safe fallbacks
    reconstruction.overallObservations = reconstruction.overallObservations.filter(
      (o) => assertNoFutureResultClaims([o.observation]).ok
    );
    const retry = assertNoFutureResultClaims(collectAllTexts(reconstruction));
    if (!retry.ok) {
      // Strip any remaining unsafe feature observations
      const scrub = <T extends { observation: string } | null>(f: T): T => {
        if (!f) return f;
        if (assertNoFutureResultClaims([f.observation]).ok) return f;
        return { ...f, observation: "Observation withheld pending safety review of source wording." } as T;
      };
      reconstruction.recipient.hairlineDesign = scrub(reconstruction.recipient.hairlineDesign);
      reconstruction.recipient.recipientPlacement = scrub(reconstruction.recipient.recipientPlacement);
      reconstruction.recipient.densityDistribution = scrub(reconstruction.recipient.densityDistribution);
      reconstruction.recipient.directionAndAngulation = scrub(
        reconstruction.recipient.directionAndAngulation
      );
      reconstruction.recipient.symmetryAndTransition = scrub(
        reconstruction.recipient.symmetryAndTransition
      );
      if (reconstruction.donor) {
        reconstruction.donor.extractionPattern = scrub(reconstruction.donor.extractionPattern);
        reconstruction.donor.extractionDistribution = scrub(reconstruction.donor.extractionDistribution);
        reconstruction.donor.visibleConcerns = reconstruction.donor.visibleConcerns.map((c) => scrub(c)!);
      }
      reconstruction.baseline.nativeHairPattern = scrub(reconstruction.baseline.nativeHairPattern);
      reconstruction.baseline.treatmentRelationship = scrub(reconstruction.baseline.treatmentRelationship);
    }
  }

  return {
    ok: true,
    insufficient: false,
    reconstruction,
  };
}

/** Helper for tests / consumers: resolve all uploads. */
export function resolveAllProjectionEvidence(
  uploads: ProjectionUploadInput[],
  context?: ProjectionEvidenceContext
) {
  return uploads.map((u) => resolveProjectionEvidenceRole(u, context ?? {}));
}
