/**
 * HA-PROJECTION-1A — Canonical reconstruction builder, metadata, observations, safety.
 * Run: pnpm exec tsx --test tests/surgeryDayProcedureReconstruction.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSurgeryDayProcedureReconstruction } from "@/lib/projection/surgeryDayProcedureReconstruction";
import {
  assertNoFutureResultClaims,
  findFutureResultClaims,
  sanitizeObservedText,
} from "@/lib/projection/surgeryDayReconstructionSafety";
import { normalizeRecipientZone } from "@/lib/projection/surgeryDayZones";
import { resolveSurgeryDayProcedureContext } from "@/lib/projection/surgeryDayProcedureContext";
import {
  isPathwayRequiredUploadComplete,
  requiredPhotoKeys,
} from "@/lib/patient/patientReviewPathway";
import { canSubmit } from "@/lib/auditPhotoSchemas";

describe("HA-PROJECTION-1A metadata precedence", () => {
  it("clinic actual graft count beats patient-reported count", () => {
    const ctx = resolveSurgeryDayProcedureContext({
      clinicAnswers: { actual_graft_count: 3180 },
      patientAnswers: { graft_number_received: 3000 },
    });
    assert.equal(ctx.actualGraftCount, 3180);
    assert.ok(ctx.graftProvenance.some((p) => p.source === "clinic_reported" && p.value === 3180));
    assert.ok(ctx.graftProvenance.some((p) => p.source === "patient_reported" && p.value === 3000));
  });

  it("conflicting graft counts are retained as limitations (not averaged)", () => {
    const ctx = resolveSurgeryDayProcedureContext({
      clinicAnswers: { actual_graft_count: 3180 },
      patientAnswers: { graft_number_received: 3000 },
    });
    assert.ok(ctx.limitations.some((l) => /3,180/.test(l) && /3,000/.test(l)));
    assert.equal(ctx.actualGraftCount, 3180);
    assert.notEqual(ctx.actualGraftCount, Math.round((3180 + 3000) / 2));
  });

  it("reported and AI-estimated graft counts remain distinct in reconstruction", () => {
    const result = buildSurgeryDayProcedureReconstruction({
      uploads: [{ type: "patient_photo:day0_recipient" }],
      procedureSources: {
        clinicAnswers: { actual_graft_count: 3180 },
      },
      graftIntegrity: {
        estimated_implanted_min: 2900,
        estimated_implanted_max: 3300,
        confidence_label: "medium",
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.reconstruction.graftEvidence.clinicReportedCount, 3180);
    assert.deepEqual(result.reconstruction.graftEvidence.imageDerivedEstimate, {
      min: 2900,
      max: 3300,
      confidence: "moderate",
    });
    assert.equal(result.reconstruction.graftEvidence.source, "mixed");
  });

  it("does not invent GII estimate when GII path absent", () => {
    const result = buildSurgeryDayProcedureReconstruction({
      uploads: [{ type: "clinic_photo:img_immediate_postop_recipient" }],
      procedureSources: { clinicAnswers: { actual_graft_count: 2000 } },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.reconstruction.graftEvidence.imageDerivedEstimate, null);
  });
});

describe("HA-PROJECTION-1A observations", () => {
  it("hairline forensic finding becomes observed feature", () => {
    const result = buildSurgeryDayProcedureReconstruction({
      uploads: [
        { type: "patient_photo:day0_recipient" },
        { type: "doctor_photo:img_marking_design" },
      ],
      forensicAudit: {
        section_scores: { hairline_design: 82 },
        section_score_evidence: {
          hairline_design: [
            "The hairline demonstrates visible irregularity rather than a uniform straight edge.",
          ],
        },
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const hl = result.reconstruction.recipient.hairlineDesign;
    assert.ok(hl);
    assert.match(hl!.observation, /irregularity/i);
    assert.equal(hl!.source, "forensic_ai");
    assert.ok(!/will look|expected result|survival/i.test(hl!.observation));
  });

  it("density score does not become numeric graft density", () => {
    const result = buildSurgeryDayProcedureReconstruction({
      uploads: [{ type: "surgery_photo:postop_recipient" }],
      forensicAudit: {
        section_scores: { density_distribution: 78 },
        section_score_evidence: {
          density_distribution: [
            "The visible recipient pattern appears denser through the frontal region than posteriorly.",
          ],
        },
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const d = result.reconstruction.recipient.densityDistribution;
    assert.ok(d);
    assert.ok(!/\d+\s*(grafts?|fu)\s*\/\s*cm/i.test(d!.observation));
    assert.ok(
      result.reconstruction.evidence.limitations.some((l) =>
        /Exact recipient density cannot be measured/i.test(l)
      )
    );
  });

  it("donor finding remains observed, not long-term conclusion", () => {
    const result = buildSurgeryDayProcedureReconstruction({
      uploads: [
        { type: "patient_photo:day0_recipient" },
        { type: "patient_photo:day0_donor" },
      ],
      forensicAudit: {
        section_scores: { donor_management: 48, extraction_quality: 50 },
        section_score_evidence: {
          donor_management: ["Visible clustering of extraction sites in the central donor."],
          extraction_quality: ["Extraction sites appear unevenly spaced in the photographed area."],
        },
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.reconstruction.donor);
    const text = [
      result.reconstruction.donor!.extractionPattern?.observation,
      result.reconstruction.donor!.extractionDistribution?.observation,
      ...result.reconstruction.donor!.visibleConcerns.map((c) => c.observation),
    ].join(" ");
    assert.ok(!/permanent overharvest/i.test(text));
    assert.ok(!/final donor depletion/i.test(text));
    assert.ok(/not assessed at this stage/i.test(text));
  });

  it("baseline comparison is observational, not predictive", () => {
    const result = buildSurgeryDayProcedureReconstruction({
      uploads: [
        { type: "patient_photo:day0_recipient" },
        { type: "clinic_photo:img_preop_front" },
      ],
      evidenceContext: { pathway: "post_surgery" },
      procedureSources: {
        clinicAnswers: { areas_treated: ["hairline", "midscalp"] },
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.reconstruction.assessmentType, "surgery_day_reconstruction_with_baseline");
    assert.equal(result.reconstruction.baseline.available, true);
    const rel = result.reconstruction.baseline.treatmentRelationship?.observation ?? "";
    assert.ok(/observed comparison|Native hair/i.test(rel));
    assert.ok(!/final result will|will depend on retention/i.test(rel));
  });
});

describe("HA-PROJECTION-1A safety / no-future-result guard", () => {
  it("detects forbidden future-result claims", () => {
    const hits = findFutureResultClaims("This will produce excellent frontal density.");
    assert.ok(hits.length > 0);
  });

  it("allows cannot-yet-assess final density phrasing", () => {
    const hits = findFutureResultClaims("Final density cannot yet be determined.");
    assert.equal(hits.length, 0);
  });

  it("sanitizeObservedText strips prediction language", () => {
    const safe = sanitizeObservedText("Grafts will grow into an excellent outcome.");
    assert.ok(safe == null || !/will grow|excellent outcome/i.test(safe));
  });

  it("reconstruction emits no future-result claim", () => {
    const result = buildSurgeryDayProcedureReconstruction({
      uploads: [
        { type: "doctor_photo:img_immediate_postop_recipient" },
        { type: "doctor_photo:img_immediate_postop_donor" },
        { type: "doctor_photo:img_marking_design" },
        { type: "doctor_photo:img_preop_front" },
      ],
      forensicAudit: {
        section_scores: {
          hairline_design: 80,
          recipient_placement: 75,
          density_distribution: 70,
          donor_management: 72,
          naturalness_and_aesthetics: 74,
        },
        section_score_evidence: {
          hairline_design: ["Visible micro-irregularity along the frontal contour."],
          recipient_placement: ["Placement spacing appears relatively even in the frontal field."],
          density_distribution: ["Frontal region appears denser than the posterior recipient field."],
          donor_management: ["Extraction sites appear broadly distributed across the donor."],
          naturalness_and_aesthetics: ["Macro transition appears soft where visible."],
        },
        key_findings: [
          {
            title: "Frontal concentration",
            impact: "Transplantation appears concentrated through the frontal region in available images.",
          },
        ],
      },
      graftIntegrity: {
        estimated_implanted_min: 2800,
        estimated_implanted_max: 3200,
        confidence_label: "high",
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const texts: string[] = [
      ...result.reconstruction.evidence.limitations,
      result.reconstruction.recipient.hairlineDesign?.observation ?? "",
      result.reconstruction.recipient.densityDistribution?.observation ?? "",
      ...result.reconstruction.overallObservations.map((o) => o.observation),
    ];
    const check = assertNoFutureResultClaims(texts);
    assert.equal(check.ok, true, JSON.stringify(check));
  });

  it("no graft-survival prediction and no fake geometry", () => {
    const result = buildSurgeryDayProcedureReconstruction({
      uploads: [{ type: "patient_photo:day0_recipient" }],
      forensicAudit: {
        section_scores: { graft_handling_and_viability: 90 },
        section_score_evidence: {
          graft_handling_and_viability: ["Holding solution appears adequate in tray photos."],
        },
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const blob = JSON.stringify(result.reconstruction);
    assert.ok(!/survival rate|graft survival|sites\/cm|cm² measured|exact hairline angle/i.test(blob));
    assert.ok(
      result.reconstruction.evidence.limitations.some((l) => /implantation-site counting/i.test(l))
    );
  });
});

describe("HA-PROJECTION-1A zones", () => {
  it("normalizes clinical and clinic zone vocabularies", () => {
    assert.equal(normalizeRecipientZone("frontal_hairline"), "hairline");
    assert.equal(normalizeRecipientZone("midscalp"), "mid_scalp");
    assert.equal(normalizeRecipientZone("mid_scalp"), "mid_scalp");
    assert.equal(normalizeRecipientZone("crown"), "crown");
  });
});

describe("HA-PROJECTION-1A assessment types & insufficiency", () => {
  it("surgery_day_only assessment type", () => {
    const result = buildSurgeryDayProcedureReconstruction({
      uploads: [{ type: "patient_photo:day0_recipient" }],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.reconstruction.assessmentType, "surgery_day_reconstruction");
  });

  it("insufficient without recipient", () => {
    const result = buildSurgeryDayProcedureReconstruction({
      uploads: [{ type: "clinic_photo:img_preop_front" }],
    });
    assert.equal(result.ok, false);
    assert.equal(result.insufficient, true);
  });
});

describe("HA-PROJECTION-1A regression — pathway behaviour unchanged", () => {
  it("post_surgery required photo keys unchanged", () => {
    assert.ok(requiredPhotoKeys.post_surgery.includes("preop_front"));
    assert.ok(requiredPhotoKeys.post_surgery.includes("current_recipient_closeup"));
  });

  it("pathway satisfaction still passes with classic five uploads", () => {
    const five = [
      { type: "patient_photo:preop_front" },
      { type: "patient_photo:current_recipient_closeup" },
      { type: "patient_photo:preop_top" },
      { type: "patient_photo:preop_donor_rear" },
      { type: "patient_photo:preop_donor_closeup" },
    ];
    assert.equal(isPathwayRequiredUploadComplete("post_surgery", five), true);
    assert.equal(canSubmit("patient", five, "post_surgery"), true);
  });
});
