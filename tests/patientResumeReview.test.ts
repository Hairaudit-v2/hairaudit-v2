import { describe, it } from "node:test";
import assert from "node:assert";
import {
  buildPatientResumeCaseContext,
  buildPatientResumeReviewViewModel,
  comparePatientResumeCases,
  isPathwayMinimalIntakeComplete,
  PATIENT_PATHWAY_DISPLAY_LABELS,
  resolvePatientResumeStep,
  selectPrimaryPatientResumeCase,
  shouldShowPatientDashboardAnalytics,
} from "../src/lib/patient/patientResumeReview";

function draftCase(overrides: Record<string, unknown> = {}) {
  return {
    id: "case-1",
    status: "draft",
    submitted_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    patient_review_pathway: "post_surgery",
    ...overrides,
  };
}

function ctxFor(args: {
  case?: ReturnType<typeof draftCase>;
  uploads?: Array<{ type?: string | null }>;
  patientAnswers?: Record<string, unknown>;
  hasReportPdf?: boolean;
}) {
  return buildPatientResumeCaseContext({
    case: args.case ?? draftCase(),
    uploads: args.uploads ?? [],
    patientAnswers: args.patientAnswers ?? {},
    hasReportPdf: args.hasReportPdf ?? false,
  });
}

describe("patientResumeReview", () => {
  it("returns photos_incomplete when required uploads are missing", () => {
    const ctx = ctxFor({ uploads: [] });
    assert.strictEqual(ctx.step, "photos_incomplete");
    const model = buildPatientResumeReviewViewModel({ contexts: [ctx] });
    assert.strictEqual(model.primaryCtaLabel, "Continue Uploading Photos");
    assert.match(model.primaryCtaHref, /\/patient\/photos$/);
    assert.match(model.stepLabel, /Step 1 of 4/);
  });

  it("returns questions_incomplete when photos are complete but intake is not", () => {
    const uploads = [
      { type: "patient_photo:preop_front" },
      { type: "patient_photo:current_recipient_closeup" },
      { type: "patient_photo:preop_top" },
      { type: "patient_photo:preop_donor_rear" },
      { type: "patient_photo:preop_donor_closeup" },
    ];
    const ctx = ctxFor({ uploads, patientAnswers: {} });
    assert.strictEqual(ctx.step, "questions_incomplete");
    const model = buildPatientResumeReviewViewModel({ contexts: [ctx] });
    assert.strictEqual(model.primaryCtaLabel, "Continue Questions");
    assert.match(model.primaryCtaHref, /\/patient\/questions$/);
    assert.match(model.stepLabel, /Step 2 of 4/);
  });

  it("returns contact_pending when photos and minimal questions are complete", () => {
    const uploads = [
      { type: "patient_photo:preop_front" },
      { type: "patient_photo:current_recipient_closeup" },
      { type: "patient_photo:preop_top" },
      { type: "patient_photo:preop_donor_rear" },
      { type: "patient_photo:preop_donor_closeup" },
    ];
    const patientAnswers = {
      clinic_name: "Example Clinic",
      clinic_country: "TR",
      clinic_city: "Istanbul",
      procedure_date: "2025-01-01",
      procedure_type: "FUE",
    };
    assert.strictEqual(isPathwayMinimalIntakeComplete("post_surgery", patientAnswers), true);
    const ctx = ctxFor({ uploads, patientAnswers });
    assert.strictEqual(ctx.step, "contact_pending");
    const model = buildPatientResumeReviewViewModel({ contexts: [ctx] });
    assert.strictEqual(model.primaryCtaLabel, "Send My Report");
    assert.match(model.primaryCtaHref, /\/patient\/contact$/);
    assert.match(model.stepLabel, /Step 3 of 4/);
  });

  it("returns processing for submitted cases without a delivered report", () => {
    const ctx = ctxFor({
      case: draftCase({ status: "processing", submitted_at: "2026-06-01T00:00:00.000Z" }),
    });
    assert.strictEqual(ctx.step, "processing");
    const model = buildPatientResumeReviewViewModel({ contexts: [ctx] });
    assert.strictEqual(model.primaryCtaLabel, "View Processing Progress");
    assert.strictEqual(model.primaryCtaHref, "/cases/case-1");
    assert.match(model.stepLabel, /Step 4 of 4/);
  });

  it("returns report_ready when PDF is available", () => {
    const ctx = ctxFor({
      case: draftCase({ status: "complete", submitted_at: "2026-06-01T00:00:00.000Z" }),
      hasReportPdf: true,
    });
    assert.strictEqual(ctx.step, "report_ready");
    const model = buildPatientResumeReviewViewModel({ contexts: [ctx] });
    assert.strictEqual(model.primaryCtaLabel, "View My Report");
    assert.strictEqual(model.primaryCtaHref, "/cases/case-1");
    assert.strictEqual(model.stepLabel, "Your review is ready");
  });

  it("shows pathway choice when there are no cases", () => {
    const model = buildPatientResumeReviewViewModel({ contexts: [] });
    assert.strictEqual(model.step, "no_open_case");
    assert.strictEqual(model.headline, "Start a New Review");
    assert.strictEqual(model.primaryCtaLabel, "");
  });

  it("prefers incomplete photos over processing cases", () => {
    const photosCtx = ctxFor({
      case: draftCase({ id: "draft", created_at: "2026-05-01T00:00:00.000Z" }),
      uploads: [],
    });
    const processingCtx = ctxFor({
      case: draftCase({
        id: "processing",
        status: "processing",
        submitted_at: "2026-06-02T00:00:00.000Z",
        created_at: "2026-06-02T00:00:00.000Z",
      }),
    });
    const primary = selectPrimaryPatientResumeCase([processingCtx, photosCtx]);
    assert.strictEqual(primary?.case.id, "draft");
    assert.strictEqual(primary?.step, "photos_incomplete");
  });

  it("uses most recently updated case among equal priority steps", () => {
    const older = ctxFor({
      case: draftCase({ id: "older", created_at: "2026-05-01T00:00:00.000Z" }),
      uploads: [],
    });
    const newer = ctxFor({
      case: draftCase({ id: "newer", created_at: "2026-06-02T00:00:00.000Z" }),
      uploads: [],
    });
    assert.ok(comparePatientResumeCases(newer, older) < 0);
    assert.ok(comparePatientResumeCases(older, newer) > 0);
    const primary = selectPrimaryPatientResumeCase([older, newer]);
    assert.strictEqual(primary?.case.id, "newer");
  });

  it("renders pre_surgery and post_surgery pathway labels", () => {
    const pre = buildPatientResumeReviewViewModel({
      contexts: [ctxFor({ case: draftCase({ patient_review_pathway: "pre_surgery" }) })],
    });
    const post = buildPatientResumeReviewViewModel({
      contexts: [ctxFor({ case: draftCase({ patient_review_pathway: "post_surgery" }) })],
    });
    assert.strictEqual(pre.pathwayLabel, PATIENT_PATHWAY_DISPLAY_LABELS.pre_surgery);
    assert.strictEqual(post.pathwayLabel, PATIENT_PATHWAY_DISPLAY_LABELS.post_surgery);
    assert.match(pre.headline, /Pre-Surgery Review/);
    assert.match(post.headline, /Post-Surgery Audit/);
  });

  it("hides dashboard analytics for draft resume steps", () => {
    assert.strictEqual(shouldShowPatientDashboardAnalytics("photos_incomplete"), false);
    assert.strictEqual(shouldShowPatientDashboardAnalytics("questions_incomplete"), false);
    assert.strictEqual(shouldShowPatientDashboardAnalytics("contact_pending"), false);
    assert.strictEqual(shouldShowPatientDashboardAnalytics("processing"), true);
    assert.strictEqual(shouldShowPatientDashboardAnalytics("report_ready"), true);
  });

  it("resolvePatientResumeStep respects delivery phase over draft gates", () => {
    assert.strictEqual(
      resolvePatientResumeStep({
        photoProgress: { isComplete: false, completedCount: 0, totalRequired: 5, percent: 0, missingKeys: [], missingLabels: [] },
        questionsComplete: false,
        deliveryPhase: "processing",
      }),
      "processing"
    );
    assert.strictEqual(
      resolvePatientResumeStep({
        photoProgress: { isComplete: true, completedCount: 5, totalRequired: 5, percent: 100, missingKeys: [], missingLabels: [] },
        questionsComplete: true,
        deliveryPhase: "delivered",
      }),
      "report_ready"
    );
  });
});
