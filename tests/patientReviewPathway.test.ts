import { describe, it } from "node:test";
import assert from "node:assert";
import { buildAuditCaseInsertData } from "../src/lib/cases/createCase";
import {
  getPathwayDefinition,
  isIntakeSectionVisibleForPathway,
  normalizePatientReviewPathway,
  PATHWAY_MINIMAL_REQUIRED_FIELD_IDS,
} from "../src/lib/patient/patientReviewPathway";
import { getRequiredKeys } from "../src/lib/auditPhotoSchemas";
import { runPathwayHairAuditIntelligenceBundle } from "../src/lib/hairaudit-intelligence/pathwayIntelligence";
import { buildPatientSafeReportSummary } from "../src/lib/reports/patientSafeSummary";

describe("patientReviewPathway", () => {
  it("normalizes unknown values to post_surgery", () => {
    assert.strictEqual(normalizePatientReviewPathway(undefined), "post_surgery");
    assert.strictEqual(normalizePatientReviewPathway("invalid"), "post_surgery");
    assert.strictEqual(normalizePatientReviewPathway("pre_surgery"), "pre_surgery");
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

  it("uses shared required audit keys for both pathways today", () => {
    const pre = getRequiredKeys("patient", "pre_surgery");
    const post = getRequiredKeys("patient", "post_surgery");
    assert.deepStrictEqual(pre, post);
    assert.strictEqual(pre.length, 3);
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

  it("defines distinct intelligence module sets", () => {
    const pre = getPathwayDefinition("pre_surgery").intelligenceModules;
    const post = getPathwayDefinition("post_surgery").intelligenceModules;
    assert.notDeepStrictEqual(pre, post);
    assert.ok(pre.includes("graft_estimation"));
    assert.ok(post.includes("repair_intelligence"));
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
