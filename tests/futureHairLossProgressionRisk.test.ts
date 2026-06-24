import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildFutureHairLossProgressionRisk,
  buildFutureHairLossProgressionRiskLabelsEn,
  isFutureHairLossRiskResult,
  renderFutureHairLossProgressionRiskHtml,
  resolvePatientAgeForRisk,
  type FutureHairLossProgressionRiskInput,
} from "../src/lib/reports/futureHairLossProgressionRisk";
import type { HairAuditIntelligenceBundle } from "../src/lib/hairaudit-intelligence/types";
import { generatePostSurgeryAuditReport } from "../src/lib/reports/postSurgeryAuditReport";
import { renderPostSurgeryAuditReportHtml } from "../src/lib/reports/PostSurgeryAuditReportHtml";
import { buildPostSurgeryReportHtmlLabelsEn, buildPostSurgeryClinicalEvidenceGalleryLabelsEn } from "../src/lib/reports/postSurgeryReportLabels";

const caseId = "00000000-0000-4000-8000-0000000000aa";

function baseBundle(
  overrides: Partial<HairAuditIntelligenceBundle> = {}
): HairAuditIntelligenceBundle {
  return {
    engineVersion: "hairaudit.intelligence.v1",
    hairLossClassification: {
      engineId: "hair_loss_classification",
      engineVersion: "hairaudit.intelligence.v1",
      classification: "pattern_review",
      fields: {
        norwoodStage: "II",
        crownProgression: "none_observed",
        diffuseThinningPattern: "none_suggested",
        evidenceLimitations: [],
      },
      severity: "minor",
      confidence: "moderate",
      evidenceUsed: [],
      patientSafeSummary: "Pattern appears early.",
      clinicianNotes: "Early pattern.",
      suggestedNextStep: "Monitor.",
      limitations: [],
      advisoryOnly: true,
      executionMode: "rule_based_placeholder",
      generatedAt: new Date().toISOString(),
    },
    donorIntelligence: {
      engineId: "donor_intelligence",
      engineVersion: "hairaudit.intelligence.v1",
      classification: "donor_review",
      fields: {
        donorDensityBand: "appears_adequate",
        miniaturisationSuspicion: "none_suggested",
        retrogradeAlopeciaPattern: "none_suggested",
        extractionSafetyZoneConcerns: "none_noted",
        donorReserveRisk: "low",
      },
      severity: "none",
      confidence: "moderate",
      evidenceUsed: [],
      patientSafeSummary: "Donor appears adequate.",
      clinicianNotes: "Adequate donor.",
      suggestedNextStep: "Continue monitoring.",
      limitations: [],
      advisoryOnly: true,
      executionMode: "rule_based_placeholder",
      generatedAt: new Date().toISOString(),
    },
    overallConfidence: "moderate",
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function buildInput(
  overrides: Partial<FutureHairLossProgressionRiskInput> = {}
): FutureHairLossProgressionRiskInput {
  return {
    pathway: "post_surgery",
    intelligenceBundle: baseBundle(),
    patientAge: 52,
    clinicalHistory: {
      priorSurgeryCount: null,
      priorProcedureType: null,
      priorSurgeryDate: null,
      priorSurgeryTimingNote: null,
      priorClinicName: null,
      priorSurgeonName: null,
      priorGraftCount: null,
      estimatedHairCount: null,
      averageHairsPerGraft: null,
      singleHairGrafts: null,
      doubleHairGrafts: null,
      tripleHairGrafts: null,
      quadrupleHairGrafts: null,
      donorGraftsRemoved: null,
      punchSizeMm: null,
      extractionMethod: null,
      implantationMethod: null,
      transectionRatePercent: null,
      survivalEstimatePercent: null,
      recipientZones: [],
      donorDepletionLevel: null,
      donorReserveAssessment: null,
      visibleScarringLevel: null,
      surgicalTechniqueNotes: null,
      medicationHistory: {
        finasteride: true,
      },
      supportingDocumentNotes: null,
      clinicianSummary: null,
    },
    ...overrides,
  };
}

describe("futureHairLossProgressionRisk", () => {
  it("returns low risk for stable older patient with active preservation", () => {
    const result = buildFutureHairLossProgressionRisk(buildInput({ patientAge: 58 }));
    assert.equal(result.band, "low");
    assert.ok(result.score <= 34);
    assert.match(result.summary, /relatively stable/i);
  });

  it("returns moderate risk for mixed progression signals", () => {
    const bundle = baseBundle();
    bundle.hairLossClassification!.fields.norwoodStage = "IV";
    bundle.hairLossClassification!.fields.crownProgression = "early";
    bundle.hairLossClassification!.fields.diffuseThinningPattern = "possible";
    bundle.donorIntelligence!.fields.miniaturisationSuspicion = "possible";
    bundle.donorIntelligence!.fields.donorReserveRisk = "moderate";

    const result = buildFutureHairLossProgressionRisk(
      buildInput({
        patientAge: 34,
        intelligenceBundle: bundle,
        clinicalHistory: {
          ...buildInput().clinicalHistory!,
          medicationHistory: { saw_palmetto: true },
        },
      })
    );

    assert.equal(result.band, "moderate");
    assert.ok(result.score >= 35 && result.score <= 69);
  });

  it("returns elevated risk for younger patient with advanced pattern and no preservation", () => {
    const bundle = baseBundle();
    bundle.hairLossClassification!.fields.norwoodStage = "VII";
    bundle.hairLossClassification!.fields.crownProgression = "advanced";
    bundle.hairLossClassification!.fields.diffuseThinningPattern = "likely";
    bundle.donorIntelligence!.fields.miniaturisationSuspicion = "elevated_suspicion";
    bundle.donorIntelligence!.fields.donorReserveRisk = "elevated";

    const result = buildFutureHairLossProgressionRisk(
      buildInput({
        patientAge: 22,
        intelligenceBundle: bundle,
        clinicalHistory: {
          ...buildInput().clinicalHistory!,
          medicationHistory: { none_unknown: true },
        },
      })
    );

    assert.equal(result.band, "elevated");
    assert.ok(result.score >= 70);
    assert.ok(result.score <= 100);
  });

  it("scores age tiers deterministically", () => {
    const young = buildFutureHairLossProgressionRisk(
      buildInput({
        patientAge: 22,
        clinicalHistory: { ...buildInput().clinicalHistory!, medicationHistory: { finasteride: true } },
      })
    );
    const older = buildFutureHairLossProgressionRisk(
      buildInput({
        patientAge: 58,
        clinicalHistory: { ...buildInput().clinicalHistory!, medicationHistory: { finasteride: true } },
      })
    );
    const unknown = buildFutureHairLossProgressionRisk(
      buildInput({
        patientAge: null,
        clinicalHistory: { ...buildInput().clinicalHistory!, medicationHistory: { finasteride: true } },
      })
    );

    assert.ok(young.score > older.score);
    assert.ok(unknown.score < young.score);
    assert.ok(unknown.score > older.score);
  });

  it("scores visible thinning from classification outputs", () => {
    const noneBundle = baseBundle();
    const strongBundle = baseBundle();
    strongBundle.hairLossClassification!.fields.diffuseThinningPattern = "likely";
    strongBundle.donorIntelligence!.fields.miniaturisationSuspicion = "elevated_suspicion";

    const none = buildFutureHairLossProgressionRisk(
      buildInput({ intelligenceBundle: noneBundle, patientAge: 50 })
    );
    const strong = buildFutureHairLossProgressionRisk(
      buildInput({ intelligenceBundle: strongBundle, patientAge: 50 })
    );

    assert.ok(strong.score > none.score);
    assert.ok(strong.contributingFactors.some((f) => /surrounding native hair/i.test(f)));
  });

  it("scores crown progression from classification outputs", () => {
    const stableBundle = baseBundle();
    const crownBundle = baseBundle();
    crownBundle.hairLossClassification!.fields.crownProgression = "advanced";

    const stable = buildFutureHairLossProgressionRisk(
      buildInput({ intelligenceBundle: stableBundle, patientAge: 50 })
    );
    const crown = buildFutureHairLossProgressionRisk(
      buildInput({ intelligenceBundle: crownBundle, patientAge: 50 })
    );

    assert.ok(crown.score > stable.score);
    assert.ok(crown.contributingFactors.some((f) => /crown thinning/i.test(f)));
  });

  it("uses pathway-aware summaries", () => {
    const bundle = baseBundle();
    bundle.hairLossClassification!.fields.norwoodStage = "V";
    bundle.hairLossClassification!.fields.crownProgression = "moderate";
    bundle.donorIntelligence!.fields.donorReserveRisk = "moderate";

    const pre = buildFutureHairLossProgressionRisk(
      buildInput({
        pathway: "pre_surgery",
        intelligenceBundle: bundle,
        patientAge: 28,
        clinicalHistory: { ...buildInput().clinicalHistory!, medicationHistory: { none_unknown: true } },
      })
    );
    const post = buildFutureHairLossProgressionRisk(
      buildInput({
        pathway: "post_surgery",
        intelligenceBundle: bundle,
        patientAge: 28,
        clinicalHistory: { ...buildInput().clinicalHistory!, medicationHistory: { none_unknown: true } },
      })
    );

    assert.notEqual(pre.summary, post.summary);
    assert.match(pre.summary, /planning|candidacy|before surgery/i);
    assert.match(post.summary, /transplant|surrounding native hair|aesthetic balance/i);
  });

  it("generates band-appropriate recommendations", () => {
    const labels = buildFutureHairLossProgressionRiskLabelsEn();
    const elevated = buildFutureHairLossProgressionRisk(
      buildInput({
        patientAge: 20,
        intelligenceBundle: baseBundle({
          hairLossClassification: {
            ...baseBundle().hairLossClassification!,
            fields: {
              norwoodStage: "VI",
              crownProgression: "advanced",
              diffuseThinningPattern: "likely",
              evidenceLimitations: [],
            },
          },
          donorIntelligence: {
            ...baseBundle().donorIntelligence!,
            fields: {
              donorDensityBand: "appears_limited",
              miniaturisationSuspicion: "elevated_suspicion",
              retrogradeAlopeciaPattern: "possible",
              extractionSafetyZoneConcerns: "borderline",
              donorReserveRisk: "elevated",
            },
          },
        }),
        clinicalHistory: { ...buildInput().clinicalHistory!, medicationHistory: { none_unknown: true } },
      }),
      labels
    );

    assert.ok(elevated.recommendations.length >= 3);
    assert.ok(elevated.recommendations.length <= 4);
    assert.ok(elevated.recommendations.some((r) => /preservation discussion/i.test(r)));
    assert.ok(elevated.recommendations.every((r) => !/will lose|inevitable|worsen/i.test(r)));
  });

  it("generates contributing factors only from true signals", () => {
    const stable = buildFutureHairLossProgressionRisk(
      buildInput({
        patientAge: 55,
        intelligenceBundle: baseBundle(),
        clinicalHistory: { ...buildInput().clinicalHistory!, medicationHistory: { finasteride: true } },
      })
    );

    assert.equal(stable.contributingFactors.length, 0);

    const progressive = buildFutureHairLossProgressionRisk(
      buildInput({
        patientAge: 24,
        intelligenceBundle: baseBundle({
          hairLossClassification: {
            ...baseBundle().hairLossClassification!,
            fields: {
              norwoodStage: "V",
              crownProgression: "moderate",
              diffuseThinningPattern: "possible",
              evidenceLimitations: [],
            },
          },
        }),
        clinicalHistory: { ...buildInput().clinicalHistory!, medicationHistory: { none_unknown: true } },
      })
    );

    assert.ok(progressive.contributingFactors.length > 0);
    assert.ok(progressive.contributingFactors.length <= 4);
    assert.ok(progressive.contributingFactors.some((f) => /younger age/i.test(f)));
    assert.ok(progressive.contributingFactors.some((f) => /preservation strategies were not indicated/i.test(f)));
  });

  it("clamps score between 0 and 100", () => {
    const bundle = baseBundle();
    bundle.hairLossClassification!.fields.norwoodStage = "VII";
    bundle.hairLossClassification!.fields.crownProgression = "advanced";
    bundle.hairLossClassification!.fields.diffuseThinningPattern = "likely";
    bundle.donorIntelligence!.fields.miniaturisationSuspicion = "elevated_suspicion";
    bundle.donorIntelligence!.fields.donorReserveRisk = "elevated";

    const result = buildFutureHairLossProgressionRisk(
      buildInput({
        patientAge: 18,
        intelligenceBundle: bundle,
        clinicalHistory: { ...buildInput().clinicalHistory!, medicationHistory: { none_unknown: true } },
      })
    );

    assert.equal(result.score, 100);
    assert.ok(result.score >= 0 && result.score <= 100);
  });

  it("renders PDF HTML section with band, score, and bullets", () => {
    const result = buildFutureHairLossProgressionRisk(buildInput({ patientAge: 30 }));
    const html = renderFutureHairLossProgressionRiskHtml(result);
    assert.match(html, /Future Hair Loss Progression Risk/);
    assert.match(html, /data-testid="future-hair-loss-risk-section"/);
    assert.match(html, new RegExp(`${result.score}%`));
    assert.match(html, /Contributing factors|Recommendations/);
  });

  it("includes future risk in generated post-surgery report and PDF HTML", () => {
    const report = generatePostSurgeryAuditReport({
      caseId,
      patientReviewPathway: "post_surgery",
      summary: {
        forensic_audit: {
          section_scores: { donor_management: 70, extraction_quality: 72 },
          key_findings: [],
          red_flags: [],
        },
        metadata: {
          hairAuditIntelligence: baseBundle({
            hairLossClassification: {
              ...baseBundle().hairLossClassification!,
              fields: {
                norwoodStage: "IV",
                crownProgression: "moderate",
                diffuseThinningPattern: "possible",
                evidenceLimitations: [],
              },
            },
          }),
        },
        patient_answers: {
          enhanced_patient_answers: { baseline: { patient_age: 29 } },
        },
      },
      clinicalHistory: {
        ...buildInput().clinicalHistory!,
        medicationHistory: { none_unknown: true },
      },
    });

    assert.ok(isFutureHairLossRiskResult(report.futureHairLossRisk));
    const html = renderPostSurgeryAuditReportHtml({
      report,
      caseId,
      labels: buildPostSurgeryReportHtmlLabelsEn("Moderate concerns", "Minor observation"),
      generatedAtDisplay: "Jun 24, 2026",
      clinicalEvidenceLabels: buildPostSurgeryClinicalEvidenceGalleryLabelsEn(),
    });
    assert.match(html, /Future Hair Loss Progression Risk/);
    assert.match(html, /future-hair-loss-risk-section/);
  });

  it("resolves patient age from summary answers and brackets", () => {
    assert.equal(
      resolvePatientAgeForRisk({
        summary: {
          patient_answers: {
            enhanced_patient_answers: { baseline: { patient_age: 31 } },
          },
        },
      }),
      31
    );
    assert.equal(
      resolvePatientAgeForRisk({
        summary: { doctor_answers: { patient_age_bracket: "41_50" } },
      }),
      45
    );
    assert.equal(resolvePatientAgeForRisk({ summary: {} }), null);
  });

  it("validates stored result shape", () => {
    const result = buildFutureHairLossProgressionRisk(buildInput());
    assert.equal(isFutureHairLossRiskResult(result), true);
    assert.equal(isFutureHairLossRiskResult({}), false);
  });
});
