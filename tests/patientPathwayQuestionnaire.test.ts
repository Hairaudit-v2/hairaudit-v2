/**
 * HA-PATHWAY-FIX — questionnaire routing must follow cases.patient_review_pathway only.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertPreSurgeryDoesNotRequireProcedureDate,
  filterIntakeSectionsForPathway,
  getMissingPathwayMinimalRequiredFields,
  getPathwayQuestionnairePageCopy,
  getQuestionsHrefAfterRequiredImages,
  PATHWAY_QUESTIONNAIRE_MINIMAL_REQUIRED_FIELD_IDS,
  PATIENT_PRE_SURGERY_SECTIONS,
  resolveCanonicalPatientReviewPathway,
  resolveQuestionnairePathwayFromCase,
  resolveQuestionnairePathwayIgnoringClientOverrides,
  validatePathwayMinimalIntake,
} from "../src/lib/patient/patientPathwayQuestionnaire";
import { isPathwayMinimalIntakeComplete } from "../src/lib/patient/patientResumeReview";
import { isPathwayRequiredUploadComplete } from "../src/lib/patient/patientReviewPathway";

const PRE_ANSWERS = {
  hair_loss_history: "3_5_years",
  hair_loss_pattern_self: ["hairline"],
  current_treatments: "none",
  transplant_goals: "Restore hairline",
  priority_areas: ["hairline"],
  expectations: "Natural coverage",
};

const POST_ANSWERS = {
  clinic_name: "Clinic",
  clinic_country: "uk",
  clinic_city: "London",
  procedure_date: "2024-01-01",
  procedure_type: "fue",
};

const PRE_REQUIRED_PHOTOS = [
  { type: "patient_photo:preop_front" },
  { type: "patient_photo:preop_left" },
  { type: "patient_photo:preop_right" },
  { type: "patient_photo:preop_top" },
  { type: "patient_photo:preop_donor_rear" },
];

const POST_REQUIRED_PHOTOS = [
  { type: "patient_photo:preop_front" },
  { type: "patient_photo:current_recipient_closeup" },
  { type: "patient_photo:preop_top" },
  { type: "patient_photo:preop_donor_rear" },
  { type: "patient_photo:preop_donor_closeup" },
];

describe("HA-PATHWAY-FIX patientPathwayQuestionnaire", () => {
  it("1. pre_surgery image completion opens the pre-surgery questionnaire", () => {
    assert.equal(isPathwayRequiredUploadComplete("pre_surgery", PRE_REQUIRED_PHOTOS), true);
    const href = getQuestionsHrefAfterRequiredImages("case-pre");
    assert.equal(href, "/cases/case-pre/patient/questions");

    const pathway = resolveQuestionnairePathwayFromCase({
      patient_review_pathway: "pre_surgery",
    });
    assert.equal(pathway, "pre_surgery");

    const copy = getPathwayQuestionnairePageCopy("pre_surgery");
    assert.equal(copy.title, "About Your Hair Restoration Goals");
    assert.match(copy.subtitle, /hair-loss history|goals|proposed clinic plan/i);
    assert.doesNotMatch(copy.subtitle, /surgery, healing, and results/i);

    const sections = filterIntakeSectionsForPathway("pre_surgery", { minimal: true });
    assert.deepEqual(
      sections.map((s) => s.id),
      ["goals_planning"]
    );
    assert.ok(sections.every((s) => !s.id.includes("recovery") && !s.id.includes("results")));
    const fieldIds = sections.flatMap((s) => s.questions.map((q) => q.id));
    assert.ok(!fieldIds.includes("procedure_date"));
    assert.ok(fieldIds.includes("transplant_goals"));
  });

  it("2. post_surgery image completion opens the post-surgery questionnaire", () => {
    assert.equal(isPathwayRequiredUploadComplete("post_surgery", POST_REQUIRED_PHOTOS), true);
    const pathway = resolveQuestionnairePathwayFromCase({
      patient_review_pathway: "post_surgery",
    });
    assert.equal(pathway, "post_surgery");

    const copy = getPathwayQuestionnairePageCopy("post_surgery");
    assert.match(copy.subtitle, /surgery, healing, and results/i);

    const sections = filterIntakeSectionsForPathway("post_surgery", { minimal: true });
    assert.deepEqual(
      sections.map((s) => s.id),
      ["clinic_procedure"]
    );
    const fieldIds = sections.flatMap((s) => s.questions.map((q) => q.id));
    assert.ok(fieldIds.includes("procedure_date"));
    assert.ok(fieldIds.includes("procedure_type"));
  });

  it("3. pre_surgery submission works without a procedure date", () => {
    assertPreSurgeryDoesNotRequireProcedureDate("pre_surgery");
    assert.ok(
      !PATHWAY_QUESTIONNAIRE_MINIMAL_REQUIRED_FIELD_IDS.pre_surgery.includes("procedure_date")
    );

    const withoutDate = { ...PRE_ANSWERS };
    assert.equal(validatePathwayMinimalIntake("pre_surgery", withoutDate), null);
    assert.equal(isPathwayMinimalIntakeComplete("pre_surgery", withoutDate), true);
    assert.deepEqual(getMissingPathwayMinimalRequiredFields("pre_surgery", withoutDate), []);

    // Optional clinic plan fields including proposed date remain optional
    const withOptionalPlan = {
      ...PRE_ANSWERS,
      clinic_name: "Optional Clinic",
      proposed_procedure_date: "2026-09-01",
      graft_estimate: 3200,
    };
    assert.equal(validatePathwayMinimalIntake("pre_surgery", withOptionalPlan), null);

    const postMissingDate = { ...POST_ANSWERS, procedure_date: "" };
    assert.ok(validatePathwayMinimalIntake("post_surgery", postMissingDate));
  });

  it("4. refresh and resume preserve the correct questionnaire", () => {
    const prePathway = resolveQuestionnairePathwayFromCase({
      patient_review_pathway: "pre_surgery",
    });
    const postPathway = resolveQuestionnairePathwayFromCase({
      patient_review_pathway: "post_surgery",
    });
    assert.equal(prePathway, "pre_surgery");
    assert.equal(postPathway, "post_surgery");

    // Resume completion checks are pathway-specific
    assert.equal(isPathwayMinimalIntakeComplete("pre_surgery", PRE_ANSWERS), true);
    assert.equal(isPathwayMinimalIntakeComplete("pre_surgery", POST_ANSWERS), false);
    assert.equal(isPathwayMinimalIntakeComplete("post_surgery", POST_ANSWERS), true);
    assert.equal(isPathwayMinimalIntakeComplete("post_surgery", PRE_ANSWERS), false);

    // Same questions URL; form kind still comes from stored pathway on reload
    assert.equal(
      getQuestionsHrefAfterRequiredImages("case-1"),
      "/cases/case-1/patient/questions"
    );
    assert.equal(
      getPathwayQuestionnairePageCopy(prePathway!).title,
      "About Your Hair Restoration Goals"
    );
    assert.equal(getPathwayQuestionnairePageCopy(postPathway!).title, "About your procedure");
  });

  it("5. pathway cannot change because of URL parameters or stale client state", () => {
    const fromCase = resolveQuestionnairePathwayIgnoringClientOverrides({
      caseRow: { patient_review_pathway: "pre_surgery" },
      urlPathway: "post_surgery",
      clientPathway: "post_surgery",
    });
    assert.equal(fromCase, "pre_surgery");

    const ignoredUrl = resolveQuestionnairePathwayIgnoringClientOverrides({
      caseRow: { patient_review_pathway: "post_surgery" },
      urlPathway: "pre_surgery",
      clientPathway: "pre_surgery",
    });
    assert.equal(ignoredUrl, "post_surgery");

    // Fail closed — never silently default to post_surgery
    assert.equal(resolveCanonicalPatientReviewPathway(null), null);
    assert.equal(resolveCanonicalPatientReviewPathway(undefined), null);
    assert.equal(resolveCanonicalPatientReviewPathway("unknown"), null);
    assert.equal(resolveQuestionnairePathwayFromCase({ patient_review_pathway: null }), null);
    assert.equal(resolveQuestionnairePathwayFromCase(null), null);
    assert.equal(
      resolveQuestionnairePathwayIgnoringClientOverrides({
        caseRow: { patient_review_pathway: null },
        urlPathway: "post_surgery",
        clientPathway: "post_surgery",
      }),
      null
    );
  });

  it("pre_surgery questionnaire avoids completed-surgery language and mandatory procedure date", () => {
    for (const section of PATIENT_PRE_SURGERY_SECTIONS) {
      const blob = `${section.title} ${section.description ?? ""} ${section.questions
        .map((q) => `${q.prompt} ${q.help ?? ""}`)
        .join(" ")}`.toLowerCase();
      assert.doesNotMatch(blob, /\bhealing\b/);
      assert.doesNotMatch(blob, /\brecovery\b/);
      assert.doesNotMatch(blob, /\bfinal results?\b/);
      assert.doesNotMatch(blob, /months since procedure/);
      for (const q of section.questions) {
        if (q.id === "procedure_date" || q.id === "proposed_procedure_date") {
          assert.equal(q.required, false);
        }
      }
    }
  });
});
