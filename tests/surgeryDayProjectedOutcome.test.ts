/**
 * HA-PROJECTION-1B — Bounded patient-safe projected outcome.
 * Run: pnpm exec tsx --test tests/surgeryDayProjectedOutcome.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSurgeryDayProcedureReconstruction } from "@/lib/projection/surgeryDayProcedureReconstruction";
import { buildSurgeryDayProjectedOutcome } from "@/lib/projection/surgeryDayProjectedOutcome";
import {
  assertPatientSafeProjectionText,
  findUnsafeProjectionClaims,
} from "@/lib/projection/surgeryDayProjectionSafety";
import {
  deriveProjectionConfidence,
  extractProjectionConfidenceFactors,
} from "@/lib/projection/surgeryDayProjectionConfidence";
import type { SurgeryDayProcedureReconstruction } from "@/lib/projection/types";
import {
  isPathwayRequiredUploadComplete,
  requiredPhotoKeys,
} from "@/lib/patient/patientReviewPathway";
import { canSubmit } from "@/lib/auditPhotoSchemas";
import { buildSurgeryDayProcedureReconstruction as build1A } from "@/lib/projection/surgeryDayProcedureReconstruction";

function requireReconstruction(
  input: Parameters<typeof buildSurgeryDayProcedureReconstruction>[0]
): SurgeryDayProcedureReconstruction {
  const result = buildSurgeryDayProcedureReconstruction(input);
  assert.equal(result.ok, true, result.ok ? "" : result.reason);
  if (!result.ok) throw new Error(result.reason);
  return result.reconstruction;
}

function requireProjection(reconstruction: SurgeryDayProcedureReconstruction) {
  const result = buildSurgeryDayProjectedOutcome(reconstruction);
  assert.equal(result.ok, true, result.ok ? "" : result.reason);
  if (!result.ok) throw new Error(result.reason);
  return result.projectedOutcome;
}

const RICH_FORENSIC = {
  section_scores: {
    hairline_design: 82,
    recipient_placement: 75,
    density_distribution: 78,
    naturalness_and_aesthetics: 74,
    donor_management: 72,
    extraction_quality: 70,
  },
  section_score_evidence: {
    hairline_design: [
      "The hairline demonstrates visible irregularity rather than a uniform straight edge.",
    ],
    recipient_placement: [
      "Placement spacing appears relatively even in the frontal field.",
    ],
    density_distribution: [
      "The visible recipient pattern appears denser through the frontal region than posteriorly.",
    ],
    naturalness_and_aesthetics: [
      "Macro transition appears soft and graduated where visible.",
    ],
    donor_management: [
      "Extraction sites appear broadly distributed across the visible donor region.",
    ],
    extraction_quality: [
      "Extraction sites appear evenly spaced in the photographed donor area.",
    ],
  },
};

describe("HA-PROJECTION-1B input contract", () => {
  it("consumes SurgeryDayProcedureReconstruction only (via builder signature)", () => {
    const reconstruction = requireReconstruction({
      uploads: [{ type: "patient_photo:day0_recipient" }],
    });
    const outcome = requireProjection(reconstruction);
    assert.equal(outcome.assessmentType, "surgery_day_projection");
    assert.ok(Array.isArray(outcome.projectedCharacteristics));
  });

  it("does not require raw upload resolver or forensic payload at 1B boundary", () => {
    // Hand-built minimal reconstruction — no uploads / forensic passed to 1B
    const reconstruction: SurgeryDayProcedureReconstruction = {
      assessmentType: "surgery_day_reconstruction",
      evidence: {
        confidence: "moderate",
        presentRoles: ["surgery_day_recipient"],
        limitations: ["Exact recipient density cannot be measured from the submitted photographs."],
      },
      procedureContext: {
        procedureDate: null,
        procedureType: null,
        reportedGraftCount: null,
        actualGraftCount: null,
        estimatedHairCount: null,
        averageHairsPerGraft: null,
        punchSizeMm: null,
        extractionMethod: null,
        implantationMethod: null,
        treatedAreas: ["hairline", "frontal"],
      },
      recipient: {
        observedTreatedAreas: ["hairline", "frontal"],
        hairlineDesign: {
          key: "hairline_design",
          label: "Hairline design (observed)",
          observation:
            "The hairline demonstrates visible irregularity rather than a uniform straight edge.",
          confidence: "high",
          evidenceRoles: ["surgery_day_recipient"],
          source: "forensic_ai",
        },
        recipientPlacement: {
          key: "recipient_placement",
          label: "Recipient placement (observed)",
          observation: "Placement appears concentrated through the frontal region.",
          confidence: "moderate",
          evidenceRoles: ["surgery_day_recipient"],
          source: "forensic_ai",
        },
        densityDistribution: {
          key: "density_distribution",
          label: "Density distribution (qualitative)",
          observation:
            "The visible recipient pattern appears denser through the frontal region than posteriorly.",
          confidence: "moderate",
          evidenceRoles: ["surgery_day_recipient"],
          source: "forensic_ai",
        },
        directionAndAngulation: null,
        symmetryAndTransition: {
          key: "symmetry_and_transition",
          label: "Symmetry and transition (observed)",
          observation: "Macro transition appears soft and graduated where visible.",
          confidence: "moderate",
          evidenceRoles: ["surgery_day_recipient"],
          source: "forensic_ai",
        },
      },
      donor: null,
      baseline: {
        available: false,
        nativeHairPattern: null,
        treatmentRelationship: null,
        limitations: ["No verified preoperative baseline was available."],
      },
      graftEvidence: {
        clinicReportedCount: null,
        imageDerivedEstimate: null,
        source: null,
        provenance: [],
      },
      overallObservations: [],
    };

    const outcome = requireProjection(reconstruction);
    assert.ok(outcome.projectedCharacteristics.some((c) => c.domain === "frontal_framing"));
    assert.ok(outcome.projectedCharacteristics.every((c) => c.sourceObservationKeys.length > 0));
  });
});

describe("HA-PROJECTION-1B domain generation", () => {
  it("frontal observation generates bounded frontal framing projection", () => {
    const reconstruction = requireReconstruction({
      uploads: [{ type: "patient_photo:day0_recipient" }],
      forensicAudit: {
        section_scores: { hairline_design: 82 },
        section_score_evidence: {
          hairline_design: [
            "The hairline demonstrates visible irregularity rather than a uniform straight edge.",
          ],
        },
      },
      procedureSources: { clinicAnswers: { areas_treated: ["hairline", "frontal"] } },
    });
    const outcome = requireProjection(reconstruction);
    const frontal = outcome.projectedCharacteristics.find((c) => c.domain === "frontal_framing");
    assert.ok(frontal);
    assert.ok(frontal!.observation.length > 0);
    assert.ok(/appears designed to|if transplanted growth/i.test(frontal!.projection));
    assert.ok(!/will have a strong natural hairline/i.test(frontal!.projection));
    assert.ok(frontal!.limitations.length > 0);
    assert.ok(frontal!.sourceObservationKeys.includes("hairline_design"));
  });

  it("qualitative density generates qualitative projected density distribution", () => {
    const reconstruction = requireReconstruction({
      uploads: [{ type: "patient_photo:day0_recipient" }],
      forensicAudit: {
        section_scores: { density_distribution: 78 },
        section_score_evidence: {
          density_distribution: [
            "The visible recipient pattern appears denser through the frontal region than posteriorly.",
          ],
        },
      },
    });
    const outcome = requireProjection(reconstruction);
    const dens = outcome.projectedCharacteristics.find((c) => c.domain === "density_distribution");
    assert.ok(dens);
    assert.ok(/frontal/i.test(dens!.observation));
    assert.ok(/if growth progresses normally/i.test(dens!.projection));
    assert.ok(!/\d+\s*(grafts?|fu)\s*\/\s*cm/i.test(dens!.projection));
  });

  it("transition observation generates transition projection", () => {
    const reconstruction = requireReconstruction({
      uploads: [{ type: "patient_photo:day0_recipient" }],
      forensicAudit: {
        section_scores: { naturalness_and_aesthetics: 74, hairline_design: 80 },
        section_score_evidence: {
          naturalness_and_aesthetics: [
            "Macro transition appears soft and graduated where visible.",
          ],
          hairline_design: [
            "The hairline demonstrates visible irregularity rather than a uniform straight edge.",
          ],
        },
      },
    });
    const outcome = requireProjection(reconstruction);
    const tr = outcome.projectedCharacteristics.find(
      (c) => c.domain === "transition_characteristics"
    );
    assert.ok(tr);
    assert.ok(/graduated|softer visual transition|maturation/i.test(tr!.projection));
    assert.ok(!/completely natural/i.test(tr!.projection));
  });

  it("native-hair dependency omitted without baseline", () => {
    const reconstruction = requireReconstruction({
      uploads: [{ type: "patient_photo:day0_recipient" }],
      forensicAudit: RICH_FORENSIC,
      procedureSources: { clinicAnswers: { areas_treated: ["hairline"] } },
    });
    assert.equal(reconstruction.baseline.available, false);
    const outcome = requireProjection(reconstruction);
    assert.equal(outcome.assessmentType, "surgery_day_projection");
    assert.ok(
      !outcome.projectedCharacteristics.some((c) => c.domain === "native_hair_dependency")
    );
  });

  it("native-hair dependency generated with valid baseline", () => {
    const reconstruction = requireReconstruction({
      uploads: [
        { type: "patient_photo:day0_recipient" },
        { type: "clinic_photo:img_preop_front" },
      ],
      evidenceContext: { pathway: "post_surgery" },
      procedureSources: {
        clinicAnswers: { areas_treated: ["hairline", "frontal"] },
      },
      forensicAudit: RICH_FORENSIC,
    });
    assert.equal(reconstruction.baseline.available, true);
    const outcome = requireProjection(reconstruction);
    assert.equal(outcome.assessmentType, "surgery_day_projection_with_baseline");
    const native = outcome.projectedCharacteristics.find(
      (c) => c.domain === "native_hair_dependency"
    );
    assert.ok(native);
    assert.ok(/may therefore remain partly dependent|native hair/i.test(native!.projection));
  });

  it("untreated crown produces bounded untreated-area statement", () => {
    const reconstruction = requireReconstruction({
      uploads: [
        { type: "patient_photo:day0_recipient" },
        { type: "clinic_photo:img_preop_front" },
      ],
      evidenceContext: { pathway: "post_surgery" },
      procedureSources: {
        clinicAnswers: { areas_treated: ["hairline", "frontal"] },
      },
    });
    const outcome = requireProjection(reconstruction);
    const untreated = outcome.projectedCharacteristics.find(
      (c) => c.domain === "untreated_or_lower_treatment_areas"
    );
    assert.ok(untreated);
    assert.ok(/crown/i.test(untreated!.observation));
    assert.ok(/should not be assumed/i.test(untreated!.projection));
    assert.ok(!/will remain bald/i.test(untreated!.projection));
  });
});

describe("HA-PROJECTION-1B safety on builder output", () => {
  it("emits no will-grow / survival% / success probability / fake density", () => {
    const reconstruction = requireReconstruction({
      uploads: [
        { type: "doctor_photo:img_immediate_postop_recipient" },
        { type: "doctor_photo:img_immediate_postop_donor" },
        { type: "doctor_photo:img_marking_design" },
        { type: "doctor_photo:img_preop_front" },
      ],
      forensicAudit: RICH_FORENSIC,
      procedureSources: {
        clinicAnswers: {
          actual_graft_count: 3180,
          areas_treated: ["hairline", "frontal", "midscalp"],
          procedure_type: "FUE",
        },
      },
      graftIntegrity: {
        estimated_implanted_min: 2900,
        estimated_implanted_max: 3300,
        confidence_label: "high",
      },
    });
    const outcome = requireProjection(reconstruction);
    const blob = JSON.stringify(outcome);
    assert.ok(!/\bwill grow\b/i.test(blob));
    assert.ok(!/survival percentage|90%\s*growth|success probability|probability of success/i.test(blob));
    assert.ok(!/\d+\s*(grafts?|fu)\s*\/\s*cm/i.test(blob));
    assert.ok(!/natural result guaranteed|completely natural/i.test(blob));
    assert.ok(/cannot yet be assessed/i.test(outcome.summary ?? ""));
    const check = assertPatientSafeProjectionText([
      outcome.summary,
      ...outcome.assumptions,
      ...outcome.whatCannotYetBeDetermined,
      ...outcome.projectedCharacteristics.flatMap((c) => [
        c.observation,
        c.projection,
        ...c.limitations,
      ]),
    ]);
    assert.equal(check.ok, true, JSON.stringify(check));
  });

  it("observation and projection remain structurally separate", () => {
    const reconstruction = requireReconstruction({
      uploads: [{ type: "patient_photo:day0_recipient" }],
      forensicAudit: RICH_FORENSIC,
      procedureSources: { clinicAnswers: { areas_treated: ["hairline"] } },
    });
    const outcome = requireProjection(reconstruction);
    for (const c of outcome.projectedCharacteristics) {
      assert.ok(c.observation.trim().length > 0);
      assert.ok(c.projection.trim().length > 0);
      assert.notEqual(c.observation, c.projection);
      assert.ok(c.limitations.length > 0);
      assert.ok(c.sourceObservationKeys.length > 0);
    }
  });
});

describe("HA-PROJECTION-1B confidence", () => {
  it("strong reconstruction + valid baseline can reach high projection confidence", () => {
    const reconstruction = requireReconstruction({
      uploads: [
        { type: "doctor_photo:img_immediate_postop_recipient" },
        { type: "doctor_photo:img_immediate_postop_donor" },
        { type: "doctor_photo:img_marking_design" },
        { type: "doctor_photo:img_preop_front" },
        { type: "doctor_photo:img_preop_top" },
      ],
      forensicAudit: RICH_FORENSIC,
      procedureSources: {
        clinicAnswers: {
          actual_graft_count: 3180,
          areas_treated: ["hairline", "frontal", "midscalp"],
          procedure_type: "FUE",
          extraction_method: "FUE",
        },
      },
    });
    assert.equal(reconstruction.assessmentType, "surgery_day_reconstruction_with_baseline");
    const outcome = requireProjection(reconstruction);
    assert.equal(outcome.projectionConfidence, "high");
    assert.ok(
      outcome.reconstructionConfidence === "high" ||
        outcome.reconstructionConfidence === "moderate"
    );
  });

  it("surgery-day recipient only stays low or moderate", () => {
    const reconstruction = requireReconstruction({
      uploads: [{ type: "patient_photo:day0_recipient" }],
      forensicAudit: {
        section_scores: { density_distribution: 70, hairline_design: 70 },
        section_score_evidence: {
          density_distribution: [
            "The visible recipient pattern appears denser through the frontal region than posteriorly.",
          ],
          hairline_design: [
            "The hairline demonstrates visible irregularity rather than a uniform straight edge.",
          ],
        },
      },
    });
    const outcome = requireProjection(reconstruction);
    assert.ok(
      outcome.projectionConfidence === "low" || outcome.projectionConfidence === "moderate"
    );
    assert.notEqual(outcome.projectionConfidence, "high");
  });

  it("conflicting metadata reduces confidence", () => {
    const reconstruction = requireReconstruction({
      uploads: [{ type: "patient_photo:day0_recipient" }],
      forensicAudit: RICH_FORENSIC,
      procedureSources: {
        clinicAnswers: { actual_graft_count: 3180, areas_treated: ["hairline"] },
        patientAnswers: { graft_number_received: 3000 },
      },
    });
    const factors = extractProjectionConfidenceFactors(
      reconstruction,
      requireProjection(reconstruction).projectedCharacteristics.length
    );
    assert.equal(factors.hasConflictingMetadata, true);
    const outcome = requireProjection(reconstruction);
    assert.ok(
      outcome.projectionConfidence === "low" || outcome.projectionConfidence === "moderate"
    );
  });

  it("reconstruction confidence and projection confidence remain distinct fields", () => {
    const reconstruction = requireReconstruction({
      uploads: [
        { type: "doctor_photo:img_immediate_postop_recipient" },
        { type: "doctor_photo:img_immediate_postop_donor" },
        { type: "doctor_photo:img_marking_design" },
        { type: "doctor_photo:img_preop_front" },
      ],
      forensicAudit: RICH_FORENSIC,
      procedureSources: {
        clinicAnswers: {
          actual_graft_count: 3180,
          areas_treated: ["hairline", "frontal"],
          procedure_type: "FUE",
        },
      },
    });
    const outcome = requireProjection(reconstruction);
    assert.ok("reconstructionConfidence" in outcome);
    assert.ok("projectionConfidence" in outcome);
    // Independence: high reconstruction does not force equal projection via shared field
    assert.notEqual(
      Object.is(outcome.reconstructionConfidence, outcome.projectionConfidence) &&
        outcome.reconstructionConfidence === undefined,
      true
    );
    const factors = extractProjectionConfidenceFactors(reconstruction, 4);
    // Mutating reconstruction confidence band in factors can change projection without sharing identity
    const lowFactors = { ...factors, reconstructionConfidence: "low" as const, baselineAvailable: false, baselineProvenanceStrong: false, hasDonor: false, hasDesign: false, hasMultipleSurgeryDayViews: false };
    assert.equal(deriveProjectionConfidence(lowFactors), "low");
  });
});

describe("HA-PROJECTION-1B evidence boundaries", () => {
  it("patient-reported graft count is not treated as clinic-confirmed", () => {
    const reconstruction = requireReconstruction({
      uploads: [{ type: "patient_photo:day0_recipient" }],
      forensicAudit: {
        section_scores: { density_distribution: 70 },
        section_score_evidence: {
          density_distribution: [
            "The visible recipient pattern appears denser through the frontal region than posteriorly.",
          ],
        },
      },
      procedureSources: {
        patientAnswers: { graft_number_received: 2800 },
      },
    });
    assert.ok(
      reconstruction.graftEvidence.provenance.some(
        (p) => p.source === "patient_reported" && p.value === 2800
      )
    );
    assert.ok(
      !reconstruction.graftEvidence.provenance.some((p) => p.source === "clinic_reported")
    );
    const outcome = requireProjection(reconstruction);
    const dens = outcome.projectedCharacteristics.find((c) => c.domain === "density_distribution");
    assert.ok(dens);
    assert.ok(/patient-reported|not treated as clinic-confirmed/i.test(dens!.observation));
    assert.ok(!/Clinic records report/i.test(dens!.observation));
    assert.ok(!/should provide excellent density/i.test(dens!.observation + dens!.projection));
  });

  it("GII estimate remains separate from reported count", () => {
    const reconstruction = requireReconstruction({
      uploads: [{ type: "patient_photo:day0_recipient" }],
      procedureSources: { clinicAnswers: { actual_graft_count: 3180 } },
      graftIntegrity: {
        estimated_implanted_min: 2900,
        estimated_implanted_max: 3300,
        confidence_label: "medium",
      },
      forensicAudit: {
        section_scores: { density_distribution: 70 },
        section_score_evidence: {
          density_distribution: [
            "The visible recipient pattern appears denser through the frontal region than posteriorly.",
          ],
        },
      },
    });
    assert.equal(reconstruction.graftEvidence.clinicReportedCount, 3180);
    assert.deepEqual(reconstruction.graftEvidence.imageDerivedEstimate, {
      min: 2900,
      max: 3300,
      confidence: "moderate",
    });
    const outcome = requireProjection(reconstruction);
    const blob = JSON.stringify(outcome);
    // May mention clinic 3180 as context; must not equate GII range to success
    assert.ok(!/2,?900[\s\S]*excellent density|excellent density[\s\S]*2,?900/i.test(blob));
    assert.ok(!/should provide excellent/i.test(blob));
  });

  it("no baseline → no claimed change from original hairline", () => {
    const reconstruction = requireReconstruction({
      uploads: [{ type: "patient_photo:day0_recipient" }],
      forensicAudit: RICH_FORENSIC,
    });
    const outcome = requireProjection(reconstruction);
    assert.equal(outcome.assessmentType, "surgery_day_projection");
    const blob = JSON.stringify(outcome);
    assert.ok(/No verified preoperative baseline was available/i.test(blob));
    assert.ok(!/amount of hairline lowering|exact recession correction/i.test(blob));
    assert.ok(
      /extent of change from the patient's original hairline cannot be determined/i.test(blob)
    );
  });

  it("donor surgery-day evidence does not generate mature donor outcome claim", () => {
    const reconstruction = requireReconstruction({
      uploads: [
        { type: "patient_photo:day0_recipient" },
        { type: "patient_photo:day0_donor" },
      ],
      forensicAudit: RICH_FORENSIC,
    });
    const outcome = requireProjection(reconstruction);
    const blob = JSON.stringify(outcome);
    assert.ok(/Immediate postoperative donor|mature donor appearance after healing cannot/i.test(blob));
    assert.ok(!/will heal with minimal|minimal visible depletion/i.test(blob));
    assert.ok(findUnsafeProjectionClaims("The donor will heal with minimal visible depletion.").length > 0);
  });
});

describe("HA-PROJECTION-1B regression — 1A / pathway / photo satisfaction", () => {
  it("1A reconstruction builder remains GREEN for surgery-day recipient", () => {
    const result = build1A({
      uploads: [{ type: "patient_photo:day0_recipient" }],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.reconstruction.assessmentType, "surgery_day_reconstruction");
  });

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

  it("PatientReviewPathway remains pre_surgery | post_surgery only", async () => {
    const mod = await import("@/lib/patient/patientReviewPathway");
    assert.ok(typeof mod.isPathwayRequiredUploadComplete === "function");
    // assessment types for projection must not appear as pathway values
    assert.ok(!("surgery_day_projection" in (mod as Record<string, unknown>)));
  });
});
