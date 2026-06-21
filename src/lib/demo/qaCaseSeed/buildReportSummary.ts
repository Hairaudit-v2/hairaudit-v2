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
import type { DemoQaIntelligencePatch, DemoQaScenario, DemoQaSeededCaseSummary } from "./types";
import {
  demoQaExternalCaseId,
  demoQaUserEmail,
} from "./constants";
import {
  getDemoQaRecommendedUploadKeys,
  getDemoQaRequiredUploadKeys,
} from "./scenarios";

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
  return keys.map((key) => `patient_photo:${key}`);
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
    const report = generatePostSurgeryAuditReport({
      summary,
      caseId,
      intelligenceBundle: bundle,
      patientReviewPathway: "post_surgery",
      reportVersion: 1,
    });
    summary = { ...summary, post_surgery_audit_report: report };
  }

  summary = {
    ...summary,
    demo_qa_seed: {
      scenarioId: scenario.id,
      pathway: scenario.pathway,
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

  return {
    scenario: args.scenario,
    email: demoQaUserEmail(args.scenario.pathway, args.scenario.index),
    externalCaseId: demoQaExternalCaseId(args.scenario.pathway, args.scenario.index),
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
    if (scenario.expectedPostOutcome && resolved?.proceduralOutcomeId !== scenario.expectedPostOutcome) {
      errors.push(
        `Expected outcome ${scenario.expectedPostOutcome} but got ${resolved?.proceduralOutcomeId} for ${scenario.id}`
      );
    }
  }

  const meta = summary.metadata as { hairAuditIntelligence?: unknown } | undefined;
  if (!meta?.hairAuditIntelligence) {
    errors.push(`Intelligence bundle missing for ${scenario.id}`);
  }

  return errors;
}
