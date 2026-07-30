/**
 * HA-DONOR-HEALING-1B — orientation mapping, evidence rules, provenance,
 * forbidden diagnostic language, and funnel event contracts.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DONOR_FUNNEL_EVENTS,
  DONOR_HEALING_ORIENTATION_LABELS,
  DONOR_HEALING_ORIENTATION_STATES,
  FORBIDDEN_DONOR_DIAGNOSTIC_PHRASES,
  containsForbiddenDonorDiagnosticLanguage,
  resolveDonorHealingOrientationState,
} from "../src/lib/patient/donorHealingEntry";
import {
  buildAutomatedDonorHealingOrientation,
  confirmDonorHealingOrientation,
  correctDonorHealingOrientation,
  detectDonorPhotoPresence,
  evaluateDonorOrientationEvidence,
  mapDonorHealingOrientationState,
  patientFacingDonorOrientationContainsForbiddenLanguage,
  resolveDonorHealingOrientationForReport,
  toPatientSafeDonorOrientationSlice,
} from "../src/lib/patient/donorHealingOrientationReport";
import { generatePostSurgeryAuditReport } from "../src/lib/reports/postSurgeryAuditReport";

describe("HA-DONOR-HEALING-1B — evidence sufficiency", () => {
  it("detects rear/left/right donor views from upload types", () => {
    const presence = detectDonorPhotoPresence({
      uploadTypes: [
        "patient_photo:preop_donor_rear",
        "patient_photo:preop_donor_left",
        "patient_photo:preop_donor_right",
      ],
    });
    assert.strictEqual(presence.donorViewCount, 3);
    assert.ok(presence.hasDonorRear);
    assert.ok(presence.hasDonorLeft);
    assert.ok(presence.hasDonorRight);
  });

  it("marks single-photograph evidence insufficient for mature stage", () => {
    const evidence = evaluateDonorOrientationEvidence({
      answers: { months_since: "6_9", procedure_date: "2025-01-01" },
      uploadTypes: ["patient_photo:preop_donor_rear"],
    });
    assert.strictEqual(evidence.donorViewCount, 1);
    assert.strictEqual(evidence.sufficient, false);
    assert.ok(evidence.reasons.some((r) => /single-photograph/i.test(r)));
  });

  it("requires timing context from procedure date or months_since", () => {
    const evidence = evaluateDonorOrientationEvidence({
      answers: {},
      uploadTypes: [
        "patient_photo:preop_donor_rear",
        "patient_photo:preop_donor_left",
        "patient_photo:preop_donor_right",
      ],
    });
    assert.strictEqual(evidence.hasTimingContext, false);
    assert.strictEqual(evidence.sufficient, false);
  });
});

describe("HA-DONOR-HEALING-1B — deterministic orientation mapping", () => {
  it("maps all six approved states from controlled inputs", () => {
    assert.strictEqual(
      mapDonorHealingOrientationState({
        evidence: evaluateDonorOrientationEvidence({
          answers: { months_since: "6_9", procedure_date: "2025-01-01" },
          uploadTypes: [
            "patient_photo:preop_donor_rear",
            "patient_photo:preop_donor_left",
            "patient_photo:preop_donor_right",
          ],
        }),
        appearanceTrend: "stable",
      }),
      "compatible_with_reported_stage"
    );

    assert.strictEqual(
      mapDonorHealingOrientationState({
        evidence: evaluateDonorOrientationEvidence({
          answers: { months_since: "under_3", procedure_date: "2026-06-01" },
          uploadTypes: [
            "patient_photo:preop_donor_rear",
            "patient_photo:preop_donor_left",
          ],
        }),
      }),
      "too_early_to_assess_homogeneity"
    );

    assert.strictEqual(
      mapDonorHealingOrientationState({
        evidence: evaluateDonorOrientationEvidence({
          answers: { months_since: "9_12", procedure_date: "2024-01-01" },
          uploadTypes: [
            "patient_photo:preop_donor_rear",
            "patient_photo:preop_donor_left",
            "patient_photo:preop_donor_right",
          ],
        }),
        appearanceTrend: "improving",
      }),
      "temporary_shedding_may_contribute"
    );

    assert.strictEqual(
      mapDonorHealingOrientationState({
        evidence: evaluateDonorOrientationEvidence({
          answers: { months_since: "12_plus", procedure_date: "2023-01-01" },
          uploadTypes: [
            "patient_photo:preop_donor_rear",
            "patient_photo:preop_donor_left",
            "patient_photo:preop_donor_right",
          ],
        }),
        appearanceTrend: "worsening",
      }),
      "persistent_irregularity_deserves_review"
    );

    assert.strictEqual(
      mapDonorHealingOrientationState({
        evidence: evaluateDonorOrientationEvidence({
          answers: { months_since: "6_9" },
          uploadTypes: [
            "patient_photo:preop_donor_rear",
            "patient_photo:preop_donor_left",
            "patient_photo:preop_donor_right",
          ],
        }),
        hasRedFlagSymptoms: true,
      }),
      "direct_clinical_assessment_recommended"
    );

    assert.strictEqual(
      mapDonorHealingOrientationState({
        evidence: evaluateDonorOrientationEvidence({
          answers: { months_since: "6_9" },
          uploadTypes: ["patient_photo:preop_donor_rear"],
        }),
      }),
      "insufficient_evidence"
    );
  });

  it("keeps 1A resolveDonorHealingOrientationState aligned on single-photo rule", () => {
    assert.strictEqual(
      resolveDonorHealingOrientationState({
        monthsSinceBand: "6_9",
        hasDonorRearPhoto: true,
      }),
      "insufficient_evidence"
    );
    assert.strictEqual(
      resolveDonorHealingOrientationState({
        monthsSinceBand: "under_3",
        hasDonorRearPhoto: true,
      }),
      "too_early_to_assess_homogeneity"
    );
  });
});

describe("HA-DONOR-HEALING-1B — provenance confirm/correct", () => {
  it("appends immutable history on confirm and correct", () => {
    const prepared = buildAutomatedDonorHealingOrientation({
      answers: {
        entry_context: "donor_healing",
        primary_donor_concern: "donor_healing",
        months_since: "6_9",
        procedure_date: "2025-01-01",
        donor_appearance_trend: "stable",
      },
      uploadTypes: [
        "patient_photo:preop_donor_rear",
        "patient_photo:preop_donor_left",
        "patient_photo:preop_donor_right",
      ],
    });
    assert.ok(prepared);
    assert.strictEqual(prepared!.provenance.source, "automated_preparation");
    assert.strictEqual(prepared!.provenance.history.length, 1);

    const confirmed = confirmDonorHealingOrientation(prepared!, {
      actorUserId: "auditor-1",
      at: "2026-07-30T00:00:00.000Z",
    });
    assert.strictEqual(confirmed.provenance.source, "clinician_confirmation");
    assert.strictEqual(confirmed.state, prepared!.state);
    assert.strictEqual(confirmed.provenance.history.length, 2);
    assert.strictEqual(confirmed.provenance.confirmedByUserId, "auditor-1");

    const corrected = correctDonorHealingOrientation(confirmed, {
      nextState: "persistent_irregularity_deserves_review",
      actorUserId: "auditor-1",
      at: "2026-07-30T01:00:00.000Z",
    });
    assert.strictEqual(corrected.state, "persistent_irregularity_deserves_review");
    assert.strictEqual(corrected.provenance.source, "clinician_correction");
    assert.strictEqual(corrected.provenance.correctedFrom, confirmed.state);
    assert.strictEqual(corrected.provenance.history.length, 3);
    // Prior automated + confirm events remain.
    assert.strictEqual(corrected.provenance.history[0].source, "automated_preparation");
    assert.strictEqual(corrected.provenance.history[1].source, "clinician_confirmation");
  });

  it("does not overwrite clinician-confirmed orientation on resolve", () => {
    const prepared = buildAutomatedDonorHealingOrientation({
      answers: {
        entry_context: "donor_healing",
        months_since: "6_9",
        procedure_date: "2025-01-01",
      },
      uploadTypes: [
        "patient_photo:preop_donor_rear",
        "patient_photo:preop_donor_left",
        "patient_photo:preop_donor_right",
      ],
    });
    assert.ok(prepared);
    const confirmed = confirmDonorHealingOrientation(prepared!, {
      actorUserId: "auditor-2",
    });
    const resolved = resolveDonorHealingOrientationForReport({
      answers: {
        entry_context: "donor_healing",
        months_since: "under_3",
      },
      uploadTypes: ["patient_photo:preop_donor_rear"],
      stored: confirmed,
    });
    assert.strictEqual(resolved?.state, confirmed.state);
    assert.strictEqual(resolved?.provenance.source, "clinician_confirmation");
  });
});

describe("HA-DONOR-HEALING-1B — prohibited diagnostic outputs never render", () => {
  it("orientation labels never contain forbidden phrases", () => {
    for (const state of DONOR_HEALING_ORIENTATION_STATES) {
      const label = DONOR_HEALING_ORIENTATION_LABELS[state];
      assert.ok(!containsForbiddenDonorDiagnosticLanguage(label), label);
    }
  });

  it("patient-safe slices never contain forbidden diagnostic language", () => {
    const scenarios = [
      {
        answers: {
          entry_context: "donor_healing",
          months_since: "under_3",
          procedure_date: "2026-06-01",
          donor_red_flag_symptoms: ["fever"],
        },
        uploadTypes: [
          "patient_photo:preop_donor_rear",
          "patient_photo:preop_donor_left",
          "patient_photo:preop_donor_right",
        ],
      },
      {
        answers: {
          entry_context: "donor_healing",
          months_since: "6_9",
          procedure_date: "2025-01-01",
          donor_appearance_trend: "worsening",
        },
        uploadTypes: [
          "patient_photo:preop_donor_rear",
          "patient_photo:preop_donor_left",
          "patient_photo:preop_donor_right",
        ],
      },
      {
        answers: {
          entry_context: "donor_healing",
          months_since: "12_plus",
        },
        uploadTypes: ["patient_photo:preop_donor_rear"],
      },
    ];

    for (const scenario of scenarios) {
      const record = buildAutomatedDonorHealingOrientation(scenario);
      assert.ok(record);
      const slice = toPatientSafeDonorOrientationSlice(record!);
      assert.strictEqual(
        patientFacingDonorOrientationContainsForbiddenLanguage(slice),
        false,
        JSON.stringify(slice)
      );
      for (const phrase of FORBIDDEN_DONOR_DIAGNOSTIC_PHRASES) {
        const blob = `${slice.label} ${slice.stageAwareNarrative} ${slice.escalationCopy ?? ""}`.toLowerCase();
        assert.ok(!blob.includes(phrase), `found "${phrase}" in ${blob}`);
      }
    }
  });

  it("post-surgery report donor orientation never emits forbidden phrases", () => {
    const report = generatePostSurgeryAuditReport({
      caseId: "11111111-1111-4111-8111-111111111111",
      patientReviewPathway: "post_surgery",
      uploadTypes: [
        "patient_photo:preop_donor_rear",
        "patient_photo:preop_donor_left",
        "patient_photo:preop_donor_right",
      ],
      summary: {
        entry_context: "donor_healing",
        primary_donor_concern: "donor_healing",
        patient_answers: {
          entry_context: "donor_healing",
          primary_donor_concern: "donor_healing",
          months_since: "6_9",
          procedure_date: "2025-01-01",
          donor_appearance_trend: "improving",
          donor_red_flag_symptoms: ["spreading_redness"],
        },
        forensic_audit: {
          overall_score: 72,
          key_findings: [],
          red_flags: [],
          section_scores: {},
        },
      },
    });

    assert.ok(report.donorHealingOrientation);
    assert.strictEqual(
      report.donorHealingOrientation!.state,
      "direct_clinical_assessment_recommended"
    );
    assert.ok(report.donorHealingOrientation!.escalationCopy);
    assert.strictEqual(
      patientFacingDonorOrientationContainsForbiddenLanguage(report.donorHealingOrientation!),
      false
    );

    const donorSection = report.sections.find((s) => s.id === "donor_area");
    assert.ok(donorSection);
    for (const phrase of FORBIDDEN_DONOR_DIAGNOSTIC_PHRASES) {
      assert.ok(
        !donorSection!.finding.toLowerCase().includes(phrase),
        `donor_area contained forbidden "${phrase}"`
      );
    }
    // Provenance label is patient-safe (no actor id).
    assert.ok(!/auditor-|user-|uuid/i.test(report.donorHealingOrientation!.provenanceLabel));
  });
});

describe("HA-DONOR-HEALING-1B — funnel contracts", () => {
  it("includes submission and report-viewed events for donor_healing funnel", () => {
    assert.ok(DONOR_FUNNEL_EVENTS.includes("donor_case_submitted"));
    assert.ok(DONOR_FUNNEL_EVENTS.includes("donor_report_viewed"));
  });
});
