import {
  buildHairAuditIntelligenceBundleFromLegacySummary,
  mergeHairAuditIntelligenceIntoSummaryMetadata,
} from "@/lib/hairaudit-intelligence/shadow/mergeHairAuditIntelligenceIntoSummary.server";
import type { HairAuditIntelligenceBundle } from "@/lib/hairaudit-intelligence/types";
import { isPathwayRequiredUploadComplete } from "@/lib/patient/patientReviewPathway";
import { isAuditSummaryReady } from "@/lib/reports/pdfReadiness";
import {
  generatePostSurgeryAuditReport,
  resolvePostSurgeryAuditReport,
  shouldUsePostSurgeryReportTemplate,
} from "@/lib/reports/postSurgeryAuditReport";
import {
  generatePreSurgeryPlanningReport,
  resolvePreSurgeryPlanningReport,
  shouldUsePreSurgeryReportTemplate,
} from "@/lib/reports/preSurgeryPlanningReport";
import {
  buildAutomatedDonorHealingOrientation,
  confirmDonorHealingOrientation,
  correctDonorHealingOrientation,
  toPatientSafeDonorOrientationSlice,
} from "@/lib/patient/donorHealingOrientationReport";
import type { DemoQaIntelligencePatch, DemoQaScenario, DemoQaSeededCaseSummary } from "./types";
import {
  demoQaExternalCaseId,
  demoQaUserEmail,
  type DemoQaSeedPathway,
} from "./constants";
import { isDemoQaDonorFixture } from "./donorHealingScenarios";
import {
  getDemoQaRecommendedUploadKeys,
  getDemoQaRequiredUploadKeys,
} from "./scenarios";

/** Seed actor id for clinician confirm/correct provenance (never shown to patients). */
const DEMO_QA_DONOR_CLINICIAN_ACTOR_ID = "00000000-0000-4000-8000-00d0n0rcl1n1";

export function demoQaSeedPathwayForScenario(scenario: DemoQaScenario): DemoQaSeedPathway {
  return isDemoQaDonorFixture(scenario) ? "donor_healing" : scenario.pathway;
}

function buildForensicSummary(scenario: DemoQaScenario): Record<string, unknown> {
  const { forensic } = scenario;
  return {
    forensic_audit: {
      overall_score: forensic.overallScore,
      summary: forensic.summary,
      section_scores: forensic.sectionScores,
      key_findings: forensic.keyFindings,
      red_flags: forensic.redFlags ?? [],
      photo_observations: forensic.photoObservations ?? [],
    },
    key_findings: forensic.keyFindings,
    red_flags: forensic.redFlags ?? [],
  };
}

function patchIntelligenceBundle(
  bundle: HairAuditIntelligenceBundle,
  patch: DemoQaIntelligencePatch | undefined
): HairAuditIntelligenceBundle {
  if (!patch) return bundle;

  const next = { ...bundle };

  if (patch.norwoodStage) {
    next.hairLossClassification = {
      ...next.hairLossClassification,
      fields: {
        ...next.hairLossClassification.fields,
        norwoodStage: patch.norwoodStage as typeof next.hairLossClassification.fields.norwoodStage,
      },
    };
  }
  if (patch.crownProgression) {
    next.hairLossClassification = {
      ...next.hairLossClassification,
      fields: {
        ...next.hairLossClassification.fields,
        crownProgression: patch.crownProgression as typeof next.hairLossClassification.fields.crownProgression,
      },
    };
  }
  if (patch.diffuseThinningPattern) {
    next.hairLossClassification = {
      ...next.hairLossClassification,
      fields: {
        ...next.hairLossClassification.fields,
        diffuseThinningPattern:
          patch.diffuseThinningPattern as typeof next.hairLossClassification.fields.diffuseThinningPattern,
      },
    };
  }
  if (patch.donorDensityBand) {
    next.donorIntelligence = {
      ...next.donorIntelligence,
      fields: {
        ...next.donorIntelligence.fields,
        donorDensityBand: patch.donorDensityBand as typeof next.donorIntelligence.fields.donorDensityBand,
      },
    };
  }
  if (patch.donorReserveRisk) {
    next.donorIntelligence = {
      ...next.donorIntelligence,
      fields: {
        ...next.donorIntelligence.fields,
        donorReserveRisk: patch.donorReserveRisk as typeof next.donorIntelligence.fields.donorReserveRisk,
      },
    };
  }
  if (patch.miniaturisationSuspicion) {
    next.donorIntelligence = {
      ...next.donorIntelligence,
      fields: {
        ...next.donorIntelligence.fields,
        miniaturisationSuspicion:
          patch.miniaturisationSuspicion as typeof next.donorIntelligence.fields.miniaturisationSuspicion,
      },
    };
  }
  if (patch.overharvestingIndicators) {
    next.repairSurgery = {
      ...next.repairSurgery,
      fields: {
        ...next.repairSurgery.fields,
        overharvestingIndicators:
          patch.overharvestingIndicators as typeof next.repairSurgery.fields.overharvestingIndicators,
      },
    };
  }
  if (patch.repairComplexityBand) {
    next.repairSurgery = {
      ...next.repairSurgery,
      fields: {
        ...next.repairSurgery.fields,
        repairComplexityBand:
          patch.repairComplexityBand as typeof next.repairSurgery.fields.repairComplexityBand,
      },
    };
  }
  if (patch.overallConfidence) {
    next.overallConfidence = patch.overallConfidence as typeof next.overallConfidence;
  }

  return next;
}

export function buildDemoQaUploadTypes(scenario: DemoQaScenario): string[] {
  const required = getDemoQaRequiredUploadKeys(scenario.pathway);
  const recommended = getDemoQaRecommendedUploadKeys(scenario);
  const keys = [...required, ...recommended];
  return Array.from(new Set(keys)).map((key) => `patient_photo:${key}`);
}

function applyDonorHealingFixtureToSummary(args: {
  scenario: DemoQaScenario;
  summary: Record<string, unknown>;
  uploadTypes: string[];
}): Record<string, unknown> {
  const fixture = args.scenario.donorFixture;
  if (!fixture) return args.summary;

  const answers = {
    ...args.scenario.intakeAnswers,
    entry_context: "donor_healing",
    primary_donor_concern:
      args.scenario.intakeAnswers.primary_donor_concern ?? "donor_patchiness",
  };

  let summary: Record<string, unknown> = {
    ...args.summary,
    entry_context: "donor_healing",
    primary_donor_concern: answers.primary_donor_concern,
    patient_answers: answers,
  };

  if (fixture.omitOrientationRecord) {
    delete summary.donor_healing_orientation;
    // Ensure embedded post report does not carry a stale orientation slice.
    const post = summary.post_surgery_audit_report;
    if (post && typeof post === "object") {
      summary = {
        ...summary,
        post_surgery_audit_report: {
          ...(post as Record<string, unknown>),
          donorHealingOrientation: null,
        },
      };
    }
    return summary;
  }

  const automated = buildAutomatedDonorHealingOrientation({
    answers,
    summary,
    uploadTypes: args.uploadTypes,
  });
  if (!automated) return summary;

  let record = automated;
  if (fixture.kind === "orientation_confirmed") {
    record = confirmDonorHealingOrientation(automated, {
      actorUserId: DEMO_QA_DONOR_CLINICIAN_ACTOR_ID,
    });
  } else if (fixture.kind === "orientation_corrected" && fixture.correctedState) {
    record = correctDonorHealingOrientation(automated, {
      nextState: fixture.correctedState,
      actorUserId: DEMO_QA_DONOR_CLINICIAN_ACTOR_ID,
    });
  }

  const patientSlice = toPatientSafeDonorOrientationSlice(record);
  const post = summary.post_surgery_audit_report;
  summary = {
    ...summary,
    donor_healing_orientation: record,
    post_surgery_audit_report:
      post && typeof post === "object"
        ? {
            ...(post as Record<string, unknown>),
            donorHealingOrientation: patientSlice,
          }
        : post,
  };
  return summary;
}

export function buildDemoQaReportSummary(args: {
  scenario: DemoQaScenario;
  caseId: string;
}): Record<string, unknown> {
  const { scenario, caseId } = args;
  const uploadTypes = buildDemoQaUploadTypes(scenario);
  const uploads = uploadTypes.map((type) => ({
    id: `demo-upload-${type}`,
    type,
    storage_path: `cases/${caseId}/patient/${type.split(":")[1]}/demo.jpg`,
  }));

  let summary = buildForensicSummary(scenario);
  let bundle = buildHairAuditIntelligenceBundleFromLegacySummary({
    caseId,
    summary,
    uploads,
    patientReviewPathway: scenario.pathway,
  });
  bundle = patchIntelligenceBundle(bundle, scenario.intelligencePatch);
  summary = mergeHairAuditIntelligenceIntoSummaryMetadata(summary, bundle);

  if (scenario.pathway === "pre_surgery") {
    const report = generatePreSurgeryPlanningReport({
      summary,
      caseId,
      intelligenceBundle: bundle,
      patientReviewPathway: "pre_surgery",
      reportVersion: 1,
    });
    summary = { ...summary, pre_surgery_planning_report: report };
  } else {
    // Donor fixtures need entry_context on the summary before report generation
    // so generatePostSurgeryAuditReport can attach orientation when present.
    if (scenario.donorFixture) {
      summary = {
        ...summary,
        entry_context: "donor_healing",
        primary_donor_concern:
          scenario.intakeAnswers.primary_donor_concern ?? "donor_patchiness",
        patient_answers: {
          ...scenario.intakeAnswers,
          entry_context: "donor_healing",
        },
      };
    }
    const report = generatePostSurgeryAuditReport({
      summary,
      caseId,
      intelligenceBundle: bundle,
      patientReviewPathway: "post_surgery",
      reportVersion: 1,
      uploadTypes,
      patientAuditV2: { answers: scenario.intakeAnswers },
    });
    summary = { ...summary, post_surgery_audit_report: report };
    summary = applyDonorHealingFixtureToSummary({ scenario, summary, uploadTypes });
  }

  summary = {
    ...summary,
    demo_qa_seed: {
      scenarioId: scenario.id,
      pathway: scenario.pathway,
      seedPathway: demoQaSeedPathwayForScenario(scenario),
      donorFixtureKind: scenario.donorFixture?.kind ?? null,
      seededAt: new Date().toISOString(),
    },
  };

  return summary;
}

export function buildDemoQaSeededCasePreview(args: {
  scenario: DemoQaScenario;
  caseId?: string;
}): DemoQaSeededCaseSummary {
  const caseId = args.caseId ?? `00000000-0000-4000-8000-${args.scenario.index.toString().padStart(12, "0")}`;
  const uploadTypes = buildDemoQaUploadTypes(args.scenario);
  const summary = buildDemoQaReportSummary({ scenario: args.scenario, caseId });
  const seedPathway = demoQaSeedPathwayForScenario(args.scenario);

  return {
    scenario: args.scenario,
    email: demoQaUserEmail(seedPathway, args.scenario.index),
    externalCaseId: demoQaExternalCaseId(seedPathway, args.scenario.index),
    summary,
    uploadTypes,
  };
}

export function validateDemoQaScenarioPreview(preview: DemoQaSeededCaseSummary): string[] {
  const errors: string[] = [];
  const { scenario, summary, uploadTypes } = preview;
  const caseId = "00000000-0000-4000-8000-000000000099";

  const photos = uploadTypes.map((type) => ({ type }));
  if (!isPathwayRequiredUploadComplete(scenario.pathway, photos)) {
    errors.push(`Required upload gate incomplete for ${scenario.id}`);
  }

  const pdfReady = isAuditSummaryReady(summary);
  if (!pdfReady) {
    errors.push(`Summary not PDF-ready for ${scenario.id}`);
  }

  if (scenario.pathway === "pre_surgery") {
    const resolved = resolvePreSurgeryPlanningReport(summary, {
      caseId,
      patientReviewPathway: "pre_surgery",
    });
    if (!resolved) errors.push(`Pre-surgery report failed to resolve for ${scenario.id}`);
    if (resolvePostSurgeryAuditReport(summary, { caseId, patientReviewPathway: "pre_surgery" })) {
      errors.push(`Post-surgery report leaked into pre-surgery scenario ${scenario.id}`);
    }
    if (!shouldUsePreSurgeryReportTemplate("pre_surgery", "patient")) {
      errors.push("Pre-surgery template routing failed");
    }
    if (shouldUsePostSurgeryReportTemplate("pre_surgery", "patient")) {
      errors.push("Post-surgery template incorrectly selected for pre-surgery");
    }
    if (scenario.expectedPreOutcome && resolved?.planningOutcomeId !== scenario.expectedPreOutcome) {
      errors.push(
        `Expected outcome ${scenario.expectedPreOutcome} but got ${resolved?.planningOutcomeId} for ${scenario.id}`
      );
    }
  } else {
    const resolved = resolvePostSurgeryAuditReport(summary, {
      caseId,
      patientReviewPathway: "post_surgery",
    });
    if (!resolved) errors.push(`Post-surgery report failed to resolve for ${scenario.id}`);
    if (resolvePreSurgeryPlanningReport(summary, { caseId, patientReviewPathway: "post_surgery" })) {
      errors.push(`Pre-surgery report leaked into post-surgery scenario ${scenario.id}`);
    }
    if (!shouldUsePostSurgeryReportTemplate("post_surgery", "patient")) {
      errors.push("Post-surgery template routing failed");
    }
    if (shouldUsePreSurgeryReportTemplate("post_surgery", "patient")) {
      errors.push("Pre-surgery template incorrectly selected for post-surgery");
    }
    if (
      scenario.expectedPostOutcome &&
      !scenario.donorFixture &&
      resolved?.proceduralOutcomeId !== scenario.expectedPostOutcome
    ) {
      errors.push(
        `Expected outcome ${scenario.expectedPostOutcome} but got ${resolved?.proceduralOutcomeId} for ${scenario.id}`
      );
    }
    if (scenario.donorFixture) {
      const seedMeta = summary.demo_qa_seed as { donorFixtureKind?: string } | undefined;
      if (seedMeta?.donorFixtureKind !== scenario.donorFixture.kind) {
        errors.push(`Donor fixture kind mismatch for ${scenario.id}`);
      }
      if (scenario.donorFixture.omitOrientationRecord) {
        if (summary.donor_healing_orientation) {
          errors.push(`Orientation should be omitted for ${scenario.id}`);
        }
      } else if (!summary.donor_healing_orientation) {
        errors.push(`Missing donor_healing_orientation for ${scenario.id}`);
      } else {
        const record = summary.donor_healing_orientation as {
          state?: string;
          provenance?: { source?: string };
        };
        if (scenario.donorFixture.kind === "orientation_confirmed") {
          if (record.provenance?.source !== "clinician_confirmation") {
            errors.push(`Expected clinician_confirmation provenance for ${scenario.id}`);
          }
        }
        if (scenario.donorFixture.kind === "orientation_corrected") {
          if (record.provenance?.source !== "clinician_correction") {
            errors.push(`Expected clinician_correction provenance for ${scenario.id}`);
          }
          if (
            scenario.donorFixture.correctedState &&
            record.state !== scenario.donorFixture.correctedState
          ) {
            errors.push(`Expected corrected state for ${scenario.id}`);
          }
        }
        if (scenario.donorFixture.kind === "direct_clinical_assessment") {
          if (record.state !== "direct_clinical_assessment_recommended") {
            errors.push(`Expected direct_clinical_assessment_recommended for ${scenario.id}`);
          }
        }
        if (scenario.donorFixture.kind === "partial_donor_evidence") {
          if (record.state !== "insufficient_evidence" && record.state !== "too_early_to_assess_homogeneity") {
            // Partial evidence should not claim mature compatibility certainty.
            if (record.state === "compatible_with_reported_stage") {
              errors.push(`Partial evidence should not claim stage compatibility for ${scenario.id}`);
            }
          }
        }
      }
      if (summary.entry_context !== "donor_healing") {
        errors.push(`entry_context missing for donor fixture ${scenario.id}`);
      }
    }
  }

  const meta = summary.metadata as { hairAuditIntelligence?: unknown } | undefined;
  if (!meta?.hairAuditIntelligence) {
    errors.push(`Intelligence bundle missing for ${scenario.id}`);
  }

  return errors;
}
