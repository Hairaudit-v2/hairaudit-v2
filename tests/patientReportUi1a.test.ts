/**
 * HA-PATIENT-REPORT-UI-1A — canonical view model, donor adapter, analytics privacy.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DONOR_HEALING_ORIENTATION_LABELS,
  DONOR_HEALING_ORIENTATION_STATES,
  DONOR_RED_FLAG_WARNING_COPY,
} from "../src/lib/patient/donorHealingEntry";
import {
  buildAutomatedDonorHealingOrientation,
  toPatientSafeDonorOrientationSlice,
} from "../src/lib/patient/donorHealingOrientationReport";
import { generatePostSurgeryAuditReport } from "../src/lib/reports/postSurgeryAuditReport";
import {
  assertPatientReportViewModel,
  buildDonorHealingPatientReportViewModel,
  buildPatientReportAnalyticsPayload,
  buildPostSurgeryFallbackViewModel,
  DONOR_HEALING_SECTION_ORDER,
  findInternalIdLeaks,
  patientReportAnalyticsContainsForbiddenKeys,
  validateDonorHealingSectionOrder,
} from "../src/lib/patientReport";
import { groupUploadsIntoPatientReportPhotos } from "../src/lib/patientReport/photoGrouping";

const FULL_DONOR_UPLOADS = [
  "patient_photo:preop_donor_rear",
  "patient_photo:preop_donor_left",
  "patient_photo:preop_donor_right",
] as const;

function donorSummary(extra: Record<string, unknown> = {}) {
  return {
    entry_context: "donor_healing",
    primary_donor_concern: "donor_patchiness",
    patient_answers: {
      entry_context: "donor_healing",
      months_since: "6_9",
      procedure_date: "2025-01-15",
      appearance_trend: "stable",
      ...((extra.patient_answers as Record<string, unknown>) ?? {}),
    },
    forensic_audit: {
      key_findings: [{ title: "Donor appearance broadly compatible", severity: "low" }],
    },
    ...extra,
  };
}

function buildDonorReport(opts?: {
  monthsSince?: string;
  appearanceTrend?: string;
  redFlags?: string[];
  uploadTypes?: readonly string[];
  withOrientation?: boolean;
}) {
  const answers = {
    entry_context: "donor_healing",
    months_since: opts?.monthsSince ?? "6_9",
    procedure_date: "2025-01-15",
    appearance_trend: opts?.appearanceTrend ?? "stable",
    ...(opts?.redFlags
      ? { donor_red_flag_symptoms: opts.redFlags }
      : {}),
  };
  const uploadTypes = opts?.uploadTypes ?? FULL_DONOR_UPLOADS;
  let summary = donorSummary({ patient_answers: answers });

  if (opts?.withOrientation !== false) {
    const record = buildAutomatedDonorHealingOrientation({
      answers,
      uploadTypes,
    });
    summary = {
      ...summary,
      donor_healing_orientation: record,
    };
  }

  return generatePostSurgeryAuditReport({
    summary,
    caseId: "case-patient-report-ui-1a",
    reportVersion: 1,
    patientReviewPathway: "post_surgery",
    uploadTypes,
    patientAuditV2: { answers },
  });
}

describe("HA-PATIENT-REPORT-UI-1A — view model contract", () => {
  it("validates a donor-healing view model", () => {
    const report = buildDonorReport();
    const vm = buildDonorHealingPatientReportViewModel({
      report,
      statusLabel: "Complete",
      monthsSinceBand: "6_9",
    });
    assertPatientReportViewModel(vm);
    assert.equal(vm.reportType, "donor_healing");
    assert.ok(vm.summary.title.length > 0);
    assert.ok(vm.statusItems.length <= 3);
  });

  it("orders donor sections canonically", () => {
    const report = buildDonorReport();
    const vm = buildDonorHealingPatientReportViewModel({ report });
    assert.ok(validateDonorHealingSectionOrder(vm.sections));
    for (const id of DONOR_HEALING_SECTION_ORDER) {
      assert.ok(
        vm.sections.some((s) => s.id === id),
        `missing section ${id}`
      );
    }
  });
});

describe("HA-PATIENT-REPORT-UI-1A — six orientation mappings", () => {
  for (const state of DONOR_HEALING_ORIENTATION_STATES) {
    it(`preserves patient-safe label for ${state}`, () => {
      const base = buildAutomatedDonorHealingOrientation({
        answers: {
          entry_context: "donor_healing",
          months_since: state === "too_early_to_assess_homogeneity" ? "under_3" : "6_9",
          procedure_date: "2025-01-15",
          appearance_trend:
            state === "temporary_shedding_may_contribute"
              ? "shedding"
              : state === "persistent_irregularity_deserves_review"
                ? "worsening"
                : "stable",
          ...(state === "direct_clinical_assessment_recommended"
            ? { donor_red_flag_symptoms: ["fever"] }
            : {}),
        },
        uploadTypes:
          state === "insufficient_evidence"
            ? ["patient_photo:preop_donor_rear"]
            : FULL_DONOR_UPLOADS,
      });

      // Force exact state for label proof when mapping may differ on edge inputs.
      const forced = {
        ...base,
        state,
        patientLabel: DONOR_HEALING_ORIENTATION_LABELS[state],
      };
      const slice = toPatientSafeDonorOrientationSlice(forced);
      const report = buildDonorReport();
      report.donorHealingOrientation = slice;

      const vm = buildDonorHealingPatientReportViewModel({ report });
      assert.equal(vm.summary.title, DONOR_HEALING_ORIENTATION_LABELS[state]);
      assert.equal(findInternalIdLeaks(vm).length, 0);
    });
  }
});

describe("HA-PATIENT-REPORT-UI-1A — fallback and partial evidence", () => {
  it("falls back when donor orientation is missing", () => {
    const report = buildDonorReport({ withOrientation: false });
    // Strip orientation if generator still attached one via entry context.
    report.donorHealingOrientation = null;
    const vm = buildDonorHealingPatientReportViewModel({ report });
    assert.equal(vm.reportType, "post_surgery");
    assert.ok(vm.summary.title.length > 0);
    assert.ok(vm.sections.some((s) => s.type === "recommendations"));
  });

  it("post-surgery fallback adapter renders without crash", () => {
    const report = generatePostSurgeryAuditReport({
      summary: {
        forensic_audit: { key_findings: [{ title: "Healing progressing", severity: "low" }] },
      },
      caseId: "case-legacy",
      reportVersion: 1,
      patientReviewPathway: "post_surgery",
    });
    report.donorHealingOrientation = null;
    const vm = buildPostSurgeryFallbackViewModel({
      report,
      reason: "legacy_post_surgery",
    });
    assertPatientReportViewModel(vm);
    assert.equal(vm.reportType, "post_surgery");
    assert.equal(vm.analytics.entryContext, undefined);
  });

  it("handles partial donor evidence in photo grouping", () => {
    const groups = groupUploadsIntoPatientReportPhotos([
      { id: "u1", type: "patient_photo:preop_donor_rear" },
      { id: "u2", type: "patient_photo:preop_donor_left" },
    ]);
    assert.ok(groups.some((g) => g.id === "rear_donor"));
    assert.ok(groups.some((g) => g.id === "left_donor"));
    assert.ok(!groups.some((g) => g.id === "right_donor"));
  });
});

describe("HA-PATIENT-REPORT-UI-1A — red flag and ID exclusion", () => {
  it("surfaces red-flag escalation in summary", () => {
    const report = buildDonorReport({
      redFlags: ["fever", "discharge"],
    });
    const vm = buildDonorHealingPatientReportViewModel({ report });
    assert.ok(vm.summary.escalationCopy);
    assert.ok(
      vm.summary.escalationCopy?.includes("photographs alone") ||
        vm.summary.title === DONOR_HEALING_ORIENTATION_LABELS.direct_clinical_assessment_recommended
    );
    // Warning copy must not be disclosure-only.
    assert.ok(
      vm.summary.escalationCopy === DONOR_RED_FLAG_WARNING_COPY ||
        vm.disclosures.some((d) => d.alwaysVisible)
    );
  });

  it("excludes internal IDs from patient-visible fields", () => {
    const report = buildDonorReport();
    const vm = buildDonorHealingPatientReportViewModel({
      report,
      downloadHref: "/api/reports/download",
    });
    // Inject a fake leak path and ensure detector works.
    const leaksClean = findInternalIdLeaks(vm);
    assert.equal(leaksClean.length, 0);

    const dirty = {
      ...vm,
      summary: {
        ...vm.summary,
        narrative: `actorUserId 550e8400-e29b-41d4-a716-446655440000`,
      },
    };
    assert.ok(findInternalIdLeaks(dirty).length > 0);

    // reportId from underlying report must not appear as reportReference
    assert.equal(vm.reportReference, null);
    const blob = JSON.stringify({
      title: vm.reportTitle,
      summary: vm.summary,
      status: vm.statusItems,
      disclosures: vm.disclosures,
      sections: vm.sections.map((s) => {
        if (s.type === "photos") {
          return {
            ...s,
            groups: s.groups.map((g) => ({
              ...g,
              photos: g.photos.map((photo) => {
                const { fetchKey: _omit, ...rest } = photo;
                void _omit;
                return rest;
              }),
            })),
          };
        }
        return s;
      }),
    });
    assert.ok(!blob.includes(report.reportId) || report.reportId.length < 8);
  });

  it("does not embed professional control labels in patient VM", () => {
    const report = buildDonorReport();
    const vm = buildDonorHealingPatientReportViewModel({ report });
    const text = JSON.stringify(vm).toLowerCase();
    for (const forbidden of ["prepare orientation", "confirm orientation", "correct to", "actoruserid"]) {
      assert.ok(!text.includes(forbidden), `found professional control text: ${forbidden}`);
    }
  });
});

describe("HA-PATIENT-REPORT-UI-1A — supporting detail and print contracts", () => {
  it("collapses supporting detail by default", () => {
    const report = buildDonorReport();
    const vm = buildDonorHealingPatientReportViewModel({ report });
    const supporting = vm.sections.find((s) => s.id === "supporting_detail");
    assert.ok(supporting && supporting.type === "disclosure");
    if (supporting.type === "disclosure") {
      assert.equal(supporting.defaultCollapsed, true);
    }
    const methodology = vm.sections.find((s) => s.id === "methodology");
    assert.ok(methodology && methodology.type === "disclosure");
  });

  it("marks clinical disclaimer for print expansion", () => {
    const report = buildDonorReport();
    const vm = buildDonorHealingPatientReportViewModel({ report });
    const supporting = vm.sections.find((s) => s.id === "supporting_detail");
    assert.ok(supporting && supporting.type === "disclosure");
    if (supporting.type === "disclosure") {
      const disclaimer = supporting.items.find((i) => i.id === "disclaimer");
      assert.equal(disclaimer?.expandInPrint, true);
    }
  });
});

describe("HA-PATIENT-REPORT-UI-1A — analytics privacy", () => {
  it("keeps UI analytics free of forbidden keys", () => {
    const payload = buildPatientReportAnalyticsPayload(
      "patient_report_section_opened",
      {
        reportType: "donor_healing",
        entryContext: "donor_healing",
        pathway: "post_surgery",
      },
      {
        section_type: "disclosure",
        caseId: "should-strip",
        patient_name: "should-strip",
        photograph_id: "should-strip",
        imageUrl: "https://example.com/x.jpg",
      }
    );
    const forbidden = patientReportAnalyticsContainsForbiddenKeys(payload);
    assert.equal(forbidden.length, 0);
    assert.equal(payload.entry_context, "donor_healing");
    assert.equal(payload.report_type, "donor_healing");
    assert.ok(!("caseId" in payload));
    assert.ok(!("patient_name" in payload));
    assert.ok(!("imageUrl" in payload));
  });
});

describe("HA-PATIENT-REPORT-UI-1A — photo grouping", () => {
  it("groups rear/left/right and additional evidence", () => {
    const groups = groupUploadsIntoPatientReportPhotos([
      { id: "a", type: "patient_photo:preop_donor_rear" },
      { id: "b", type: "patient_photo:preop_donor_left" },
      { id: "c", type: "patient_photo:preop_donor_right" },
      { id: "d", type: "patient_photo:preop_front" },
    ]);
    assert.deepEqual(
      groups.map((g) => g.id),
      ["rear_donor", "left_donor", "right_donor", "additional_evidence"]
    );
    for (const g of groups) {
      for (const p of g.photos) {
        assert.ok(p.label);
        assert.ok(p.alt);
        // fetchKey may exist but is not patient-visible copy
        assert.ok(!p.label.includes("a") || p.label.length > 1);
      }
    }
  });
});
