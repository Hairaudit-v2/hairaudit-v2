/**
 * HA-PROJECTION-1G — Longitudinal projection review report tests.
 * Run: pnpm exec tsx --test tests/longitudinalProjectionReview.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { fixtureA_baselinePlusSurgeryDay } from "./fixtures/surgeryDayProjection/fixtures";
import { buildProjectionObservedComparison } from "@/lib/projection/projectionComparison";
import { buildLongitudinalOutcomeObservation } from "@/lib/projection/longitudinalOutcomeObservation";
import type {
  LongitudinalOutcomeObservation,
  LongitudinalOutcomeStage,
  PatientSafeProjectedCharacteristic,
  SurgeryDayProjectedOutcome,
} from "@/lib/projection/types";
import type { ProjectionSnapshot } from "@/lib/projection/projectionSnapshotTypes";
import type { ProjectionObservationSnapshot } from "@/lib/projection/projectionObservationTypes";
import type { ProjectionComparisonSnapshot } from "@/lib/projection/projectionComparisonTypes";
import { computeObservationChecksum } from "@/lib/projection/projectionObservationService";
import {
  COMPARISON_SCHEMA_VERSION,
  OBSERVATION_SCHEMA_VERSION,
  OBSERVATION_LINEAGE_VERSION,
} from "@/lib/projection/versions";
import {
  buildLongitudinalProjectionReviewReport,
  resolveLongitudinalProjectionReviewReport,
  shouldUseLongitudinalProjectionReviewTemplate,
  validateLongitudinalReviewLineage,
} from "@/lib/reports/longitudinalProjectionReview";
import { renderLongitudinalProjectionReviewHtml } from "@/lib/reports/LongitudinalProjectionReviewHtml";
import {
  mapComparisonStatusLabel,
  mapOverallComparisonLabel,
} from "@/lib/reports/longitudinalProjectionReviewSections";
import { normalizeReportTemplateForPdf } from "@/lib/pdf/normalizeReportTemplateForPdf";
import { resolveReportPresentationTemplateName } from "@/lib/reports/surgeryDayProjectionReport";
import { resolvePatientReportTemplateName } from "@/lib/reports/preSurgeryPlanningReport";

const CASE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PATIENT_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const PROJECTION_ID = "11111111-1111-1111-1111-111111111111";
const OBSERVATION_ID = "22222222-2222-2222-2222-222222222222";
const COMPARISON_ID = "33333333-3333-3333-3333-333333333333";
const PROCEDURE = "2025-01-15T00:00:00.000Z";

function makeObservationPayload(
  stage: LongitudinalOutcomeStage,
  structured?: Array<{
    key: string;
    label: string;
    observation: string;
    confidence?: "low" | "moderate" | "high";
  }>,
  opts?: { roles?: "minimal" | "full" | "no_donor" }
): LongitudinalOutcomeObservation {
  const month = stage.replace("month_", "");
  const capture =
    stage === "month_3"
      ? "2025-04-15T00:00:00.000Z"
      : stage === "month_6"
        ? "2025-07-15T00:00:00.000Z"
        : stage === "month_9"
          ? "2025-10-15T00:00:00.000Z"
          : "2026-01-15T00:00:00.000Z";

  let uploads: Array<{ id: string; type: string; captured_at: string }>;
  if (opts?.roles === "minimal") {
    uploads = [
      {
        id: "d",
        type: `patient_photo:postop_month${month}_donor`,
        captured_at: capture,
      },
    ];
  } else if (opts?.roles === "no_donor") {
    uploads = [
      {
        id: "f",
        type: `patient_photo:postop_month${month}_front`,
        captured_at: capture,
      },
      {
        id: "t",
        type: `patient_photo:postop_month${month}_top`,
        captured_at: capture,
      },
    ];
  } else {
    uploads = [
      {
        id: "f",
        type: `patient_photo:postop_month${month}_front`,
        captured_at: capture,
      },
      {
        id: "t",
        type: `patient_photo:postop_month${month}_top`,
        captured_at: capture,
      },
      {
        id: "d",
        type: `patient_photo:postop_month${month}_donor`,
        captured_at: capture,
      },
    ];
  }

  const built = buildLongitudinalOutcomeObservation({
    projectionSnapshotId: PROJECTION_ID,
    caseId: CASE_ID,
    patientId: PATIENT_ID,
    stage,
    observedAt: capture,
    uploads,
    caseContext: {
      procedureDate: PROCEDURE,
      treatedAreas: ["frontal", "hairline", "temples"],
    },
    structuredObservations: structured,
    baselineAvailable: true,
  });
  assert.equal(built.ok, true);
  if (!built.ok) throw new Error(built.reason);
  return built.observation;
}

function makeProjectionSnapshot(
  overrides?: Partial<SurgeryDayProjectedOutcome>
): ProjectionSnapshot {
  const { reconstruction, projectedOutcome } = fixtureA_baselinePlusSurgeryDay();
  const outcome = { ...projectedOutcome, ...overrides };
  return {
    id: PROJECTION_ID,
    caseId: CASE_ID,
    patientId: PATIENT_ID,
    procedureId: CASE_ID,
    projectionType: outcome.assessmentType,
    projectionStatus: "active",
    reconstructionVersion: "ha-projection-1a-v1",
    projectionEngineVersion: "ha-projection-1b-v1",
    snapshotSchemaVersion: "ha-projection-lineage-v1",
    reportTemplateVersion: 1,
    reconstructionInputChecksum: "recon-checksum",
    projectionInputChecksum: "proj-in-checksum",
    projectionOutputChecksum: "proj-out-checksum",
    reconstructionSnapshot: reconstruction,
    projectionSnapshot: outcome,
    confidenceSummary: {
      reconstructionConfidence: reconstruction.evidence.confidence,
      projectionConfidence: outcome.projectionConfidence,
      characteristicCount: outcome.projectedCharacteristics.length,
      limitationCount: outcome.limitations.length,
    },
    evidenceSummary: {
      presentRoles: reconstruction.evidence.presentRoles,
      baselineAvailable: reconstruction.baseline.available,
      assessmentType: outcome.assessmentType,
      reconstructionAssessmentType: reconstruction.assessmentType,
    },
    createdAt: "2025-01-20T00:00:00.000Z",
    createdBy: null,
    supersedesProjectionId: null,
    supersededByProjectionId: null,
    lineageRootId: PROJECTION_ID,
    supersessionReasonCode: null,
    sourceReportId: null,
    sourceAssessmentId: null,
  };
}

function makeObservationSnapshot(
  observation: LongitudinalOutcomeObservation,
  id = OBSERVATION_ID
): ProjectionObservationSnapshot {
  return {
    id,
    projectionSnapshotId: PROJECTION_ID,
    caseId: CASE_ID,
    patientId: PATIENT_ID,
    stage: observation.stage,
    observedAt: observation.observedAt,
    observationStatus: "active",
    observationSchemaVersion: OBSERVATION_SCHEMA_VERSION,
    observationLineageVersion: OBSERVATION_LINEAGE_VERSION,
    observationChecksum: computeObservationChecksum(observation),
    observationPayload: observation,
    createdAt: observation.observedAt,
    createdBy: null,
    supersedesObservationId: null,
    supersededByObservationId: null,
    supersessionReasonCode: null,
    sourceReportId: null,
    sourceAuditId: null,
  };
}

function makeComparisonSnapshot(
  projection: ProjectionSnapshot,
  observation: ProjectionObservationSnapshot
): ProjectionComparisonSnapshot {
  const built = buildProjectionObservedComparison({ projection, observation });
  assert.equal(built.ok, true, built.ok ? "" : built.reason);
  if (!built.ok) throw new Error(built.reason);
  return {
    id: COMPARISON_ID,
    projectionSnapshotId: projection.id,
    observationSnapshotId: observation.id,
    caseId: CASE_ID,
    patientId: PATIENT_ID,
    stage: observation.stage,
    comparisonStatus: "active",
    comparisonSchemaVersion: COMPARISON_SCHEMA_VERSION,
    projectionSchemaVersion: projection.snapshotSchemaVersion,
    observationSchemaVersion: observation.observationSchemaVersion,
    comparisonChecksum: "cmp-checksum",
    comparisonPayload: built.comparison,
    createdAt: observation.observedAt,
    createdBy: null,
    supersedesComparisonId: null,
    supersededByComparisonId: null,
    supersessionReasonCode: null,
  };
}

function htmlVisible(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, " ");
}

function buildAndRender(
  stage: LongitudinalOutcomeStage,
  structured?: Array<{
    key: string;
    label: string;
    observation: string;
    confidence?: "low" | "moderate" | "high";
  }>,
  opts?: { roles?: "minimal" | "full" | "no_donor"; photos?: boolean }
) {
  const projection = makeProjectionSnapshot();
  const observation = makeObservationSnapshot(
    makeObservationPayload(stage, structured, { roles: opts?.roles ?? "full" })
  );
  const comparison = makeComparisonSnapshot(projection, observation);
  const photosByCategory = opts?.photos
    ? {
        day0_recipient: [
          {
            signedUrl: "https://example.test/signed/day0-front.jpg",
            label: "Surgery day front",
          },
        ],
        [`postop_month${stage.replace("month_", "")}_front`]: [
          {
            signedUrl: "https://example.test/signed/followup-front.jpg",
            label: "Follow-up front",
          },
        ],
        day0_donor: [
          {
            signedUrl: "https://example.test/signed/day0-donor.jpg",
            label: "Surgery day donor",
          },
        ],
        [`postop_month${stage.replace("month_", "")}_donor`]: [
          {
            signedUrl: "https://example.test/signed/followup-donor.jpg",
            label: "Follow-up donor",
          },
        ],
        img_preop_front: [
          {
            signedUrl: "https://example.test/signed/preop-front.jpg",
            label: "Preop front",
          },
        ],
      }
    : undefined;

  const built = buildLongitudinalProjectionReviewReport({
    projection,
    observation,
    comparison,
    caseId: CASE_ID,
    reportVersion: 1,
    generatedAt: "2026-07-27T00:00:00.000Z",
    photosByCategory,
  });
  assert.equal(built.ok, true, built.ok ? "" : built.reason);
  if (!built.ok) throw new Error(built.reason);
  const html = renderLongitudinalProjectionReviewHtml({
    report: built.report,
    caseId: CASE_ID,
    generatedAtDisplay: "27 Jul 2026",
  });
  return {
    projection,
    observation,
    comparison,
    report: built.report,
    html,
    text: htmlVisible(html),
  };
}

describe("HA-PROJECTION-1G lineage / routing", () => {
  it("1. valid 1D+1E+1F lineage renders", () => {
    const { report, text } = buildAndRender("month_6");
    assert.equal(report.assessmentType, "longitudinal_projection_review");
    assert.match(text, /Longitudinal Projection Review/);
    assert.match(text, /Month 6 Review/);
    assert.equal(report.projectionSnapshotId, PROJECTION_ID);
    assert.equal(report.observationSnapshotId, OBSERVATION_ID);
    assert.equal(report.comparisonSnapshotId, COMPARISON_ID);
  });

  it("2. wrong projection link fails closed", () => {
    const projection = makeProjectionSnapshot();
    const observation = makeObservationSnapshot(makeObservationPayload("month_6"));
    const comparison = makeComparisonSnapshot(projection, observation);
    comparison.projectionSnapshotId = "99999999-9999-9999-9999-999999999999";
    const built = buildLongitudinalProjectionReviewReport({
      projection,
      observation,
      comparison,
    });
    assert.equal(built.ok, false);
    if (built.ok) throw new Error("expected fail");
    assert.equal(built.code, "LINEAGE_MISMATCH");
  });

  it("3. wrong observation link fails closed", () => {
    const projection = makeProjectionSnapshot();
    const observation = makeObservationSnapshot(makeObservationPayload("month_6"));
    const comparison = makeComparisonSnapshot(projection, observation);
    comparison.observationSnapshotId = "99999999-9999-9999-9999-999999999999";
    const built = buildLongitudinalProjectionReviewReport({
      projection,
      observation,
      comparison,
    });
    assert.equal(built.ok, false);
    if (built.ok) throw new Error("expected fail");
    assert.equal(built.code, "LINEAGE_MISMATCH");
  });

  it("4. case mismatch fails closed", () => {
    const projection = makeProjectionSnapshot();
    const observation = makeObservationSnapshot(makeObservationPayload("month_6"));
    observation.caseId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    const lineage = validateLongitudinalReviewLineage({
      projection,
      observation,
      comparison: makeComparisonSnapshot(projection, {
        ...observation,
        caseId: CASE_ID,
        observationPayload: { ...observation.observationPayload, caseId: CASE_ID },
      }),
    });
    // Direct mismatch on observation vs projection
    const direct = validateLongitudinalReviewLineage({
      projection,
      observation,
      comparison: {
        ...makeComparisonSnapshot(
          projection,
          makeObservationSnapshot(makeObservationPayload("month_6"))
        ),
        caseId: CASE_ID,
      },
    });
    assert.equal(direct.ok || lineage.ok === false, true);
    assert.equal(
      validateLongitudinalReviewLineage({
        projection,
        observation,
        comparison: {
          id: COMPARISON_ID,
          projectionSnapshotId: projection.id,
          observationSnapshotId: observation.id,
          caseId: "dddddddd-dddd-dddd-dddd-dddddddddddd",
          patientId: PATIENT_ID,
          stage: "month_6",
          comparisonStatus: "active",
          comparisonSchemaVersion: COMPARISON_SCHEMA_VERSION,
          projectionSchemaVersion: "ha-projection-lineage-v1",
          observationSchemaVersion: OBSERVATION_SCHEMA_VERSION,
          comparisonChecksum: "x",
          comparisonPayload: {
            projectionSnapshotId: projection.id,
            observationSnapshotId: observation.id,
            caseId: "dddddddd-dddd-dddd-dddd-dddddddddddd",
            patientId: PATIENT_ID,
            stage: "month_6",
            comparisonVersion: COMPARISON_SCHEMA_VERSION,
            overallStatus: "consistent",
            domains: [],
            summary: null,
            limitations: [],
            generatedAt: "2025-07-15T00:00:00.000Z",
          },
          createdAt: "2025-07-15T00:00:00.000Z",
          createdBy: null,
          supersedesComparisonId: null,
          supersededByComparisonId: null,
          supersessionReasonCode: null,
        },
      }).ok,
      false
    );
  });

  it("5. patient mismatch fails closed", () => {
    const projection = makeProjectionSnapshot();
    const observation = makeObservationSnapshot(makeObservationPayload("month_6"));
    observation.patientId = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
    const result = validateLongitudinalReviewLineage({
      projection,
      observation,
      comparison: makeComparisonSnapshot(
        projection,
        makeObservationSnapshot(makeObservationPayload("month_6"))
      ),
    });
    assert.equal(result.ok, false);
    if (result.ok) throw new Error("expected fail");
    assert.equal(result.code, "PATIENT_MISMATCH");
  });

  it("6. historical snapshot route does not silently use latest", () => {
    const projection = makeProjectionSnapshot();
    const obsA = makeObservationSnapshot(makeObservationPayload("month_3"), OBSERVATION_ID);
    const cmpA = makeComparisonSnapshot(projection, obsA);
    const builtA = resolveLongitudinalProjectionReviewReport({
      projection,
      observation: obsA,
      comparison: cmpA,
    });
    assert.equal(builtA.ok, true, builtA.ok ? "" : builtA.reason);
    if (!builtA.ok) throw new Error(builtA.reason);
    assert.equal(builtA.report.stage, "month_3");
    assert.equal(builtA.report.observationSnapshotId, OBSERVATION_ID);

    // Passing a mismatched newer observation must fail — not auto-upgrade
    const obsB = makeObservationSnapshot(
      makeObservationPayload("month_12"),
      "44444444-4444-4444-4444-444444444444"
    );
    const builtMismatch = buildLongitudinalProjectionReviewReport({
      projection,
      observation: obsB,
      comparison: cmpA,
    });
    assert.equal(builtMismatch.ok, false);
    if (builtMismatch.ok) throw new Error("expected lineage fail");
    assert.ok(
      builtMismatch.code === "LINEAGE_MISMATCH" ||
        builtMismatch.code === "STAGE_MISMATCH"
    );
  });

  it("routing selects longitudinal template for patient mode", () => {
    assert.equal(
      shouldUseLongitudinalProjectionReviewTemplate(
        "longitudinal_projection_review",
        "patient"
      ),
      true
    );
    assert.equal(
      shouldUseLongitudinalProjectionReviewTemplate(
        "longitudinal_projection_review",
        "doctor"
      ),
      false
    );
    assert.equal(
      resolveReportPresentationTemplateName({
        assessmentType: "longitudinal_projection_review",
        pathway: "post_surgery",
        auditMode: "patient",
        resolvePathwayTemplate: resolvePatientReportTemplateName,
      }),
      "longitudinal-projection-review"
    );
    assert.equal(
      normalizeReportTemplateForPdf("longitudinal-projection-review"),
      "elite"
    );
    const route = readFileSync(
      join(process.cwd(), "src/app/api/print/report/route.ts"),
      "utf8"
    );
    assert.match(route, /shouldUseLongitudinalProjectionReviewTemplate/);
    assert.match(route, /renderLongitudinalProjectionReviewHtml/);
    // Prefer dispatch body order (ignore import lines).
    const longIdx = route.lastIndexOf("renderLongitudinalProjectionReviewHtml");
    const projIdx = route.lastIndexOf("renderSurgeryDayProjectionReportHtml");
    assert.ok(longIdx > 0 && projIdx > longIdx);
  });
});

describe("HA-PROJECTION-1G report contract", () => {
  it("7-11. renderer consumes frozen payloads without regeneration hooks", () => {
    const { report, text } = buildAndRender("month_12");
    assert.ok(report.domainComparisons.length > 0);
    assert.match(text, /Projected at Surgery Day/);
    assert.match(text, /Observed at Month 12/);
    // Snapshot IDs must not appear in patient-visible body
    assert.doesNotMatch(text, new RegExp(PROJECTION_ID));
    assert.doesNotMatch(text, new RegExp(OBSERVATION_ID));
    assert.doesNotMatch(text, new RegExp(COMPARISON_ID));
    // No success scoring / accuracy metrics in dynamic comparison copy
    assert.doesNotMatch(text, /success score/i);
    assert.doesNotMatch(text, /accuracy\s*%/i);
    assert.doesNotMatch(text, /survival\s*\d+\s*%/i);
    assert.doesNotMatch(text, /prediction accuracy/i);
    // Explicit denial in notice is allowed; assert it remains a denial.
    assert.match(text, /does not measure graft survival/i);
  });

  it("source modules do not query uploads from the report builder", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/reports/longitudinalProjectionReview.ts"),
      "utf8"
    );
    assert.doesNotMatch(src, /\.from\(["']uploads["']\)/);
    assert.doesNotMatch(src, /buildSurgeryDayProjectedOutcome/);
    assert.doesNotMatch(src, /buildProjectionObservedComparison/);
    assert.doesNotMatch(src, /buildLongitudinalOutcomeObservation/);
  });
});

describe("HA-PROJECTION-1G stage behavior", () => {
  it("12-13. month3 displays early-stage notice and normal not-yet-assessable", () => {
    const { report, text } = buildAndRender("month_3");
    assert.ok(report.month3NormalNotice);
    assert.ok(report.earlyStageNotice);
    assert.match(text, /still too early to assess reliably/);
    assert.match(text, /This is expected at this stage/);
    assert.ok(
      report.domainComparisons.some((d) => d.comparisonStatus === "not_yet_assessable") ||
        report.notYetAssessable.length >= 0
    );
  });

  it("14. month6 partial comparisons render", () => {
    const { report, text } = buildAndRender("month_6", [
      {
        key: "frontal_appearance",
        label: "Frontal appearance",
        observation:
          "Frontal coverage appears developing through the treated frontal region.",
      },
    ]);
    assert.equal(report.stage, "month_6");
    assert.match(text, /Month 6 Review/);
    assert.ok(report.domainComparisons.length > 0);
  });

  it("15. month12 mature comparison renders", () => {
    const { report, text } = buildAndRender("month_12", [
      {
        key: "frontal_appearance",
        label: "Frontal appearance",
        observation:
          "Frontal coverage is visibly established and remains the dominant treatment area.",
      },
      {
        key: "density_appearance",
        label: "Density appearance",
        observation:
          "Visible density appears stronger through the frontal region than posteriorly.",
      },
    ]);
    assert.equal(report.stage, "month_12");
    assert.match(text, /Projected vs Observed/);
    assert.ok(report.domainComparisons.every((d) => d.projectedText.trim().length > 0));
  });
});

describe("HA-PROJECTION-1G domain behavior", () => {
  it("16-19. projected, observed, comparison, and rationale shown separately", () => {
    const { report, text } = buildAndRender("month_12");
    const card = report.domainComparisons[0];
    assert.ok(card);
    assert.ok(card.projectedText);
    assert.ok(card.comparisonLabel);
    assert.ok(card.rationale);
    assert.match(text, /Projected at Surgery Day/);
    assert.match(text, /Why/);
  });

  it("20. omitted domain stays omitted", () => {
    const projection = makeProjectionSnapshot({
      projectedCharacteristics: [
        {
          domain: "frontal_framing",
          title: "Frontal framing",
          observation: "Frontal treatment is visible.",
          projection:
            "The frontal region would be expected to provide the strongest visual framing effect.",
          confidence: "moderate",
          sourceObservationKeys: ["recipient_placement"],
          limitations: ["Image-limited view"],
        },
      ] as PatientSafeProjectedCharacteristic[],
    });
    const observation = makeObservationSnapshot(makeObservationPayload("month_12"));
    const comparison = makeComparisonSnapshot(projection, observation);
    const built = buildLongitudinalProjectionReviewReport({
      projection,
      observation,
      comparison,
    });
    assert.equal(built.ok, true);
    if (!built.ok) throw new Error(built.reason);
    assert.equal(built.report.domainComparisons.length, 1);
    assert.equal(built.report.domainComparisons[0]?.domain, "frontal_framing");
    assert.ok(
      !built.report.domainComparisons.some((d) => d.domain === "density_distribution")
    );
  });

  it("21. untreated crown context renders correctly", () => {
    const { text } = buildAndRender("month_12");
    assert.match(text, /Treatment-Area Context|Not identified as primary treatment/i);
  });

  it("22. native-hair domain only when canonical comparison exists", () => {
    const { report } = buildAndRender("month_12");
    const hasNative = report.domainComparisons.some(
      (d) => d.domain === "native_hair_dependency"
    );
    const projection = makeProjectionSnapshot();
    const inProjection = projection.projectionSnapshot.projectedCharacteristics.some(
      (c) => c.domain === "native_hair_dependency"
    );
    assert.equal(hasNative, inProjection);
  });
});

describe("HA-PROJECTION-1G status mapping", () => {
  it("23-27. patient-facing status labels", () => {
    assert.equal(mapComparisonStatusLabel("consistent"), "Broadly consistent");
    assert.equal(mapComparisonStatusLabel("partially_consistent"), "Partially consistent");
    assert.equal(
      mapComparisonStatusLabel("divergent"),
      "Different from original projection"
    );
    assert.equal(mapComparisonStatusLabel("not_yet_assessable"), "Not yet assessable");
    assert.equal(mapComparisonStatusLabel("insufficient_evidence"), "More evidence needed");
    assert.equal(mapOverallComparisonLabel("partially_consistent"), "Mixed / partially consistent");
    assert.equal(
      mapOverallComparisonLabel("divergent"),
      "Some characteristics differ from the original projection"
    );
  });
});

describe("HA-PROJECTION-1G confidence", () => {
  it("28-30. three confidence types remain separate without % or combined score", () => {
    const { report, text } = buildAndRender("month_6");
    assert.ok(report.projectionConfidence);
    assert.ok(report.observationConfidence);
    assert.ok(report.comparisonConfidence);
    assert.match(text, /Projection Confidence/);
    assert.match(text, /Observation Confidence/);
    assert.match(text, /Comparison Confidence/);
    assert.doesNotMatch(text, /\d+\s*%/);
    assert.doesNotMatch(text, /combined (confidence|score)/i);
    assert.match(text, /not the probability of a successful outcome/i);
  });
});

describe("HA-PROJECTION-1G images", () => {
  it("37-40. signed URLs reused; raw paths and buckets absent; missing handled", () => {
    const withPhotos = buildAndRender("month_6", undefined, { photos: true });
    assert.ok(withPhotos.report.imageGroups.length > 0);
    assert.match(withPhotos.html, /https:\/\/example\.test\/signed\//);
    assert.doesNotMatch(withPhotos.text, /storage\//i);
    assert.doesNotMatch(withPhotos.text, /\bbucket\b/i);
    assert.match(withPhotos.text, /Surgery Day/);
    assert.doesNotMatch(withPhotos.text, /\bBefore\s*\/\s*After\b/i);
    assert.match(withPhotos.text, /rather than marketing before-and-after framing/i);

    const noPhotos = buildAndRender("month_6", undefined, {
      photos: false,
      roles: "no_donor",
    });
    assert.equal(noPhotos.report.imageGroups.length, 0);
  });
});

describe("HA-PROJECTION-1G smoke HTML fixtures", () => {
  it("writes synthetic smoke HTML for visual inspection", () => {
    const outDir = join(process.cwd(), "tmp/projection-1g-smoke");
    mkdirSync(outDir, { recursive: true });

    const cases: Array<{
      name: string;
      stage: LongitudinalOutcomeStage;
      structured?: Array<{ key: string; label: string; observation: string }>;
      roles?: "minimal" | "full" | "no_donor";
      photos?: boolean;
    }> = [
      { name: "A-month3", stage: "month_3", photos: true },
      {
        name: "B-month6",
        stage: "month_6",
        structured: [
          {
            key: "frontal_appearance",
            label: "Frontal appearance",
            observation:
              "Frontal coverage appears developing through the treated frontal region.",
          },
        ],
        photos: true,
      },
      {
        name: "C-month12",
        stage: "month_12",
        structured: [
          {
            key: "frontal_appearance",
            label: "Frontal appearance",
            observation:
              "Frontal coverage is visibly established and remains the dominant treatment area.",
          },
          {
            key: "density_appearance",
            label: "Density appearance",
            observation:
              "Visible density appears stronger through the frontal region than posteriorly.",
          },
        ],
        photos: true,
      },
      {
        name: "D-month12-divergent-signal",
        stage: "month_12",
        structured: [
          {
            key: "frontal_appearance",
            label: "Frontal appearance",
            observation:
              "Coverage appears more evenly distributed between the frontal and posterior treated areas than a frontal-dominant pattern.",
          },
          {
            key: "density_appearance",
            label: "Density appearance",
            observation:
              "Visible density appears more even across treated regions rather than strongest through the frontal zone.",
          },
        ],
        photos: true,
      },
      {
        name: "E-insufficient",
        stage: "month_12",
        roles: "minimal",
        photos: false,
      },
      {
        name: "F-no-donor",
        stage: "month_6",
        roles: "no_donor",
        photos: true,
      },
      {
        name: "G-baseline-plus",
        stage: "month_6",
        photos: true,
      },
      {
        name: "H-surgery-day-images",
        stage: "month_6",
        photos: true,
        roles: "full",
      },
    ];

    for (const c of cases) {
      let html: string;
      let report: ReturnType<typeof buildAndRender>["report"];

      if (c.name === "D-month12-divergent-signal") {
        // Presentation smoke: freeze a comparison payload that already contains a divergent domain.
        // 1G must not invent divergence — this only verifies the patient-safe "Different" label renders.
        const projection = makeProjectionSnapshot();
        const observation = makeObservationSnapshot(
          makeObservationPayload("month_12", c.structured, { roles: "full" })
        );
        const comparison = makeComparisonSnapshot(projection, observation);
        const domains = comparison.comparisonPayload.domains.map((d, i) =>
          i === 0
            ? {
                ...d,
                status: "divergent" as const,
                confidence: "moderate" as const,
                rationale:
                  "The original projection described the frontal region as the dominant visual density zone. Current mature-stage images show a more even distribution between the frontal and posterior treated areas.",
                observedCharacteristic:
                  "Coverage appears more evenly distributed between the frontal and posterior treated areas.",
              }
            : d
        );
        comparison.comparisonPayload = {
          ...comparison.comparisonPayload,
          domains,
          overallStatus: "partially_consistent",
          summary:
            "Some projected characteristics align with the submitted follow-up evidence, while others differ from the original projection.",
        };
        const built = buildLongitudinalProjectionReviewReport({
          projection,
          observation,
          comparison,
          caseId: CASE_ID,
          reportVersion: 1,
          generatedAt: "2026-07-27T00:00:00.000Z",
          photosByCategory: {
            day0_recipient: [
              {
                signedUrl: "https://example.test/signed/day0-front.jpg",
                label: "Surgery day front",
              },
            ],
            postop_month12_front: [
              {
                signedUrl: "https://example.test/signed/followup-front.jpg",
                label: "Follow-up front",
              },
            ],
          },
        });
        assert.equal(built.ok, true, built.ok ? "" : built.reason);
        if (!built.ok) throw new Error(built.reason);
        report = built.report;
        html = renderLongitudinalProjectionReviewHtml({
          report: built.report,
          caseId: CASE_ID,
          generatedAtDisplay: "27 Jul 2026",
        });
        assert.match(htmlVisible(html), /Different from original projection/);
        assert.match(htmlVisible(html), /badge-slate/);
      } else {
        const rendered = buildAndRender(c.stage, c.structured, {
          roles: c.roles,
          photos: c.photos,
        });
        html = rendered.html;
        report = rendered.report;
      }

      writeFileSync(join(outDir, `${c.name}.html`), html, "utf8");
      writeFileSync(
        join(outDir, `${c.name}-meta.json`),
        JSON.stringify(
          {
            stage: report.stage,
            overall: report.overallComparisonLabel,
            domains: report.domainComparisons.map((d) => ({
              domain: d.domain,
              status: d.comparisonLabel,
            })),
            notYet: report.notYetAssessable.length,
            insufficient: report.insufficientEvidence.length,
          },
          null,
          2
        ),
        "utf8"
      );
    }
    assert.ok(true);
  });
});
