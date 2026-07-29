/**
 * HA-PATHWAY-FIX-2 — patient case dashboard must follow cases.patient_review_pathway.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPatientCaseDashboardViewModel,
  patientCaseDashboardHasSection,
  PRE_SURGERY_FORBIDDEN_DASHBOARD_STRINGS,
  PRE_SURGERY_REPORT_PENDING_TEXT,
  preSurgeryDashboardContainsForbiddenChrome,
  resolvePatientCaseDashboardNextAction,
  resolvePatientDashboardPathwayFromCase,
  shouldMountPatientPostSurgeryChrome,
  shouldMountPatientPreSurgeryChrome,
} from "../src/lib/patient/patientCaseDashboard";
import { PATHWAY_EVIDENCE_PACKS } from "../src/lib/patient/patientReviewPathway";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PRE_SURGERY_REQUIRED_PHOTOS = PATHWAY_EVIDENCE_PACKS.pre_surgery.requiredPhotoKeys.map((k) => ({
  type: `patient_photo:${k}`,
}));

const PRE_SURGERY_ANSWERS = {
  hair_loss_history: "1_3_years",
  hair_loss_pattern_self: ["hairline"],
  current_treatments: "none",
  transplant_goals: "Restore hairline",
  priority_areas: ["hairline"],
  expectations: "Natural density",
};

const POST_SURGERY_REQUIRED_PHOTOS = PATHWAY_EVIDENCE_PACKS.post_surgery.requiredPhotoKeys.map((k) => ({
  type: `patient_photo:${k}`,
}));

describe("HA-PATHWAY-FIX-2 patientCaseDashboard", () => {
  it("fail-closes when pathway is missing or invalid (never silently defaults to post_surgery)", () => {
    assert.equal(resolvePatientDashboardPathwayFromCase({ patient_review_pathway: null }), null);
    assert.equal(resolvePatientDashboardPathwayFromCase({ patient_review_pathway: "invalid" }), null);
    assert.equal(
      resolvePatientDashboardPathwayFromCase(
        { patient_review_pathway: "pre_surgery" },
        { urlPathway: "post_surgery", clientPathway: "post_surgery" }
      ),
      "pre_surgery"
    );
  });

  it("ignores URL / client pathway overrides when resolving dashboard pathway", () => {
    const pathway = resolvePatientDashboardPathwayFromCase(
      { patient_review_pathway: "pre_surgery" },
      { urlPathway: "post_surgery", clientPathway: "post_surgery" }
    );
    assert.equal(pathway, "pre_surgery");
    const model = buildPatientCaseDashboardViewModel({
      caseId: "c1",
      caseStatus: "draft",
      patientReviewPathway: "pre_surgery",
      uploads: [],
      patientAnswers: {},
      hasReportPdf: false,
      urlPathway: "post_surgery",
      clientPathway: "post_surgery",
    });
    assert.equal(model.pathway, "pre_surgery");
    assert.equal(model.nextAction.title, "Complete Your Photos");
  });

  it("never mounts post-surgery chrome for pre_surgery patients", () => {
    assert.equal(
      shouldMountPatientPostSurgeryChrome({
        isPatientForCase: true,
        pathway: "pre_surgery",
        patientHidesForensicWorkspace: false,
      }),
      false
    );
    assert.equal(
      shouldMountPatientPreSurgeryChrome({
        isPatientForCase: true,
        pathway: "pre_surgery",
      }),
      true
    );
  });

  it("retains post-surgery chrome for post_surgery patients in draft", () => {
    assert.equal(
      shouldMountPatientPostSurgeryChrome({
        isPatientForCase: true,
        pathway: "post_surgery",
        patientHidesForensicWorkspace: false,
      }),
      true
    );
    assert.equal(
      shouldMountPatientPreSurgeryChrome({
        isPatientForCase: true,
        pathway: "post_surgery",
      }),
      false
    );
  });

  it("pre_surgery model excludes graft integrity, months post-op, surgery-day and submit-for-audit chrome", () => {
    const model = buildPatientCaseDashboardViewModel({
      caseId: "pre-1",
      caseTitle: "Pre-Surgery Review",
      caseStatus: "draft",
      patientReviewPathway: "pre_surgery",
      uploads: PRE_SURGERY_REQUIRED_PHOTOS,
      patientAnswers: {},
      hasReportPdf: false,
    });

    assert.equal(model.pathway, "pre_surgery");
    assert.equal(patientCaseDashboardHasSection(model, "graft_integrity"), false);
    assert.equal(patientCaseDashboardHasSection(model, "planning_assessment"), true);
    assert.equal(patientCaseDashboardHasSection(model, "latest_report_benchmarking"), false);
    assert.ok(!model.summaryFields.includes("months_post_op"));
    assert.ok(!model.summaryFields.includes("procedure_date"));
    assert.ok(!model.summaryFields.includes("audit_source"));
    assert.ok(model.summaryFields.includes("review_type"));
    assert.equal(model.reportCardTitle, "Pre-Surgery Review Report");
    assert.equal(model.reportCardPendingText, PRE_SURGERY_REPORT_PENDING_TEXT);
    assert.equal(model.questionnaireLabel, "Pre-Surgery Questions");
    assert.equal(model.clinicContributionTitle, "Add a Clinic Quote or Treatment Plan");
    assert.equal(model.submitLabel, "Submit Pre-Surgery Review");
    assert.ok(!model.requiredPhotoKeys.some((k) => k.startsWith("day0_") || k.includes("postop")));
    assert.ok(model.requiredPhotoKeys.includes("preop_front"));
    assert.ok(model.requiredPhotoKeys.includes("preop_top"));
    assert.ok(model.requiredPhotoKeys.includes("preop_left"));
    assert.ok(model.requiredPhotoKeys.includes("preop_right"));

    const serialized = JSON.stringify(model);
    for (const forbidden of [
      "Graft Integrity Index",
      "claimed grafts",
      "estimated extracted",
      "estimated implanted",
      "Months Post-op",
      "Submit for audit",
      "Complete your audit",
      "benchmarked against global surgical standards",
    ]) {
      assert.ok(
        !serialized.toLowerCase().includes(forbidden.toLowerCase()),
        `pre_surgery model must not contain "${forbidden}"`
      );
    }
  });

  it("shows Complete Your Pre-Surgery Questions when photos complete and questions incomplete", () => {
    const model = buildPatientCaseDashboardViewModel({
      caseId: "pre-2",
      caseStatus: "draft",
      patientReviewPathway: "pre_surgery",
      uploads: PRE_SURGERY_REQUIRED_PHOTOS,
      patientAnswers: {},
      hasReportPdf: false,
    });
    assert.equal(model.nextAction.id, "complete_questions");
    assert.equal(model.nextAction.title, "Complete Your Pre-Surgery Questions");
    assert.equal(model.nextAction.primaryCtaLabel, "Continue Questions");
    assert.equal(model.nextAction.secondaryCtaLabel, "Review Uploaded Photos");
    assert.match(model.nextAction.primaryCtaHref ?? "", /\/patient\/questions$/);
    assert.match(model.nextAction.secondaryCtaHref ?? "", /\/patient\/photos$/);
  });

  it("shows Submit Pre-Surgery Review when photos and questions are complete", () => {
    const model = buildPatientCaseDashboardViewModel({
      caseId: "pre-3",
      caseStatus: "draft",
      patientReviewPathway: "pre_surgery",
      uploads: PRE_SURGERY_REQUIRED_PHOTOS,
      patientAnswers: PRE_SURGERY_ANSWERS,
      hasReportPdf: false,
    });
    assert.equal(model.nextAction.id, "submit_review");
    assert.equal(model.nextAction.title, "Submit Pre-Surgery Review");
    assert.equal(model.submitLabel, "Submit Pre-Surgery Review");
  });

  it("shows specialist-review preparing copy for submitted pre_surgery (no audit language)", () => {
    const model = buildPatientCaseDashboardViewModel({
      caseId: "pre-4",
      caseStatus: "submitted",
      patientReviewPathway: "pre_surgery",
      uploads: PRE_SURGERY_REQUIRED_PHOTOS,
      patientAnswers: PRE_SURGERY_ANSWERS,
      hasReportPdf: false,
    });
    assert.equal(model.nextAction.id, "review_preparing");
    assert.equal(model.nextAction.title, "Your Pre-Surgery Review Is Being Prepared");
    assert.match(model.nextAction.subtitle, /Specialists|planning review/i);
    assert.ok(!/submit for audit|auditor review|surgical outcome/i.test(model.nextAction.subtitle));
    assert.ok(!/Complete your audit/i.test(model.nextAction.title));
  });

  it("links report-ready pre_surgery to the pre-surgery report title", () => {
    const model = buildPatientCaseDashboardViewModel({
      caseId: "pre-5",
      caseStatus: "complete",
      patientReviewPathway: "pre_surgery",
      uploads: PRE_SURGERY_REQUIRED_PHOTOS,
      patientAnswers: PRE_SURGERY_ANSWERS,
      hasReportPdf: true,
    });
    assert.equal(model.nextAction.id, "view_report");
    assert.equal(model.nextAction.title, "View Your Pre-Surgery Review Report");
    assert.equal(model.nextAction.primaryCtaLabel, "View Pre-Surgery Review Report");
    assert.equal(model.nextAction.primaryCtaHref, "/cases/pre-5");
    assert.equal(model.reportCardTitle, "Pre-Surgery Review Report");
  });

  it("post_surgery retains operative / outcome sections", () => {
    const model = buildPatientCaseDashboardViewModel({
      caseId: "post-1",
      caseStatus: "draft",
      patientReviewPathway: "post_surgery",
      uploads: POST_SURGERY_REQUIRED_PHOTOS,
      patientAnswers: {
        clinic_name: "Clinic",
        clinic_country: "TR",
        clinic_city: "Istanbul",
        procedure_date: "2025-01-01",
        procedure_type: "FUE",
      },
      hasReportPdf: false,
    });
    assert.equal(model.pathway, "post_surgery");
    assert.equal(patientCaseDashboardHasSection(model, "graft_integrity"), true);
    assert.equal(patientCaseDashboardHasSection(model, "planning_assessment"), false);
    assert.ok(model.summaryFields.includes("months_post_op"));
    assert.ok(model.summaryFields.includes("audit_source"));
    assert.equal(model.submitLabel, "Submit for audit");
    assert.equal(model.nextAction.id, "submit_review");
    assert.equal(model.nextAction.title, "Submit for audit");
  });

  it("forbidden-string detector catches post-surgery chrome text", () => {
    assert.equal(
      preSurgeryDashboardContainsForbiddenChrome("Graft Integrity Index and claimed grafts"),
      true
    );
    assert.equal(
      preSurgeryDashboardContainsForbiddenChrome("Pre-Surgery Planning Assessment"),
      false
    );
    assert.ok(PRE_SURGERY_FORBIDDEN_DASHBOARD_STRINGS.includes("Submit for audit"));
  });

  it("case page source gates GraftIntegrity and Months Post-op behind post-surgery mount", () => {
    const pageSrc = readFileSync(join(process.cwd(), "src/app/cases/[caseId]/page.tsx"), "utf8");
    assert.match(pageSrc, /mountPatientPreSurgeryChrome/);
    assert.match(pageSrc, /mountPatientPostSurgeryChrome/);
    assert.match(pageSrc, /PatientPreSurgeryCaseDashboard/);
    assert.match(pageSrc, /GraftIntegrityCard[\s\S]*mountPatientPostSurgeryChrome|mountPatientPostSurgeryChrome[\s\S]*GraftIntegrityCard/);
    // Pre-surgery branch must not render Months Post-op / Audit Source inline
    const preBranch = pageSrc.slice(
      pageSrc.indexOf("mountPatientPreSurgeryChrome && patientCaseDashboardModel"),
      pageSrc.indexOf(") : (", pageSrc.indexOf("mountPatientPreSurgeryChrome && patientCaseDashboardModel"))
    );
    assert.ok(!preBranch.includes("Months Post-op"));
    assert.ok(!preBranch.includes("Audit Source"));
    assert.ok(!preBranch.includes("GraftIntegrityCard"));
    assert.ok(!preBranch.includes("Submit for audit"));
  });

  it("PatientPreSurgeryCaseDashboard source never embeds forbidden post-surgery chrome", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/patient/PatientPreSurgeryCaseDashboard.tsx"),
      "utf8"
    );
    assert.equal(preSurgeryDashboardContainsForbiddenChrome(src), false);
    assert.match(src, /PreSurgeryPlanningAssessmentCard/);
    assert.match(src, /questionnaireLabel/);
    assert.match(src, /clinicContributionTitle/);
    assert.match(src, /reportCardTitle/);
    assert.match(src, /patientReviewPathway="pre_surgery"/);
  });

  it("resolvePatientCaseDashboardNextAction covers photo incomplete for pre_surgery", () => {
    const action = resolvePatientCaseDashboardNextAction({
      pathway: "pre_surgery",
      photoProgress: {
        completedCount: 1,
        totalRequired: 5,
        percent: 20,
        isComplete: false,
        missingKeys: ["preop_front"],
        missingLabels: ["Front"],
      },
      questionsComplete: false,
      deliveryPhase: "draft",
      caseId: "x",
    });
    assert.equal(action.id, "complete_photos");
    assert.equal(action.title, "Complete Your Photos");
  });
});
