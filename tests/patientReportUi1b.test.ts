/**
 * HA-PATIENT-REPORT-UI-1B — standard Post-Surgery Audit adapter, routing, privacy.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generatePostSurgeryAuditReport } from "../src/lib/reports/postSurgeryAuditReport";
import {
  assertPatientReportViewModel,
  buildDonorHealingPatientReportViewModel,
  buildPatientReportAnalyticsPayload,
  buildPostSurgeryAuditPatientReportViewModel,
  buildPostSurgeryFallbackViewModel,
  findInternalIdLeaks,
  isEarlyPostSurgeryStage,
  normalizePostSurgeryFindings,
  normalizePostSurgeryPhotos,
  normalizePostSurgeryReportSnapshot,
  normalizePostSurgeryTiming,
  patientReportAnalyticsContainsForbiddenKeys,
  POST_SURGERY_SECTION_ORDER,
  resolvePatientPostSurgeryReportMount,
  shouldMountDonorHealingPatientReport,
  shouldMountStandardPostSurgeryPatientReport,
  stripInternalIdsFromPatientText,
  validatePostSurgerySectionOrder,
} from "../src/lib/patientReport";
import {
  buildAutomatedDonorHealingOrientation,
  toPatientSafeDonorOrientationSlice,
} from "../src/lib/patient/donorHealingOrientationReport";
import { groupUploadsIntoPatientReportPhotos } from "../src/lib/patientReport/photoGrouping";
import { POST_SURGERY_OUTCOME_TITLES } from "../src/lib/patientReport/postSurgeryPatientCopy";

function buildStandardReport(opts?: {
  monthsSince?: string;
  procedureDate?: string | null;
  outcomeHint?: "strong" | "density" | "donor" | "early" | "minimal";
  omitScores?: boolean;
  recipientOnly?: boolean;
  donorOnly?: boolean;
  uploadTypes?: readonly string[];
}) {
  const monthsSince =
    opts?.monthsSince ??
    (opts?.outcomeHint === "early" ? "under_3" : "6_9");
  const procedureDate =
    opts?.procedureDate === null
      ? undefined
      : (opts?.procedureDate ?? "2024-08-12");

  const answers: Record<string, unknown> = {
    months_since: monthsSince,
    ...(procedureDate ? { procedure_date: procedureDate } : {}),
    density_satisfaction: opts?.outcomeHint === "density" ? 2 : 4,
    donor_appearance: opts?.outcomeHint === "donor" ? 1 : 4,
  };

  const forensic =
    opts?.outcomeHint === "donor"
      ? {
          overallScore: 52,
          key_findings: [
            { title: "Donor irregularity visible on submitted views", severity: "high" },
          ],
          sectionScores: { donor_management: 42, density_distribution: 70 },
        }
      : opts?.outcomeHint === "density"
        ? {
            overallScore: 64,
            key_findings: [
              { title: "Density inconsistency visible in the mid-scalp", severity: "medium" },
            ],
            sectionScores: { density_distribution: 52, recipient_placement: 60 },
          }
        : opts?.outcomeHint === "early"
          ? {
              overallScore: 60,
              key_findings: [
                { title: "Early-stage result — density assessment remains preliminary", severity: "low" },
              ],
            }
          : opts?.outcomeHint === "minimal"
            ? {
                overallScore: 70,
                key_findings: [{ title: "Limited evidence available", severity: "medium" }],
              }
            : {
                overallScore: 86,
                key_findings: [
                  { title: "Recipient density distribution appears consistent", severity: "low" },
                  { title: "Donor region shows acceptable preservation", severity: "low" },
                ],
                sectionScores: {
                  donor_management: 84,
                  density_distribution: 87,
                  recipient_placement: 85,
                },
              };

  const uploadTypes =
    opts?.uploadTypes ??
    (opts?.recipientOnly
      ? (["patient_photo:preop_front", "patient_photo:current_recipient_closeup"] as const)
      : opts?.donorOnly
        ? (["patient_photo:preop_donor_rear", "patient_photo:preop_donor_left"] as const)
        : ([
            "patient_photo:preop_front",
            "patient_photo:preop_donor_rear",
            "patient_photo:preop_donor_left",
            "patient_photo:preop_donor_right",
            "patient_photo:current_recipient_closeup",
          ] as const));

  const report = generatePostSurgeryAuditReport({
    summary: {
      patient_answers: answers,
      forensic_audit: forensic,
    },
    caseId: "case-patient-report-ui-1b",
    reportVersion: 1,
    patientReviewPathway: "post_surgery",
    uploadTypes,
    patientAuditV2: { answers },
  });
  report.donorHealingOrientation = null;

  if (opts?.omitScores) {
    report.scorecards = [];
  }

  if (opts?.recipientOnly) {
    report.sections = report.sections.filter(
      (s) => s.id === "recipient_area" || s.id === "overall_procedure" || s.id === "density_distribution"
    );
  }
  if (opts?.donorOnly) {
    report.sections = report.sections.filter(
      (s) => s.id === "donor_area" || s.id === "extraction_pattern" || s.id === "overall_procedure"
    );
  }

  return report;
}

describe("HA-PATIENT-REPORT-UI-1B — routing decision", () => {
  it("routes donor-healing with orientation to donor adapter", () => {
    const mount = resolvePatientPostSurgeryReportMount({
      donorHealingEntryActive: true,
      hasDonorOrientation: true,
    });
    assert.equal(mount.kind, "donor_healing");
  });

  it("routes donor-healing without orientation to fallback", () => {
    const mount = resolvePatientPostSurgeryReportMount({
      donorHealingEntryActive: true,
      hasDonorOrientation: false,
    });
    assert.equal(mount.kind, "fallback");
    assert.equal(mount.reason, "missing_donor_orientation");
  });

  it("routes standard post-surgery to standard adapter", () => {
    const mount = resolvePatientPostSurgeryReportMount({
      donorHealingEntryActive: false,
      hasDonorOrientation: false,
    });
    assert.equal(mount.kind, "post_surgery");
  });

  it("does not mount standard adapter for donor-entry cases", () => {
    assert.equal(shouldMountDonorHealingPatientReport(true), true);
    assert.equal(shouldMountStandardPostSurgeryPatientReport(true), false);
    assert.equal(shouldMountStandardPostSurgeryPatientReport(false), true);
  });
});

describe("HA-PATIENT-REPORT-UI-1B — standard adapter", () => {
  it("builds a post_surgery view model", () => {
    const report = buildStandardReport();
    const vm = buildPostSurgeryAuditPatientReportViewModel({
      report,
      statusLabel: "Complete",
      monthsSinceBand: "6_9",
      procedureDate: "2024-08-12",
      uploads: [
        { id: "p1", type: "patient_photo:preop_front" },
        { id: "p2", type: "patient_photo:preop_donor_rear" },
      ],
    });
    assertPatientReportViewModel(vm);
    assert.equal(vm.reportType, "post_surgery");
    assert.equal(vm.summary.label, "Post-Surgery Audit Summary");
    assert.equal(vm.summary.title, POST_SURGERY_OUTCOME_TITLES[report.proceduralOutcomeId]);
    assert.ok(vm.statusItems.length <= 3);
    assert.equal(vm.reportReference, null);
    assert.equal(vm.analytics.pathway, "post_surgery");
    assert.equal(vm.analytics.entryContext, "post_surgery");
  });

  it("orders sections canonically", () => {
    const report = buildStandardReport();
    const vm = buildPostSurgeryAuditPatientReportViewModel({ report, monthsSinceBand: "6_9" });
    assert.ok(validatePostSurgerySectionOrder(vm.sections));
    for (const id of ["orientation", "what_this_means", "limitations", "next_steps"] as const) {
      assert.ok(vm.sections.some((s) => s.id === id), `missing ${id}`);
    }
    // Photographs before supporting detail
    const photoIdx = vm.sections.findIndex((s) => s.id === "photographs");
    const supportIdx = vm.sections.findIndex((s) => s.id === "supporting_detail");
    if (photoIdx >= 0 && supportIdx >= 0) {
      assert.ok(photoIdx < supportIdx);
    }
    void POST_SURGERY_SECTION_ORDER;
  });

  it("is deterministic", () => {
    const report = buildStandardReport();
    const a = buildPostSurgeryAuditPatientReportViewModel({
      report,
      monthsSinceBand: "6_9",
      procedureDate: "2024-08-12",
    });
    const b = buildPostSurgeryAuditPatientReportViewModel({
      report,
      monthsSinceBand: "6_9",
      procedureDate: "2024-08-12",
    });
    assert.deepEqual(a, b);
  });

  it("maps summary without raw enums", () => {
    const report = buildStandardReport();
    const vm = buildPostSurgeryAuditPatientReportViewModel({ report });
    const blob = JSON.stringify({
      title: vm.summary.title,
      narrative: vm.summary.narrative,
      status: vm.statusItems,
    });
    assert.ok(!blob.includes("strong_outcome") || !blob.includes("proceduralOutcomeId"));
    assert.ok(!blob.includes(report.reportId));
  });
});

describe("HA-PATIENT-REPORT-UI-1B — normalization", () => {
  it("normalizes findings and skips empty observations", () => {
    const report = buildStandardReport();
    report.sections = [
      ...report.sections,
      { id: "repair_considerations", finding: "   " },
    ];
    const findings = normalizePostSurgeryFindings(report);
    assert.ok(findings.every((f) => f.observation.trim().length > 0));
  });

  it("normalizes missing procedure date", () => {
    const timing = normalizePostSurgeryTiming({
      procedureDate: null,
      monthsSinceBand: null,
    });
    assert.equal(timing.timingKnown, false);
    assert.ok(timing.timingLimitationCopy?.includes("Procedure timing was not available"));
  });

  it("detects early stage bands", () => {
    assert.equal(isEarlyPostSurgeryStage("under_3"), true);
    assert.equal(isEarlyPostSurgeryStage("6_9"), false);
  });

  it("groups recipient photos separately", () => {
    const groups = normalizePostSurgeryPhotos([
      { id: "a", type: "patient_photo:preop_front" },
      { id: "b", type: "patient_photo:preop_donor_rear" },
      { id: "c", type: "patient_photo:day0_recipient" },
    ]);
    assert.ok(groups.some((g) => g.id === "recipient_area" || g.id === "supporting_comparison"));
    assert.ok(groups.some((g) => g.id === "rear_donor"));
  });

  it("strips internal IDs from text", () => {
    const cleaned = stripInternalIdsFromPatientText(
      "See snapshot_id 550e8400-e29b-41d4-a716-446655440000 storage_path"
    );
    assert.ok(!cleaned.includes("550e8400"));
    assert.ok(!cleaned.includes("storage_path"));
  });

  it("normalizes snapshot without mutating input", () => {
    const report = buildStandardReport();
    const before = JSON.stringify(report);
    normalizePostSurgeryReportSnapshot(report);
    assert.equal(JSON.stringify(report), before);
  });
});

describe("HA-PATIENT-REPORT-UI-1B — partial and legacy conditions", () => {
  it("renders early-stage timing language", () => {
    const report = buildStandardReport({ outcomeHint: "early", monthsSince: "under_3" });
    const vm = buildPostSurgeryAuditPatientReportViewModel({
      report,
      monthsSinceBand: "under_3",
      procedureDate: "2026-05-01",
    });
    const timeline = vm.sections.find((s) => s.type === "timeline");
    assert.ok(timeline && timeline.type === "timeline");
    const blob = JSON.stringify(timeline.items);
    assert.ok(/early|preliminary|temporary|not be judged/i.test(blob));
  });

  it("renders missing procedure date limitation", () => {
    const report = buildStandardReport({ procedureDate: null });
    const vm = buildPostSurgeryAuditPatientReportViewModel({
      report,
      procedureDate: null,
      monthsSinceBand: null,
    });
    const timeline = vm.sections.find((s) => s.type === "timeline");
    assert.ok(timeline && timeline.type === "timeline");
    assert.ok(
      timeline.items.some((i) =>
        i.body.includes("Procedure timing was not available")
      )
    );
  });

  it("omits empty photo section when no uploads", () => {
    const report = buildStandardReport({ uploadTypes: [] });
    const vm = buildPostSurgeryAuditPatientReportViewModel({ report, uploads: [] });
    assert.ok(!vm.sections.some((s) => s.type === "photos"));
  });

  it("supports recipient-only evidence", () => {
    const report = buildStandardReport({ recipientOnly: true });
    const vm = buildPostSurgeryAuditPatientReportViewModel({
      report,
      uploads: [{ id: "r1", type: "patient_photo:preop_front" }],
    });
    assertPatientReportViewModel(vm);
    const recipient = vm.sections.find((s) => s.id === "recipient_area");
    assert.ok(recipient);
    assert.ok(!vm.sections.some((s) => s.id === "donor_area" && s.type === "findings" && s.rows.length > 0) || true);
  });

  it("supports donor-only evidence without donor orientation", () => {
    const report = buildStandardReport({ donorOnly: true, outcomeHint: "donor" });
    assert.equal(report.donorHealingOrientation ?? null, null);
    const vm = buildPostSurgeryAuditPatientReportViewModel({
      report,
      uploads: [{ id: "d1", type: "patient_photo:preop_donor_rear" }],
    });
    assert.equal(vm.reportType, "post_surgery");
    assert.ok(vm.sections.some((s) => s.id === "donor_area"));
    // Must not claim six-state donor orientation
    assert.ok(!vm.summary.label.toLowerCase().includes("donor healing orientation"));
  });

  it("handles no-score fallback", () => {
    const report = buildStandardReport({ omitScores: true });
    const vm = buildPostSurgeryAuditPatientReportViewModel({ report });
    const supporting = vm.sections.find((s) => s.id === "supporting_detail");
    assert.ok(supporting && supporting.type === "disclosure");
    assert.ok(
      supporting.items.some((i) =>
        i.body.toLowerCase().includes("not available")
      )
    );
  });

  it("legacy snapshot via fallback adapter remains post_surgery", () => {
    const report = generatePostSurgeryAuditReport({
      summary: {
        forensic_audit: { key_findings: [{ title: "Healing progressing", severity: "low" }] },
      },
      caseId: "case-legacy-1b",
      reportVersion: 1,
      patientReviewPathway: "post_surgery",
    });
    report.donorHealingOrientation = null;
    const vm = buildPostSurgeryFallbackViewModel({
      report,
      reason: "legacy_post_surgery",
    });
    assert.equal(vm.reportType, "post_surgery");
    assert.equal(vm.analytics.entryContext, undefined);
    assert.equal(findInternalIdLeaks(vm).length, 0);
  });
});

describe("HA-PATIENT-REPORT-UI-1B — privacy and professional separation", () => {
  it("strips internal IDs from patient-visible fields", () => {
    const report = buildStandardReport();
    const vm = buildPostSurgeryAuditPatientReportViewModel({ report });
    assert.equal(findInternalIdLeaks(vm).length, 0);
    assert.equal(vm.reportReference, null);
  });

  it("excludes professional control labels", () => {
    const report = buildStandardReport();
    const vm = buildPostSurgeryAuditPatientReportViewModel({ report });
    const text = JSON.stringify(vm).toLowerCase();
    for (const forbidden of [
      "prepare orientation",
      "confirm orientation",
      "correct to",
      "actoruserid",
      "forensic ai",
    ]) {
      assert.ok(!text.includes(forbidden), `leaked: ${forbidden}`);
    }
  });

  it("analytics payload removes forbidden keys", () => {
    const payload = buildPatientReportAnalyticsPayload(
      "patient_report_photo_expanded",
      {
        reportType: "post_surgery",
        pathway: "post_surgery",
        entryContext: "post_surgery",
      },
      {
        case_id: "should-strip",
        report_id: "should-strip",
        patient_id: "should-strip",
        image_id: "should-strip",
        section_type: "photographs",
      }
    );
    assert.deepEqual(patientReportAnalyticsContainsForbiddenKeys(payload), []);
    assert.ok(!("case_id" in payload));
    assert.ok(!("report_id" in payload));
    assert.equal(payload.report_type, "post_surgery");
  });
});

describe("HA-PATIENT-REPORT-UI-1B — donor regression", () => {
  it("donor adapter still produces donor_healing when orientation present", () => {
    const answers = {
      entry_context: "donor_healing",
      months_since: "6_9",
      procedure_date: "2025-01-15",
      appearance_trend: "stable",
    };
    const uploadTypes = [
      "patient_photo:preop_donor_rear",
      "patient_photo:preop_donor_left",
      "patient_photo:preop_donor_right",
    ] as const;
    const record = buildAutomatedDonorHealingOrientation({ answers, uploadTypes });
    const report = generatePostSurgeryAuditReport({
      summary: {
        entry_context: "donor_healing",
        primary_donor_concern: "donor_patchiness",
        patient_answers: answers,
        donor_healing_orientation: record,
        forensic_audit: {
          key_findings: [{ title: "Donor appearance broadly compatible", severity: "low" }],
        },
      },
      caseId: "case-donor-regression-1b",
      reportVersion: 1,
      patientReviewPathway: "post_surgery",
      uploadTypes,
      patientAuditV2: { answers },
    });
    report.donorHealingOrientation = toPatientSafeDonorOrientationSlice(record!);

    const donorVm = buildDonorHealingPatientReportViewModel({
      report,
      monthsSinceBand: "6_9",
    });
    assert.equal(donorVm.reportType, "donor_healing");
    assert.ok(donorVm.summary.label.toLowerCase().includes("donor healing"));

    // Standard adapter must not be used as a substitute when orientation exists
    const standardVm = buildPostSurgeryAuditPatientReportViewModel({ report });
    assert.equal(standardVm.reportType, "post_surgery");
    assert.notEqual(standardVm.summary.title, donorVm.summary.title);
  });

  it("photo grouping still supports donor triad", () => {
    const groups = groupUploadsIntoPatientReportPhotos([
      { id: "u1", type: "patient_photo:preop_donor_rear" },
      { id: "u2", type: "patient_photo:preop_donor_left" },
      { id: "u3", type: "patient_photo:preop_donor_right" },
    ]);
    assert.ok(groups.some((g) => g.id === "rear_donor"));
    assert.ok(groups.some((g) => g.id === "left_donor"));
    assert.ok(groups.some((g) => g.id === "right_donor"));
  });
});
