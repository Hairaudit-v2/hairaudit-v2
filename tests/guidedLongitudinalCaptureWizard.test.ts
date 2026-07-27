/**
 * FI-OUTCOME-INTELLIGENCE-1E — Wizard / resume / CTA tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GuidedLongitudinalCaptureDto } from "../src/lib/outcomeIntelligence/guidedCaptureDto";
import {
  allRequiredComplete,
  canUploadForMilestoneStatus,
  firstMissingRequiredView,
  nextViewStep,
  primaryCtaLabel,
  resolveGuidedCaptureInitialStep,
} from "../src/lib/outcomeIntelligence/guidedCaptureWizard";

function dto(
  partial: Partial<GuidedLongitudinalCaptureDto> &
    Pick<GuidedLongitudinalCaptureDto, "status" | "views">
): GuidedLongitudinalCaptureDto {
  return {
    stage: "month_6",
    title: "Your 6-Month HairAudit",
    subtitle: "subtitle",
    targetDate: "2025-07-15",
    windowStart: "2025-06-15",
    windowEnd: "2025-08-14",
    statusMessage: "msg",
    progress: {
      requiredComplete: partial.views.filter((v) => v.required && v.complete).length,
      requiredTotal: partial.views.filter((v) => v.required).length,
      recommendedComplete: partial.views.filter((v) => !v.required && v.complete)
        .length,
      recommendedTotal: partial.views.filter((v) => !v.required).length,
    },
    nextAction: { type: "upload_followup_images", label: "x", href: "/x" },
    photographyGuidance: [],
    representativeCaptureNote: "rep",
    recommendedNote: "rec",
    referenceMatchNote: "Try to match this angle.",
    earlyUploadNote: null,
    capturePolicyVersion: "fi-outcome-capture-plan-v1",
    protocolVersion: "fi-outcome-capture-protocol-v1",
    uiEnabled: true,
    ...partial,
  };
}

const emptyView = (key: string, required: boolean, complete: boolean) => ({
  key,
  label: key,
  required,
  complete,
  whyRequested: "why",
  instructions: ["Hold steady"],
  referenceImage: {
    available: false,
    url: null,
    label: null,
    source: null,
  },
  currentImage: { available: false, url: null, uploadId: null },
  uploadCategory: `postop_month6_${key === "donor_rear" ? "donor" : key}`,
});

describe("guided capture wizard", () => {
  it("11. due starts at entry; start jumps to first missing required", () => {
    const d = dto({
      status: "due",
      views: [
        emptyView("front", true, false),
        emptyView("top", true, false),
        emptyView("crown", false, false),
      ],
    });
    assert.equal(resolveGuidedCaptureInitialStep(d).mode, "status_only");
    assert.equal(primaryCtaLabel("due"), "Start photos");
    const missing = firstMissingRequiredView(d.views);
    assert.equal(missing?.key, "front");
  });

  it("7/12. incomplete resumes missing required; skips completed", () => {
    const d = dto({
      status: "evidence_incomplete",
      views: [
        emptyView("front", true, true),
        emptyView("top", true, false),
        emptyView("recipient_closeup", true, false),
      ],
    });
    const step = resolveGuidedCaptureInitialStep(d);
    assert.equal(step.mode, "view");
    if (step.mode === "view") assert.equal(step.viewKey, "top");
    assert.equal(primaryCtaLabel("evidence_incomplete"), "Continue photos");
  });

  it("13. recommended views do not block finish", () => {
    const views = [
      emptyView("front", true, true),
      emptyView("top", true, true),
      emptyView("donor_rear", false, false),
    ];
    assert.equal(allRequiredComplete(views), true);
  });

  it("14. all required complete shows review", () => {
    const d = dto({
      status: "evidence_incomplete",
      views: [
        emptyView("front", true, true),
        emptyView("top", true, true),
        emptyView("donor_rear", false, false),
      ],
    });
    assert.equal(resolveGuidedCaptureInitialStep(d).mode, "review");
  });

  it("15. next after last view goes to review", () => {
    const views = [
      emptyView("front", true, true),
      emptyView("top", true, true),
    ];
    assert.equal(nextViewStep(views, "top").mode, "review");
  });

  it("ready/observed stop upload pressure", () => {
    assert.equal(canUploadForMilestoneStatus("ready_for_review", false), false);
    assert.equal(canUploadForMilestoneStatus("observed", false), false);
    assert.equal(canUploadForMilestoneStatus("due", false), true);
    assert.equal(canUploadForMilestoneStatus("missed", false), true);
    assert.equal(canUploadForMilestoneStatus("future", false), false);
    assert.equal(primaryCtaLabel("missed"), "Add photos");
    assert.equal(primaryCtaLabel("ready_for_review"), "Return to HairAudit");
  });
});
