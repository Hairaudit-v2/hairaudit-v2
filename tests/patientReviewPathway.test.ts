import { describe, it } from "node:test";
import assert from "node:assert";
import { buildAuditCaseInsertData } from "../src/lib/cases/createCase";
import {
  computePathwayUploadProgress,
  getPathwayEvidencePack,
  getPathwayPhotoKeys,
  getPathwayUploadTier,
  isIntakeSectionVisibleForPathway,
  isPathwayRequiredUploadComplete,
  isPathwayRelevantPhotoKey,
  normalizePatientReviewPathway,
  PATHWAY_MINIMAL_REQUIRED_FIELD_IDS,
  recommendedPhotoKeys,
  requiredPhotoKeys,
  resolvePathwayPhotoSlotDefs,
  resolvePatientReviewPathwayFromCase,
} from "../src/lib/patient/patientReviewPathway";
import { canSubmit, getRequiredKeys } from "../src/lib/auditPhotoSchemas";
import { runPathwayHairAuditIntelligenceBundle } from "../src/lib/hairaudit-intelligence/pathwayIntelligence";
import { buildPatientSafeReportSummary } from "../src/lib/reports/patientSafeSummary";

describe("patientReviewPathway", () => {
  it("normalizes unknown values to post_surgery", () => {
    assert.strictEqual(normalizePatientReviewPathway(undefined), "post_surgery");
    assert.strictEqual(normalizePatientReviewPathway("invalid"), "post_surgery");
    assert.strictEqual(normalizePatientReviewPathway("pre_surgery"), "pre_surgery");
  });

  it("legacy case rows without pathway fall back to post_surgery", () => {
    assert.strictEqual(resolvePatientReviewPathwayFromCase(null), "post_surgery");
    assert.strictEqual(resolvePatientReviewPathwayFromCase({ patient_review_pathway: null }), "post_surgery");
    assert.strictEqual(
      resolvePatientReviewPathwayFromCase({ patient_review_pathway: "unknown" }),
      "post_surgery"
    );
  });

  it("stores pathway on patient case insert", () => {
    const uid = "00000000-0000-4000-8000-000000000001";
    const pre = buildAuditCaseInsertData(uid, "patient", "pre_surgery");
    assert.strictEqual(pre.patient_review_pathway, "pre_surgery");
    assert.strictEqual(pre.title, "Pre-Surgery Review");

    const post = buildAuditCaseInsertData(uid, "patient", "post_surgery");
    assert.strictEqual(post.patient_review_pathway, "post_surgery");
    assert.strictEqual(post.title, "Patient Audit");
  });

  it("does not set pathway on doctor cases", () => {
    const uid = "00000000-0000-4000-8000-000000000002";
    const row = buildAuditCaseInsertData(uid, "doctor", "pre_surgery");
    assert.strictEqual(row.patient_review_pathway, undefined);
  });

  it("defines distinct pre_surgery required photo keys (5 planning views)", () => {
    const pre = requiredPhotoKeys.pre_surgery;
    assert.strictEqual(pre.length, 5);
    assert.ok(pre.includes("preop_front"));
    assert.ok(pre.includes("preop_left"));
    assert.ok(pre.includes("preop_right"));
    assert.ok(pre.includes("preop_top"));
    assert.ok(pre.includes("preop_donor_rear"));
  });

  it("defines distinct post_surgery required photo keys (5 audit views)", () => {
    const post = requiredPhotoKeys.post_surgery;
    assert.strictEqual(post.length, 5);
    assert.ok(post.includes("preop_front"));
    assert.ok(post.includes("current_recipient_closeup"));
    assert.ok(post.includes("preop_top"));
    assert.ok(post.includes("preop_donor_rear"));
    assert.ok(post.includes("preop_donor_closeup"));
  });

  it("getRequiredKeys returns pathway-specific audit buckets", () => {
    const pre = getRequiredKeys("patient", "pre_surgery");
    const post = getRequiredKeys("patient", "post_surgery");
    assert.notDeepStrictEqual(pre, post);
    assert.strictEqual(pre.length, 5);
    assert.strictEqual(post.length, 3);
  });

  it("upload UI slot defs only include pathway-relevant categories", () => {
    const preKeys = new Set(getPathwayPhotoKeys("pre_surgery"));
    const postKeys = new Set(getPathwayPhotoKeys("post_surgery"));
    assert.ok(!preKeys.has("current_recipient_closeup"));
    assert.ok(postKeys.has("current_recipient_closeup"));
    assert.ok(!postKeys.has("preop_left"));

    for (const def of resolvePathwayPhotoSlotDefs("pre_surgery")) {
      assert.ok(isPathwayRelevantPhotoKey(def.key, "pre_surgery"));
    }
    for (const def of resolvePathwayPhotoSlotDefs("post_surgery")) {
      assert.ok(isPathwayRelevantPhotoKey(def.key, "post_surgery"));
    }
  });

  it("required completion only depends on pathway-required photos", () => {
    const preMinimal = [
      { type: "patient_photo:preop_front" },
      { type: "patient_photo:preop_left" },
      { type: "patient_photo:preop_right" },
      { type: "patient_photo:preop_top" },
      { type: "patient_photo:preop_donor_rear" },
    ];
    assert.equal(isPathwayRequiredUploadComplete("pre_surgery", preMinimal), true);
    assert.equal(canSubmit("patient", preMinimal, "pre_surgery"), true);

    const preMissingSide = preMinimal.filter((p) => !p.type.includes("preop_left"));
    assert.equal(isPathwayRequiredUploadComplete("pre_surgery", preMissingSide), false);
  });

  it("recommended and optional photos do not block continuation", () => {
    const postRequiredOnly = [
      { type: "patient_photo:preop_front" },
      { type: "patient_photo:current_recipient_closeup" },
      { type: "patient_photo:preop_top" },
      { type: "patient_photo:preop_donor_rear" },
      { type: "patient_photo:preop_donor_closeup" },
    ];
    assert.equal(isPathwayRequiredUploadComplete("post_surgery", postRequiredOnly), true);
    assert.equal(canSubmit("patient", postRequiredOnly, "post_surgery"), true);

    const withRecommended = [
      ...postRequiredOnly,
      { type: "patient_photo:day0_recipient" },
      { type: "patient_photo:graft_count_board" },
    ];
    assert.equal(canSubmit("patient", withRecommended, "post_surgery"), true);

    const missingRecommendedOnly = postRequiredOnly;
    const progress = computePathwayUploadProgress("post_surgery", withRecommended);
    assert.equal(progress.recommendedCompleted, 1);
    assert.equal(progress.completed, 5);
    assert.equal(
      isPathwayRequiredUploadComplete("post_surgery", missingRecommendedOnly),
      true
    );
  });

  it("confidence messages are pathway-specific in evidence packs", () => {
    const pre = getPathwayEvidencePack("pre_surgery");
    const post = getPathwayEvidencePack("post_surgery");
    assert.notStrictEqual(pre.confidenceMessageKey, post.confidenceMessageKey);
    assert.notStrictEqual(pre.continueButtonKey, post.continueButtonKey);
    assert.ok(pre.purposeKey.includes("preSurgery"));
    assert.ok(post.purposeKey.includes("postSurgery"));
  });

  it("recommended tier keys are not required", () => {
    for (const key of recommendedPhotoKeys.pre_surgery) {
      assert.strictEqual(getPathwayUploadTier(key, "pre_surgery"), "recommended");
    }
    for (const key of recommendedPhotoKeys.post_surgery) {
      assert.strictEqual(getPathwayUploadTier(key, "post_surgery"), "recommended");
    }
  });

  it("filters intake sections by pathway", () => {
    assert.strictEqual(
      isIntakeSectionVisibleForPathway("results", "post_surgery", { minimal: false }),
      true
    );
    assert.strictEqual(
      isIntakeSectionVisibleForPathway("results", "pre_surgery", { minimal: false }),
      false
    );
    assert.deepStrictEqual(
      PATHWAY_MINIMAL_REQUIRED_FIELD_IDS.pre_surgery,
      ["clinic_country", "procedure_type"]
    );
  });

  it("runs pathway intelligence bundle without throwing", () => {
    const bundle = runPathwayHairAuditIntelligenceBundle(
      { images: [], reportFindings: [], caseId: "case-1" },
      "pre_surgery"
    );
    assert.ok(bundle.hairLossClassification);
    assert.ok(bundle.donorIntelligence);
  });

  it("adds pathway focus areas to patient-safe summary", () => {
    const report = buildPatientSafeReportSummary({}, { patientReviewPathway: "pre_surgery" });
    assert.strictEqual(report.patientReviewPathway, "pre_surgery");
    assert.ok(report.pathwayFocusAreas?.length);
  });
});
