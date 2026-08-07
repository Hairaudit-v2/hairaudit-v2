/**
 * HA-PRE-SURGERY-PROJECTION-REPORT-1A — Unit coverage for report inclusion, consistency,
 * auditor corrections, learning signals, and PDF/web copy guards.
 *
 * Run: pnpm exec tsx --test tests/preSurgeryProjectionReport1a.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { seedAiGraftPlan, createClinicianPlanRevision } from "../src/lib/preSurgeryIntelligence/graftPlanSeed";
import {
  buildClinicianReportSlice,
  selectReportEligibleProjections,
} from "../src/lib/preSurgeryIntelligence/reportIntegration";
import {
  resolveIllustrativeProjectedResultForReport,
} from "../src/lib/preSurgeryIntelligence/reportProjectionInclusion";
import {
  validateProjectionReportConsistency,
  hasBlockingConsistencyIssues,
} from "../src/lib/preSurgeryIntelligence/reportProjectionConsistency";
import {
  ILLUSTRATIVE_PROJECTED_RESULT_INTRO,
  ILLUSTRATIVE_PROJECTED_RESULT_LIMITATION_PANEL,
  findForbiddenProjectionReportLanguage,
  REPORT_PLANNING_MODE_LABELS,
} from "../src/lib/preSurgeryIntelligence/reportProjectionCopy";
import {
  adjustProjectionCorrection,
  assertProjectionSnapshotImmutable,
  createProjectionCorrection,
  projectionCorrectionsArePatientVisible,
} from "../src/lib/preSurgeryIntelligence/projectionCorrections";
import {
  assertLearningSignalHasNoPhi,
  buildProjectionLearningSignal,
} from "../src/lib/preSurgeryIntelligence/projectionLearningSignals";
import {
  generatePreSurgeryPlanningReport,
  sanitizeIllustrativeProjectedResultForStorage,
} from "../src/lib/reports/preSurgeryPlanningReport";
import { renderPreSurgeryPlanningReportHtml } from "../src/lib/reports/PreSurgeryPlanningReportHtml";
import {
  buildPreSurgeryClinicalEvidenceGalleryLabelsEn,
  buildPreSurgeryReportHtmlLabelsEn,
  PRE_SURGERY_OUTCOME_LABELS_EN,
} from "../src/lib/reports/preSurgeryReportLabels";
import { PRE_SURGERY_PROJECTION_PATIENT_LABELS } from "../src/lib/preSurgeryIntelligence/types";
import type { PreSurgeryIllustrativeProjection } from "../src/lib/preSurgeryIntelligence/types";
import { storagePathBelongsToCase } from "../src/lib/uploads/caseFilesPath";

const CASE_ID = "00000000-0000-4000-8000-0000000000a1";
const OTHER_CASE = "00000000-0000-4000-8000-0000000000a2";

function approvePlan(caseId = CASE_ID) {
  const plan = seedAiGraftPlan({
    caseId,
    createdBy: "clin",
    norwood: "III",
    evidenceImageIds: ["img-1"],
    id: "plan-v1",
  });
  return createClinicianPlanRevision(
    plan,
    {
      status: "approved",
      approvedBy: "clin",
      approvedAt: "2026-08-06T02:00:00.000Z",
      zones: plan.zones.map((z) =>
        z.zone === "crown"
          ? { ...z, priority: "defer" as const, minimumGrafts: 0, targetGrafts: 0, maximumGrafts: 0 }
          : { ...z, evidenceImageIds: ["img-1"] }
      ),
    },
    "clin",
    { id: "plan-approved" }
  );
}

function baseProjection(
  overrides: Partial<PreSurgeryIllustrativeProjection> & {
    graftPlanId: string;
    graftPlanVersion: number;
  }
): PreSurgeryIllustrativeProjection {
  return {
    id: "proj-approved-1",
    caseId: CASE_ID,
    sourceImageId: "img-1",
    mode: "planned",
    artifactType: "illustrative_projected_outcome",
    patientSafeLabel: PRE_SURGERY_PROJECTION_PATIENT_LABELS.planned,
    patientSafeDisclaimer:
      "Illustrative planned projection based on the current clinical plan. Not a guarantee of density, growth, survival, or final appearance.",
    status: "approved",
    engineVersion: "ha-pre-surgery-projection-v2",
    generationVersion: "ha-pre-surgery-projection-v2",
    safetyLabelVersion: "ha-pre-surgery-projection-safety-label-v1",
    deterministicSeed: null,
    storagePath: `pre_surgery_projections/${CASE_ID}/planned/abc123.jpg`,
    validationPass: [
      { check: "treatment_zone_compliance", passed: true, detail: "ok" },
      { check: "deferred_zone_compliance", passed: true, detail: "ok" },
      { check: "graft_range_plausibility", passed: true, detail: "ok" },
    ],
    limitations: ["Illustrative planning aid — not a guaranteed outcome."],
    planningAssumptions: ["Projection is constrained to the clinician-approved graft plan."],
    requestedBy: "clin",
    requestedAt: "2026-08-06T02:00:00.000Z",
    generatedAt: "2026-08-06T02:05:00.000Z",
    approvedBy: "clin",
    approvedAt: "2026-08-06T02:10:00.000Z",
    approvedRole: "auditor",
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    inputChecksum: "input-checksum-1",
    outputChecksum: "output-checksum-1",
    providerId: "imagingos-v1",
    patientSharingEnabled: true,
    projectionVersion: 1,
    ...overrides,
  };
}

describe("HA-PRE-SURGERY-PROJECTION-REPORT-1A eligibility", () => {
  it("includes approved pre_surgery projection in report section", () => {
    const approved = approvePlan();
    const projection = baseProjection({
      graftPlanId: approved.id,
      graftPlanVersion: approved.version,
    });
    const section = resolveIllustrativeProjectedResultForReport({
      caseId: CASE_ID,
      pathway: "pre_surgery",
      projections: [projection],
      graftPlans: [approved],
      planningOutcomeId: "suitable_with_long_term_planning",
      graftEstimateRange: {
        min: approved.totalMinimumGrafts,
        max: approved.totalMaximumGrafts,
      },
      now: "2026-08-06T03:00:00.000Z",
    });
    assert.equal(section.inclusionState, "approved_for_inclusion");
    assert.equal(section.showImagery, true);
    assert.equal(section.projectionSnapshotId, projection.id);
    assert.equal(section.mode, "planned");
    assert.equal(section.planningModeLabel, REPORT_PLANNING_MODE_LABELS.planned);
    assert.ok(section.deferredZones.includes("crown"));
    assert.match(section.limitationPanel, /illustrative projection based on the proposed surgical plan/i);
    assert.match(section.intro, /not a guarantee of density, growth, coverage or final appearance/i);
    assert.equal(section.title, "Illustrative Projected Outcome");
  });

  it("never includes draft or unapproved projections", () => {
    const approved = approvePlan();
    for (const status of ["draft_request", "generated", "clinician_review"] as const) {
      const projection = baseProjection({
        graftPlanId: approved.id,
        graftPlanVersion: approved.version,
        status,
        patientSharingEnabled: status === "clinician_review" ? false : true,
      });
      const section = resolveIllustrativeProjectedResultForReport({
        caseId: CASE_ID,
        pathway: "pre_surgery",
        projections: [projection],
        graftPlans: [approved],
        planningOutcomeId: "strong_surgical_candidate",
      });
      assert.equal(section.showImagery, false);
      assert.notEqual(section.inclusionState, "approved_for_inclusion");
    }
  });

  it("rejects post_surgery pathway and other-case projections", () => {
    const approved = approvePlan();
    const projection = baseProjection({
      graftPlanId: approved.id,
      graftPlanVersion: approved.version,
    });
    const post = resolveIllustrativeProjectedResultForReport({
      caseId: CASE_ID,
      pathway: "post_surgery",
      projections: [projection],
      graftPlans: [approved],
      planningOutcomeId: "strong_surgical_candidate",
    });
    assert.equal(post.showImagery, false);

    const foreign = resolveIllustrativeProjectedResultForReport({
      caseId: CASE_ID,
      pathway: "pre_surgery",
      projections: [{ ...projection, caseId: OTHER_CASE }],
      graftPlans: [approved],
      planningOutcomeId: "strong_surgical_candidate",
    });
    assert.equal(foreign.showImagery, false);
  });

  it("does not select superseded snapshot when an approved current exists", () => {
    const approved = approvePlan();
    const superseded = baseProjection({
      id: "proj-old",
      graftPlanId: approved.id,
      graftPlanVersion: approved.version,
      status: "superseded",
      supersededAt: "2026-08-06T02:20:00.000Z",
      mode: "conservative",
    });
    const current = baseProjection({
      id: "proj-new",
      graftPlanId: approved.id,
      graftPlanVersion: approved.version,
      mode: "planned",
    });
    const eligible = selectReportEligibleProjections([superseded, current], {
      graftPlanId: approved.id,
      graftPlanVersion: approved.version,
      graftPlanChecksum: approved.checksum,
      totalMinimumGrafts: approved.totalMinimumGrafts,
      totalTargetGrafts: approved.totalTargetGrafts,
      totalMaximumGrafts: approved.totalMaximumGrafts,
      donorAvailabilityBand: approved.donorAvailabilityBand,
      deferredZones: approved.deferredZones,
      proposedSessionCount: approved.proposedSessionCount,
      zoneSummaries: approved.zones.map((z) => ({
        zone: z.zone,
        priority: z.priority,
        minimumGrafts: z.minimumGrafts,
        targetGrafts: z.targetGrafts,
        maximumGrafts: z.maximumGrafts,
      })),
      planningAssumptions: [],
    });
    assert.equal(eligible.length, 1);
    assert.equal(eligible[0]!.id, "proj-new");
  });

  it("report remains valid when no projection exists", () => {
    const report = generatePreSurgeryPlanningReport({
      caseId: CASE_ID,
      summary: { forensic_audit: { overall_score: 70, key_findings: [], photo_observations: [] } },
    });
    assert.equal(report.pathway, "pre_surgery");
    assert.ok(report.sections.length > 0);
    assert.equal(report.illustrativeProjectedResult, null);
  });
});

describe("HA-PRE-SURGERY-PROJECTION-REPORT-1A consistency + copy", () => {
  it("blocks not-recommended-yet without discussion-only approval", () => {
    const approved = approvePlan();
    const projection = baseProjection({
      graftPlanId: approved.id,
      graftPlanVersion: approved.version,
    });
    const issues = validateProjectionReportConsistency({
      caseId: CASE_ID,
      pathway: "pre_surgery",
      planningOutcomeId: "medical_stabilisation_recommended_first",
      graftPlan: {
        graftPlanId: approved.id,
        graftPlanVersion: approved.version,
        graftPlanChecksum: approved.checksum,
        totalMinimumGrafts: approved.totalMinimumGrafts,
        totalTargetGrafts: approved.totalTargetGrafts,
        totalMaximumGrafts: approved.totalMaximumGrafts,
        donorAvailabilityBand: approved.donorAvailabilityBand,
        deferredZones: approved.deferredZones,
        proposedSessionCount: approved.proposedSessionCount,
        zoneSummaries: [],
        planningAssumptions: [],
      },
      projection,
      discussionOnlyIllustrationApproved: false,
      graftEstimateRange: {
        min: approved.totalMinimumGrafts,
        max: approved.totalMaximumGrafts,
      },
    });
    assert.equal(hasBlockingConsistencyIssues(issues), true);
    assert.ok(issues.some((i) => i.code === "suitability_requires_discussion_only"));
  });

  it("allows discussion-only illustration with explicit override", () => {
    const approved = approvePlan();
    const projection = baseProjection({
      graftPlanId: approved.id,
      graftPlanVersion: approved.version,
      approvalOverrideReason: "discussion_only_illustration",
      approvalChecklist: {
        correctPatientAndCase: true,
        correctSourceImages: true,
        correctApprovedGraftPlanVersion: true,
        hairlineWithinApprovedPlan: true,
        coverageZonesDoNotExceedPlan: true,
        deferredZonesRemainVisiblyDeferred: true,
        donorLimitationsNotMisrepresented: true,
        densityNotPresentedAsGuaranteed: true,
        visualOutputDoesNotImplyExactFutureGrowth: true,
        patientSafeDisclaimerPresent: true,
        suitableToShare: true,
      },
    });
    const section = resolveIllustrativeProjectedResultForReport({
      caseId: CASE_ID,
      pathway: "pre_surgery",
      projections: [projection],
      graftPlans: [approved],
      planningOutcomeId: "medical_stabilisation_recommended_first",
      stabilisationPriorityBand: "high",
      graftEstimateRange: {
        min: approved.totalMinimumGrafts,
        max: approved.totalMaximumGrafts,
      },
    });
    assert.equal(section.showImagery, true);
    assert.equal(section.discussionOnly, true);
    assert.ok(
      section.keyAssumptions.some((a) => /stabilisation|Discussion-only/i.test(a))
    );
  });

  it("keeps deferred zones textual and graft range matched", () => {
    const approved = approvePlan();
    const projection = baseProjection({
      graftPlanId: approved.id,
      graftPlanVersion: approved.version,
    });
    const slice = buildClinicianReportSlice({
      observations: [],
      graftPlans: [approved],
      projections: [projection],
      caseId: CASE_ID,
      pathway: "pre_surgery",
      planningOutcomeId: "suitable_with_long_term_planning",
    });
    const report = generatePreSurgeryPlanningReport({
      caseId: CASE_ID,
      summary: { forensic_audit: { overall_score: 72, key_findings: [], photo_observations: [] } },
      clinicianReportSlice: slice,
    });
    assert.deepEqual(
      report.illustrativeProjectedResult?.provisionalGraftRange,
      report.graftEstimateRange
    );
    assert.ok(report.illustrativeProjectedResult?.deferredZones.includes("crown"));
    assert.ok(
      report.illustrativeProjectedResult?.modelledTreatmentZones.some(
        (z) => z.zone === "crown" && z.priority === "defer" && z.grafts === 0
      )
    );
  });

  it("strips storage paths and forbidden guarantee language from frozen report", () => {
    const approved = approvePlan();
    const projection = baseProjection({
      graftPlanId: approved.id,
      graftPlanVersion: approved.version,
      storagePath: `pre_surgery_projections/${CASE_ID}/planned/secret-path.jpg`,
    });
    const slice = buildClinicianReportSlice({
      observations: [],
      graftPlans: [approved],
      projections: [projection],
      caseId: CASE_ID,
      pathway: "pre_surgery",
      planningOutcomeId: "strong_surgical_candidate",
    });
    const report = generatePreSurgeryPlanningReport({
      caseId: CASE_ID,
      summary: { forensic_audit: { overall_score: 80, key_findings: [], photo_observations: [] } },
      clinicianReportSlice: slice,
    });
    const blob = JSON.stringify(report);
    assert.doesNotMatch(blob, /secret-path/);
    assert.equal(report.illustrativeProjectedResult?.media?.projectedStoragePath, null);
    assert.equal(findForbiddenProjectionReportLanguage(ILLUSTRATIVE_PROJECTED_RESULT_INTRO), null);
    assert.equal(
      findForbiddenProjectionReportLanguage(ILLUSTRATIVE_PROJECTED_RESULT_LIMITATION_PANEL),
      null
    );
    assert.ok(findForbiddenProjectionReportLanguage("guaranteed result"));
    assert.ok(findForbiddenProjectionReportLanguage("this is how you will look"));
  });

  it("pins snapshot across working-plan edits via pinnedProjectionId", () => {
    const approved = approvePlan();
    const projection = baseProjection({
      graftPlanId: approved.id,
      graftPlanVersion: approved.version,
      id: "proj-pin",
    });
    const section1 = resolveIllustrativeProjectedResultForReport({
      caseId: CASE_ID,
      pathway: "pre_surgery",
      projections: [projection],
      graftPlans: [approved],
      planningOutcomeId: "suitable_with_long_term_planning",
      pinnedProjectionId: "proj-pin",
      graftEstimateRange: {
        min: approved.totalMinimumGrafts,
        max: approved.totalMaximumGrafts,
      },
    });
    // Later working draft mode optimistic should not replace pin when reissued with pin.
    const newer = baseProjection({
      id: "proj-newer",
      graftPlanId: approved.id,
      graftPlanVersion: approved.version,
      mode: "optimistic_within_approved_range",
      patientSafeLabel: PRE_SURGERY_PROJECTION_PATIENT_LABELS.optimistic_within_approved_range,
    });
    const section2 = resolveIllustrativeProjectedResultForReport({
      caseId: CASE_ID,
      pathway: "pre_surgery",
      projections: [projection, newer],
      graftPlans: [approved],
      planningOutcomeId: "suitable_with_long_term_planning",
      pinnedProjectionId: section1.projectionSnapshotId,
      graftEstimateRange: {
        min: approved.totalMinimumGrafts,
        max: approved.totalMaximumGrafts,
      },
    });
    assert.equal(section2.projectionSnapshotId, "proj-pin");
  });
});

describe("HA-PRE-SURGERY-PROJECTION-REPORT-1A PDF / media", () => {
  it("renders approved projection into PDF HTML with limitation language", () => {
    const approved = approvePlan();
    const projection = baseProjection({
      graftPlanId: approved.id,
      graftPlanVersion: approved.version,
    });
    const slice = buildClinicianReportSlice({
      observations: [],
      graftPlans: [approved],
      projections: [projection],
      caseId: CASE_ID,
      pathway: "pre_surgery",
      planningOutcomeId: "suitable_with_long_term_planning",
    });
    const report = generatePreSurgeryPlanningReport({
      caseId: CASE_ID,
      summary: { forensic_audit: { overall_score: 74, key_findings: [], photo_observations: [] } },
      clinicianReportSlice: slice,
    });
    const html = renderPreSurgeryPlanningReportHtml({
      report,
      caseId: CASE_ID,
      generatedAtDisplay: "2026-08-06",
      labels: buildPreSurgeryReportHtmlLabelsEn(
        PRE_SURGERY_OUTCOME_LABELS_EN[report.planningOutcomeId] ?? report.planningOutcomeId
      ),
      clinicalEvidenceLabels: buildPreSurgeryClinicalEvidenceGalleryLabelsEn(),
      illustrativeProjectionMedia: {
        sourceImageUrl: "https://example.test/source.jpg?sig=1",
        projectedImageUrl: "https://example.test/projected.jpg?sig=1",
      },
    });
    assert.match(html, /Illustrative Projected Outcome/);
    assert.match(html, /illustrative projection based on the proposed surgical plan/i);
    assert.match(html, /illustrative-projected-result-pdf/);
    assert.match(html, /Illustrative Projected Outcome scenario: Planned/);
    assert.doesNotMatch(html, /guaranteed result/i);
    assert.doesNotMatch(html, /this is how you will look/i);

    // Controlled fallback when private asset missing
    const fallbackHtml = renderPreSurgeryPlanningReportHtml({
      report,
      caseId: CASE_ID,
      generatedAtDisplay: "2026-08-06",
      labels: buildPreSurgeryReportHtmlLabelsEn(
        PRE_SURGERY_OUTCOME_LABELS_EN[report.planningOutcomeId] ?? report.planningOutcomeId
      ),
      clinicalEvidenceLabels: buildPreSurgeryClinicalEvidenceGalleryLabelsEn(),
      illustrativeProjectionMedia: { sourceImageUrl: null, projectedImageUrl: null },
    });
    assert.match(fallbackHtml, /could not be retrieved|omitted/i);
    assert.doesNotMatch(fallbackHtml, /<img[^>]+src=["']\s*["']/);

    const outDir = path.join("tmp", "pre-surgery-projection-report-1a");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, "approved-projection.html"), html, "utf8");
    writeFileSync(path.join(outDir, "asset-fallback.html"), fallbackHtml, "utf8");
  });

  it("allows pre_surgery_projections case-scoped storage paths", () => {
    assert.equal(
      storagePathBelongsToCase(CASE_ID, `pre_surgery_projections/${CASE_ID}/planned/x.stub`),
      true
    );
    assert.equal(
      storagePathBelongsToCase(CASE_ID, `pre_surgery_projections/${OTHER_CASE}/planned/x.stub`),
      false
    );
  });
});

describe("HA-PRE-SURGERY-PROJECTION-REPORT-1A auditor corrections + learning", () => {
  it("creates and adjusts corrections without mutating projection snapshot", () => {
    const snapshot = {
      id: "proj-approved-1",
      storagePath: `pre_surgery_projections/${CASE_ID}/planned/abc.stub`,
      outputChecksum: "output-checksum-1",
    };
    const correction = createProjectionCorrection({
      caseId: CASE_ID,
      projectionSnapshotId: snapshot.id,
      projectionVersion: 1,
      correctionCodes: ["incorrect_hairline", "deferred_zone_filled"],
      clinicalNote: "Hairline sits too low and crown appears filled despite deferral.",
      zoneRefs: ["hairline", "crown"],
      createdBy: "auditor-1",
    });
    assert.equal(correction.status, "open");
    assert.equal(projectionCorrectionsArePatientVisible(), false);

    const { superseding, priorWithdrawn } = adjustProjectionCorrection(correction, {
      clinicalNote: "Adjusted note after secondary forensic review of hairline geometry.",
      correctionCodes: ["incorrect_hairline"],
      updatedBy: "auditor-1",
    });
    assert.equal(priorWithdrawn.status, "withdrawn");
    assert.equal(superseding.status, "adjusted");
    assert.equal(superseding.supersedesCorrectionId, correction.id);

    assert.doesNotThrow(() =>
      assertProjectionSnapshotImmutable(snapshot, { ...snapshot })
    );
    assert.throws(() =>
      assertProjectionSnapshotImmutable(snapshot, {
        ...snapshot,
        outputChecksum: "tampered",
      })
    );
  });

  it("emits de-identified learning signal without PHI", () => {
    const correction = createProjectionCorrection({
      caseId: CASE_ID,
      projectionSnapshotId: "proj-approved-1",
      projectionVersion: 1,
      correctionCodes: ["excessive_density_implication"],
      clinicalNote: "Density implication too strong for approved graft band; patient John Doe john@x.com",
      createdBy: "auditor-1",
    });
    const signal = buildProjectionLearningSignal({
      correction,
      projectionMode: "planned",
    });
    assert.equal(signal.source, "auditor_projection_correction");
    assert.ok(signal.correctionCodes.includes("excessive_density_implication"));
    assert.doesNotMatch(JSON.stringify(signal), new RegExp(CASE_ID));
    assert.doesNotMatch(JSON.stringify(signal), /john@x\.com/i);
    assert.doesNotMatch(JSON.stringify(signal), /John Doe/);
    assertLearningSignalHasNoPhi(signal, CASE_ID);
  });

  it("excludes auditor corrections from patient report payload", () => {
    const approved = approvePlan();
    const projection = baseProjection({
      graftPlanId: approved.id,
      graftPlanVersion: approved.version,
    });
    const slice = buildClinicianReportSlice({
      observations: [],
      graftPlans: [approved],
      projections: [projection],
      caseId: CASE_ID,
      pathway: "pre_surgery",
      planningOutcomeId: "suitable_with_long_term_planning",
    });
    const report = generatePreSurgeryPlanningReport({
      caseId: CASE_ID,
      summary: { forensic_audit: { overall_score: 70, key_findings: [], photo_observations: [] } },
      clinicianReportSlice: slice,
    });
    const blob = JSON.stringify(report);
    assert.doesNotMatch(blob, /correctionCodes/);
    assert.doesNotMatch(blob, /Forensic projection corrections/i);
    assert.doesNotMatch(blob, /clinicalNote/);
    const sanitized = sanitizeIllustrativeProjectedResultForStorage(
      slice.illustrativeProjectedResult
    );
    assert.equal(sanitized?.media?.projectedStoragePath, null);
  });
});

describe("HA-PRE-SURGERY-PROJECTION-REPORT-1A migration", () => {
  it("adds projection correction table and audit event types", () => {
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const sql = readFileSync(
      path.join(
        "supabase",
        "migrations",
        "20260806120000_hairaudit_pre_surgery_projection_report_1a.sql"
      ),
      "utf8"
    );
    assert.match(sql, /hairaudit_pre_surgery_projection_corrections/);
    assert.match(sql, /projection_included_in_report/);
    assert.match(sql, /projection_correction_recorded/);
    assert.match(sql, /projection_learning_signal_emitted/);
    assert.doesNotMatch(sql, /ALTER TABLE public\.hairaudit_projection_snapshots/);
  });
});
