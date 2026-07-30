import { describe, it } from "node:test";
import assert from "node:assert";
import {
  DONOR_FUNNEL_EVENTS,
  DONOR_HEALING_ORIENTATION_LABELS,
  DONOR_RED_FLAG_WARNING_COPY,
  FORBIDDEN_DONOR_DIAGNOSTIC_PHRASES,
  answersIncludeDonorRedFlags,
  buildDonorHealingOrientationSummary,
  containsForbiddenDonorDiagnosticLanguage,
  donorHealingAnalyticsMeta,
  parseDonorEntryContext,
  parseHairAuditEntryContext,
  parsePostSurgeryConcern,
  resolveDonorHealingOrientationState,
  withDonorEntryContextQuery,
} from "../src/lib/patient/donorHealingEntry";
import {
  buildDonorHealingChooserHref,
  parseEntryContextFromSearchParams,
  resolveDonorAwareAuthReturnPath,
} from "../src/lib/patient/patientEntryContext";
import { normalDonorHealingAfterFueArticle } from "../src/lib/seo/patient-intent-articles/normal-donor-healing-after-fue";
import { getPatientIntentArticle } from "../src/lib/seo/patient-intent-articles";
import {
  resolvePatientIntentCtaEntryContext,
  type PatientIntentArticleCta,
} from "../src/lib/seo/patient-intent-articles/types";
import { PATHWAY_EVIDENCE_PACKS, requiredPhotoKeys } from "../src/lib/patient/patientReviewPathway";
import { PATHWAY_QUESTIONNAIRE_SECTION_IDS } from "../src/lib/patient/patientPathwayQuestionnaire";
import { DONOR_HEALING_TIMELINE } from "../src/lib/seo/donorHealingGuideContent";
import { PUBLIC_CTAS } from "../src/lib/marketing/publicMarketingCopy";
import { PATHWAY_CHOOSER_HREF } from "../src/lib/patient/patientReviewPathway";

describe("HA-DONOR-HEALING-1A — CTA override and article schema", () => {
  it("optional article CTA falls back when omitted", () => {
    const other = getPatientIntentArticle("shock-loss-vs-graft-failure");
    assert.ok(other);
    assert.strictEqual(other?.cta, undefined);
    assert.strictEqual(resolvePatientIntentCtaEntryContext(other?.cta), undefined);
    // Shared page defaults (mirrors PatientIntentArticlePage).
    const fallbackLabel = other?.cta?.label ?? PUBLIC_CTAS.startFreeHairAudit;
    const fallbackHref = other?.cta?.href ?? PATHWAY_CHOOSER_HREF;
    assert.strictEqual(fallbackLabel, PUBLIC_CTAS.startFreeHairAudit);
    assert.strictEqual(fallbackHref, PATHWAY_CHOOSER_HREF);
  });

  it("donor article exposes Check My Donor Healing CTA override", () => {
    assert.strictEqual(normalDonorHealingAfterFueArticle.cta?.label, "Check My Donor Healing");
    assert.ok(normalDonorHealingAfterFueArticle.cta?.href.includes("/request-review"));
    assert.ok(normalDonorHealingAfterFueArticle.cta?.href.includes("concern=donor_healing"));
    assert.ok(normalDonorHealingAfterFueArticle.cta?.href.includes("recommended_pathway=post_surgery"));
    assert.ok(normalDonorHealingAfterFueArticle.cta?.href.includes("source_page="));
    assert.strictEqual(normalDonorHealingAfterFueArticle.cta?.analyticsId, "donor_cta_clicked");
    assert.strictEqual(normalDonorHealingAfterFueArticle.cta?.entryContext, "donor_healing");
    assert.strictEqual(normalDonorHealingAfterFueArticle.cta?.recommendedPathway, "post_surgery");
    assert.strictEqual(normalDonorHealingAfterFueArticle.experience, "donor_healing");
  });

  it("resolves deprecated context field as entryContext fallback", () => {
    const legacy: PatientIntentArticleCta = {
      label: "Legacy",
      href: "/request-review",
      analyticsId: "x",
      destination: "/request-review",
      context: "donor_healing",
    };
    assert.strictEqual(resolvePatientIntentCtaEntryContext(legacy), "donor_healing");
  });

  it("other patient-intent articles keep default CTA behaviour (no cta override)", () => {
    const other = getPatientIntentArticle("shock-loss-vs-graft-failure");
    assert.ok(other);
    assert.strictEqual(other?.cta, undefined);
    assert.notStrictEqual(other?.experience, "donor_healing");
  });

  it("article FAQs cover donor healing SEO questions without diagnostic guarantees", () => {
    assert.ok(normalDonorHealingAfterFueArticle.faqs.length >= 8);
    const blob = normalDonorHealingAfterFueArticle.faqs.map((f) => `${f.question} ${f.answer}`).join(" ");
    assert.ok(!containsForbiddenDonorDiagnosticLanguage(blob));
    assert.ok(/photos/i.test(blob));
    assert.ok(/bright lighting/i.test(blob));
    assert.ok(/overharvesting from one photograph/i.test(blob));
  });
});

describe("HA-DONOR-HEALING-1A — concern validation and entry context", () => {
  it("parses canonical post-surgery concerns", () => {
    assert.strictEqual(parsePostSurgeryConcern("donor_healing"), "donor_healing");
    assert.strictEqual(parsePostSurgeryConcern("DONOR_PATCHINESS"), "donor_patchiness");
    assert.strictEqual(parsePostSurgeryConcern("invalid"), null);
    assert.strictEqual(parsePostSurgeryConcern(""), null);
  });

  it("validates HairAuditEntryContext and rejects reserved or invalid URL values", () => {
    assert.strictEqual(parseHairAuditEntryContext("donor_healing"), "donor_healing");
    assert.strictEqual(parseHairAuditEntryContext("suspected_graft_failure"), null);
    assert.strictEqual(parseHairAuditEntryContext("magic"), null);
    assert.strictEqual(parseHairAuditEntryContext(""), null);
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
    assert.ok(href.includes("recommended_pathway=post_surgery"));
    assert.ok(href.includes("source_page=normal-donor-healing-after-fue"));
    const parsed = parseEntryContextFromSearchParams(href.split("?")[1].split("#")[0]);
    assert.strictEqual(parsed?.entryContext, "donor_healing");
    assert.strictEqual(parsed?.recommendedPathway, "post_surgery");
  });

  it("rejects unknown concern query values", () => {
    assert.strictEqual(parseEntryContextFromSearchParams("concern=magic"), null);
    assert.strictEqual(parseEntryContextFromSearchParams("entry_context=suspected_graft_failure"), null);
  });

  it("preserves entry context through auth-return helpers", () => {
    const pending = {
      entryContext: "donor_healing" as const,
      concern: "donor_healing" as const,
      sourceGuide: "normal-donor-healing-after-fue",
      recommendedPathway: "post_surgery" as const,
      ts: Date.now(),
    };
    const generic = resolveDonorAwareAuthReturnPath("/dashboard/patient", pending);
    assert.ok(generic?.includes("/request-review"));
    assert.ok(generic?.includes("entry_context=donor_healing"));

    const withCase = resolveDonorAwareAuthReturnPath(
      "/cases/abc/patient/photos",
      pending
    );
    assert.ok(withCase?.includes("entry_context=donor_healing"));

    const unrelated = resolveDonorAwareAuthReturnPath("/dashboard/patient", null);
    assert.strictEqual(unrelated, "/dashboard/patient");

    assert.strictEqual(
      withDonorEntryContextQuery("/cases/x/patient/photos", "donor_healing"),
      "/cases/x/patient/photos?entry_context=donor_healing"
    );
  });
});

describe("HA-DONOR-HEALING-1A — red-flag boundary copy and orientation contract", () => {
  it("exposes direct-care warning without replacing clinical care", () => {
    assert.ok(/better assessed directly/i.test(DONOR_RED_FLAG_WARNING_COPY));
    assert.ok(/does not replace/i.test(DONOR_RED_FLAG_WARNING_COPY));
    assert.ok(!containsForbiddenDonorDiagnosticLanguage(DONOR_RED_FLAG_WARNING_COPY));
  });

  it("detects red-flag symptom answers including swelling", () => {
    assert.strictEqual(
      answersIncludeDonorRedFlags({ donor_red_flag_symptoms: ["fever"] }),
      true
    );
    assert.strictEqual(
      answersIncludeDonorRedFlags({ donor_red_flag_symptoms: ["rapidly_worsening_swelling"] }),
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
    const meta = donorHealingAnalyticsMeta({
      stage_id: "days_1_3",
      symptoms: "fever",
      email: "x@y.com",
      case_id: "should-strip",
    });
    assert.strictEqual(meta.entry_context, "donor_healing");
    assert.strictEqual(meta.pathway, "post_surgery");
    assert.strictEqual(meta.source_page, "normal-donor-healing-after-fue");
    assert.ok(!("symptoms" in meta));
    assert.ok(!("donor_red_flag_symptoms" in meta));
    assert.ok(!("imageUrl" in meta));
    assert.ok(!("email" in meta));
    assert.ok(!("case_id" in meta));
  });

  it("documents the canonical privacy-safe funnel event set", () => {
    assert.ok(DONOR_FUNNEL_EVENTS.includes("donor_guide_viewed"));
    assert.ok(DONOR_FUNNEL_EVENTS.includes("donor_stage_selected"));
    assert.ok(DONOR_FUNNEL_EVENTS.includes("donor_auth_completed"));
    assert.ok(DONOR_FUNNEL_EVENTS.includes("donor_case_submitted"));
    assert.ok(DONOR_FUNNEL_EVENTS.includes("donor_report_viewed"));
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

  it("timeline has six stages with four bounded areas each", () => {
    assert.strictEqual(DONOR_HEALING_TIMELINE.length, 6);
    for (const stage of DONOR_HEALING_TIMELINE) {
      assert.ok(stage.commonlyNotice.length > 0);
      assert.ok(stage.cannotYetJudge.length > 0);
      assert.ok(stage.mayDeserveFollowUp.length > 0);
      assert.ok(stage.seekDirectClinicalCare.length > 0);
    }
  });
});
