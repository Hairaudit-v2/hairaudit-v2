import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPatientNarrative,
  getPatientNarrativeState,
  type PatientNarrativeDomainId,
  type PatientNarrativeState,
} from "@/lib/reports/patientNarrativeTemplates";

const REQUIRED_DOMAINS: PatientNarrativeDomainId[] = [
  "donor_management",
  "recipient_site_design",
  "graft_handling",
  "implantation_technique",
  "documentation_quality",
  "hairline_transition",
  "density_consistency",
  "direction_angle_coherence",
];

const REQUIRED_STATES: PatientNarrativeState[] = [
  "strong_positive",
  "moderate_positive",
  "mixed",
  "limited_evidence",
  "concern_flagged",
];

const REQUIRED_KEYS = [
  "clinicalFinding",
  "plainEnglishMeaning",
  "patientImplication",
  "confidenceExplanation",
  "followUpAdvice",
];

test("buildPatientNarrative supports all required domains and states", () => {
  for (const domainId of REQUIRED_DOMAINS) {
    for (const state of REQUIRED_STATES) {
      const out = buildPatientNarrative({
        domainId,
        state,
        confidenceBand: "moderate",
      });
      assert.deepEqual(Object.keys(out).sort(), [...REQUIRED_KEYS].sort());
      for (const key of REQUIRED_KEYS) {
        assert.equal(typeof out[key as keyof typeof out], "string");
        assert.ok(String(out[key as keyof typeof out]).trim().length > 0);
      }
    }
  }
});

test("limited_evidence wording remains calm and does not imply poor result", () => {
  for (const domainId of REQUIRED_DOMAINS) {
    const out = buildPatientNarrative({
      domainId,
      state: "limited_evidence",
      confidenceBand: "limited",
    });
    const merged = `${out.clinicalFinding} ${out.plainEnglishMeaning} ${out.patientImplication} ${out.confidenceExplanation}`.toLowerCase();
    assert.match(merged, /(limited evidence|not the same as a poor result|does not mean|uncertain|incomplete)/);
    assert.doesNotMatch(merged, /(definitive failure|failed result|certainly poor|guaranteed poor)/);
  }
});

test("getPatientNarrativeState maps representative scenarios", () => {
  assert.equal(
    getPatientNarrativeState({ score: 88, evidenceCount: 3, hasConcern: false, confidenceBand: "high" }),
    "strong_positive"
  );
  assert.equal(
    getPatientNarrativeState({ score: 70, evidenceCount: 2, hasConcern: false, confidenceBand: "moderate" }),
    "moderate_positive"
  );
  assert.equal(
    getPatientNarrativeState({ score: 58, evidenceCount: 1, hasConcern: false, confidenceBand: "low" }),
    "mixed"
  );
  assert.equal(
    getPatientNarrativeState({ score: null, evidenceCount: 0, hasConcern: false, confidenceBand: "limited" }),
    "limited_evidence"
  );
  assert.equal(
    getPatientNarrativeState({ score: 82, evidenceCount: 2, hasConcern: true, confidenceBand: "high" }),
    "concern_flagged"
  );
});

test("snapshot-style narratives across 3 domains and multiple states", () => {
  const donorStrong = buildPatientNarrative({
    domainId: "donor_management",
    state: "strong_positive",
    confidenceBand: "high",
  });
  assert.deepEqual(donorStrong, {
    clinicalFinding: "Donor extraction pattern appears spatially balanced with no dominant overharvest signature.",
    plainEnglishMeaning: "The donor area looks evenly used rather than patchy.",
    patientImplication: "This supports lower risk of visible donor thinning as your hair grows out.",
    confidenceExplanation:
      "Positive evidence: image quality and coverage are strong enough for higher-confidence interpretation.",
    followUpAdvice: "Re-check donor photos at 6 and 12 months in similar lighting to confirm long-term donor uniformity.",
  });

  const recipientMixed = buildPatientNarrative({
    domainId: "recipient_site_design",
    state: "mixed",
    confidenceBand: "moderate",
  });
  assert.deepEqual(recipientMixed, {
    clinicalFinding: "Recipient distribution findings are mixed and suggest variable site planning consistency.",
    plainEnglishMeaning: "Some regions look well planned, while others appear less consistent.",
    patientImplication: "Final visual harmony may depend on how these regions mature over the growth cycle.",
    confidenceExplanation: "Mixed evidence: the pattern is visible, but some angles or timepoints are incomplete.",
    followUpAdvice: "Use monthly frontal/top photos and reassess with your team at month 6.",
  });

  const directionLimited = buildPatientNarrative({
    domainId: "direction_angle_coherence",
    state: "limited_evidence",
    confidenceBand: "limited",
  });
  assert.deepEqual(directionLimited, {
    clinicalFinding: "Direction-angle analysis is constrained by limited high-detail directional views.",
    plainEnglishMeaning: "Current photos do not clearly show enough hair-flow detail.",
    patientImplication: "No definitive direction-quality conclusion can be made yet.",
    confidenceExplanation:
      "Limited evidence: this section cannot be interpreted reliably yet. Limited evidence is not the same as a poor result.",
    followUpAdvice: "Upload close-range oblique and temple views under even lighting.",
  });
});
