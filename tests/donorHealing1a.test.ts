import { describe, it } from "node:test";
import assert from "node:assert";
import {
  DONOR_HEALING_ORIENTATION_LABELS,
  DONOR_RED_FLAG_WARNING_COPY,
  FORBIDDEN_DONOR_DIAGNOSTIC_PHRASES,
  answersIncludeDonorRedFlags,
  buildDonorHealingOrientationSummary,
  containsForbiddenDonorDiagnosticLanguage,
  donorHealingAnalyticsMeta,
  parseDonorEntryContext,
  parsePostSurgeryConcern,
  resolveDonorHealingOrientationState,
} from "../src/lib/patient/donorHealingEntry";
import {
  buildDonorHealingChooserHref,
  parseEntryContextFromSearchParams,
} from "../src/lib/patient/patientEntryContext";
import { normalDonorHealingAfterFueArticle } from "../src/lib/seo/patient-intent-articles/normal-donor-healing-after-fue";
import { getPatientIntentArticle } from "../src/lib/seo/patient-intent-articles";
import { PATHWAY_EVIDENCE_PACKS, requiredPhotoKeys } from "../src/lib/patient/patientReviewPathway";
import { PATHWAY_QUESTIONNAIRE_SECTION_IDS } from "../src/lib/patient/patientPathwayQuestionnaire";
import { DONOR_HEALING_TIMELINE } from "../src/lib/seo/donorHealingGuideContent";

describe("HA-DONOR-HEALING-1A — CTA override and article schema", () => {
  it("donor article exposes Check My Donor Healing CTA override", () => {
    assert.strictEqual(normalDonorHealingAfterFueArticle.cta?.label, "Check My Donor Healing");
    assert.ok(normalDonorHealingAfterFueArticle.cta?.href.includes("/request-review"));
    assert.ok(normalDonorHealingAfterFueArticle.cta?.href.includes("concern=donor_healing"));
    assert.strictEqual(normalDonorHealingAfterFueArticle.cta?.analyticsId, "donor_cta_clicked");
    assert.strictEqual(normalDonorHealingAfterFueArticle.experience, "donor_healing");
  });

  it("other patient-intent articles keep default CTA behaviour (no cta override)", () => {
    const other = getPatientIntentArticle("shock-loss-vs-graft-failure");
    assert.ok(other);
    assert.strictEqual(other?.cta, undefined);
    assert.notStrictEqual(other?.experience, "donor_healing");
  });

  it("article FAQs cover donor healing SEO questions without diagnostic guarantees", () => {
    assert.ok(normalDonorHealingAfterFueArticle.faqs.length >= 5);
    const blob = normalDonorHealingAfterFueArticle.faqs.map((f) => `${f.question} ${f.answer}`).join(" ");
    assert.ok(!containsForbiddenDonorDiagnosticLanguage(blob));
    assert.ok(/photos/i.test(blob));
  });
});

describe("HA-DONOR-HEALING-1A — concern validation and entry context", () => {
  it("parses canonical post-surgery concerns", () => {
    assert.strictEqual(parsePostSurgeryConcern("donor_healing"), "donor_healing");
    assert.strictEqual(parsePostSurgeryConcern("DONOR_PATCHINESS"), "donor_patchiness");
    assert.strictEqual(parsePostSurgeryConcern("invalid"), null);
    assert.strictEqual(parsePostSurgeryConcern(""), null);
  });

  it("maps concern tokens to donor entry context", () => {
    assert.strictEqual(parseDonorEntryContext("donor_healing"), "donor_healing");
    assert.strictEqual(parseDonorEntryContext("possible_overharvesting"), "donor_healing");
    assert.strictEqual(parseDonorEntryContext("pre_surgery"), null);
  });

  it("builds chooser href with validated concern without starting a case", () => {
    const href = buildDonorHealingChooserHref();
    assert.ok(href.startsWith("/request-review?"));
    assert.ok(href.includes("#choose-pathway"));
    assert.ok(href.includes("entry_context=donor_healing"));
    const parsed = parseEntryContextFromSearchParams(href.split("?")[1].split("#")[0]);
    assert.strictEqual(parsed?.entryContext, "donor_healing");
  });

  it("rejects unknown concern query values", () => {
    assert.strictEqual(parseEntryContextFromSearchParams("concern=magic"), null);
  });
});

describe("HA-DONOR-HEALING-1A — red-flag boundary copy and orientation contract", () => {
  it("exposes direct-care warning without replacing clinical care", () => {
    assert.ok(/direct clinical care/i.test(DONOR_RED_FLAG_WARNING_COPY));
    assert.ok(/does not replace/i.test(DONOR_RED_FLAG_WARNING_COPY));
    assert.ok(!containsForbiddenDonorDiagnosticLanguage(DONOR_RED_FLAG_WARNING_COPY));
  });

  it("detects red-flag symptom answers", () => {
    assert.strictEqual(
      answersIncludeDonorRedFlags({ donor_red_flag_symptoms: ["fever"] }),
      true
    );
    assert.strictEqual(
      answersIncludeDonorRedFlags({ donor_red_flag_symptoms: ["none"] }),
      false
    );
  });

  it("orientation states use bounded patient-safe labels only", () => {
    for (const phrase of FORBIDDEN_DONOR_DIAGNOSTIC_PHRASES) {
      for (const label of Object.values(DONOR_HEALING_ORIENTATION_LABELS)) {
        assert.ok(!label.toLowerCase().includes(phrase));
      }
    }
    const early = resolveDonorHealingOrientationState({
      monthsSinceBand: "under_3",
      hasDonorRearPhoto: true,
    });
    assert.strictEqual(early, "too_early_to_assess_homogeneity");

    const red = buildDonorHealingOrientationSummary({
      hasRedFlagSymptoms: true,
      hasDonorRearPhoto: true,
      hasDonorLeftPhoto: true,
      hasDonorRightPhoto: true,
    });
    assert.strictEqual(red.state, "direct_clinical_assessment_recommended");
  });

  it("analytics meta never includes health free text keys", () => {
    const meta = donorHealingAnalyticsMeta({ stage_id: "days_1_3" });
    assert.strictEqual(meta.entry_context, "donor_healing");
    assert.ok(!("symptoms" in meta));
    assert.ok(!("donor_red_flag_symptoms" in meta));
    assert.ok(!("imageUrl" in meta));
  });
});

describe("HA-DONOR-HEALING-1A — readiness and questionnaire compatibility", () => {
  it("keeps post_surgery required photo keys unchanged", () => {
    assert.deepStrictEqual([...requiredPhotoKeys.post_surgery], [
      "preop_front",
      "current_recipient_closeup",
      "preop_top",
      "preop_donor_rear",
      "preop_donor_closeup",
    ]);
  });

  it("adds left/right donor views as recommended only", () => {
    const recommended = PATHWAY_EVIDENCE_PACKS.post_surgery.recommendedPhotoKeys;
    assert.ok(recommended.includes("preop_donor_left"));
    assert.ok(recommended.includes("preop_donor_right"));
    assert.ok(!requiredPhotoKeys.post_surgery.includes("preop_donor_left"));
    assert.ok(!requiredPhotoKeys.post_surgery.includes("preop_donor_right"));
  });

  it("includes optional donor healing questionnaire section for post_surgery", () => {
    assert.ok(PATHWAY_QUESTIONNAIRE_SECTION_IDS.post_surgery.includes("donor_healing_concern"));
    assert.ok(!PATHWAY_QUESTIONNAIRE_SECTION_IDS.pre_surgery.includes("donor_healing_concern"));
  });

  it("timeline has six stages", () => {
    assert.strictEqual(DONOR_HEALING_TIMELINE.length, 6);
  });
});
