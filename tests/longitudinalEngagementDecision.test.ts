/**
 * FI-OUTCOME-INTELLIGENCE-1D — Event eligibility + messaging safety (pure decision).
 * Run: pnpm exec tsx --test tests/longitudinalEngagementDecision.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  evaluateEngagementEligibility,
  buildReminderEvent,
  revalidateReminderAgainstMilestone,
  buildDedupeKey,
  buildStateFingerprint,
} from "@/lib/outcomeIntelligence/longitudinalEngagementDecision";
import {
  assertReminderCopySafe,
  scanMessageForForbiddenLanguage,
} from "@/lib/outcomeIntelligence/longitudinalEngagementSafety";
import {
  renderReminderMessage,
  FORBIDDEN_ENGAGEMENT_LANGUAGE,
} from "@/lib/outcomeIntelligence/longitudinalEngagementTemplates";
import { getEngagementPolicy } from "@/lib/outcomeIntelligence/longitudinalEngagementPolicy";
import type { CanonicalEngagementMilestoneInput } from "@/lib/outcomeIntelligence/longitudinalEngagementTypes";

function baseInput(
  overrides: Partial<CanonicalEngagementMilestoneInput> = {}
): CanonicalEngagementMilestoneInput {
  return {
    projectionSnapshotId: "proj-1",
    caseId: "case-1",
    patientId: "patient-1",
    stage: "month_6",
    targetDate: "2025-07-15",
    windowStart: "2025-06-15",
    windowEnd: "2025-08-14",
    status: "future",
    missingRequiredEvidenceRoles: ["followup_front", "followup_top"],
    missingRequiredLabels: ["Front View", "Top View"],
    observationSnapshotId: null,
    reviewAvailable: false,
    nextAction: { type: "wait", href: null },
    capturePolicyVersion: "fi-outcome-capture-plan-v1",
    captureProtocolVersion: "fi-outcome-capture-protocol-v1",
    planCreatedAt: "2025-01-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("FI-OUTCOME-INTELLIGENCE-1D eligibility", () => {
  it("1. future milestone outside pre-window → no event", () => {
    const r = evaluateEngagementEligibility(
      baseInput({ status: "future" }),
      "2025-01-20T00:00:00.000Z"
    );
    assert.equal(r.eligible, false);
    if (r.eligible) return;
    assert.equal(r.code, "NOT_YET_ELIGIBLE");
  });

  it("2. pre-window timing → upcoming_window", () => {
    const r = evaluateEngagementEligibility(
      baseInput({
        status: "future",
        nextAction: { type: "wait", href: null },
      }),
      "2025-06-10T00:00:00.000Z"
    );
    assert.equal(r.eligible, true);
    if (!r.eligible) return;
    assert.equal(r.eventType, "upcoming_window");
  });

  it("3. due → capture_due", () => {
    const r = evaluateEngagementEligibility(
      baseInput({
        status: "due",
        missingRequiredEvidenceRoles: ["followup_front"],
        missingRequiredLabels: ["Front View"],
        nextAction: {
          type: "upload_followup_images",
          href: "/cases/case-1/patient/photos",
        },
      }),
      "2025-06-20T00:00:00.000Z"
    );
    assert.equal(r.eligible, true);
    if (!r.eligible) return;
    assert.equal(r.eventType, "capture_due");
  });

  it("4. partial → evidence_incomplete", () => {
    const r = evaluateEngagementEligibility(
      baseInput({
        status: "evidence_incomplete",
        evidenceFirstPresentAt: "2025-06-16T00:00:00.000Z",
        missingRequiredEvidenceRoles: ["followup_top", "followup_recipient_closeup"],
        missingRequiredLabels: ["Top View", "Recipient Close-up"],
        nextAction: {
          type: "complete_followup_images",
          href: "/cases/case-1/patient/photos",
        },
      }),
      "2025-06-22T00:00:00.000Z"
    );
    assert.equal(r.eligible, true);
    if (!r.eligible) return;
    assert.equal(r.eventType, "evidence_incomplete");
  });

  it("5. ready → ready_for_review", () => {
    const r = evaluateEngagementEligibility(
      baseInput({
        status: "ready_for_review",
        missingRequiredEvidenceRoles: [],
        missingRequiredLabels: [],
        nextAction: { type: "wait_for_review", href: null },
      }),
      "2025-07-01T00:00:00.000Z"
    );
    assert.equal(r.eligible, true);
    if (!r.eligible) return;
    assert.equal(r.eventType, "ready_for_review");
  });

  it("6. observed + review available → review_available", () => {
    const r = evaluateEngagementEligibility(
      baseInput({
        status: "observed",
        observationSnapshotId: "obs-1",
        reviewAvailable: true,
        missingRequiredEvidenceRoles: [],
        missingRequiredLabels: [],
        nextAction: {
          type: "view_review",
          href: "/cases/case-1/patient",
        },
      }),
      "2025-08-01T00:00:00.000Z"
    );
    assert.equal(r.eligible, true);
    if (!r.eligible) return;
    assert.equal(r.eventType, "review_available");
  });

  it("7. missed → late_capture_recovery", () => {
    const r = evaluateEngagementEligibility(
      baseInput({
        status: "missed",
        nextAction: {
          type: "upload_followup_images",
          href: "/cases/case-1/patient/photos",
        },
      }),
      "2025-08-22T00:00:00.000Z"
    );
    assert.equal(r.eligible, true);
    if (!r.eligible) return;
    assert.equal(r.eventType, "late_capture_recovery");
    assert.equal(r.recoveryWave, 1);
  });
});

describe("FI-OUTCOME-INTELLIGENCE-1D timing / expiration", () => {
  it("10. incomplete delay respected", () => {
    const early = evaluateEngagementEligibility(
      baseInput({
        status: "evidence_incomplete",
        evidenceFirstPresentAt: "2025-06-20T00:00:00.000Z",
      }),
      "2025-06-22T00:00:00.000Z"
    );
    assert.equal(early.eligible, false);

    const ready = evaluateEngagementEligibility(
      baseInput({
        status: "evidence_incomplete",
        evidenceFirstPresentAt: "2025-06-20T00:00:00.000Z",
      }),
      "2025-06-26T00:00:00.000Z"
    );
    assert.equal(ready.eligible, true);
  });

  it("11. recovery timing respected (wave 2)", () => {
    const r = evaluateEngagementEligibility(
      baseInput({ status: "missed" }),
      "2025-09-05T00:00:00.000Z"
    );
    assert.equal(r.eligible, true);
    if (!r.eligible) return;
    assert.equal(r.recoveryWave, 2);
  });

  it("12. event expiration set on upcoming", () => {
    const elig = evaluateEngagementEligibility(
      baseInput({ status: "future" }),
      "2025-06-10T00:00:00.000Z"
    );
    assert.equal(elig.eligible, true);
    if (!elig.eligible) return;
    const event = buildReminderEvent({
      id: "e1",
      input: baseInput({ status: "future" }),
      eligibility: elig,
      decisionAt: "2025-06-10T00:00:00.000Z",
    });
    assert.ok(event.expiresAt?.startsWith("2025-06-15"));
  });

  it("13. injected now deterministic", () => {
    const a = evaluateEngagementEligibility(
      baseInput({ status: "due" }),
      "2025-06-20T12:00:00.000Z"
    );
    const b = evaluateEngagementEligibility(
      baseInput({ status: "due" }),
      "2025-06-20T12:00:00.000Z"
    );
    assert.deepEqual(a, b);
  });
});

describe("FI-OUTCOME-INTELLIGENCE-1D dedupe fingerprints", () => {
  it("state change yields different fingerprint / dedupe", () => {
    const a = buildStateFingerprint({
      status: "due",
      missingRequiredCount: 3,
      reviewAvailable: false,
      recoveryWave: null,
    });
    const b = buildStateFingerprint({
      status: "evidence_incomplete",
      missingRequiredCount: 2,
      reviewAvailable: false,
      recoveryWave: null,
    });
    assert.notEqual(a, b);
    const ka = buildDedupeKey({
      projectionSnapshotId: "p",
      stage: "month_6",
      eventType: "capture_due",
      policyVersion: "fi-outcome-engagement-v1",
      stateFingerprint: a,
    });
    const kb = buildDedupeKey({
      projectionSnapshotId: "p",
      stage: "month_6",
      eventType: "evidence_incomplete",
      policyVersion: "fi-outcome-engagement-v1",
      stateFingerprint: b,
    });
    assert.notEqual(ka, kb);
  });
});

describe("FI-OUTCOME-INTELLIGENCE-1D send-time revalidation (pure)", () => {
  it("19. queued due suppressed if ready", () => {
    const r = revalidateReminderAgainstMilestone({
      eventType: "capture_due",
      milestoneStatusAtDecision: "due",
      expiresAt: "2025-08-14T23:59:59.000Z",
      current: baseInput({
        status: "ready_for_review",
        missingRequiredEvidenceRoles: [],
        missingRequiredLabels: [],
      }),
      now: "2025-07-01T00:00:00.000Z",
    });
    assert.equal(r.stillValid, false);
    assert.equal(r.suppressionCode, "STATE_CHANGED");
  });

  it("20. queued incomplete suppressed if observed", () => {
    const r = revalidateReminderAgainstMilestone({
      eventType: "evidence_incomplete",
      milestoneStatusAtDecision: "evidence_incomplete",
      expiresAt: null,
      current: baseInput({
        status: "observed",
        observationSnapshotId: "obs",
        reviewAvailable: false,
      }),
      now: "2025-07-10T00:00:00.000Z",
    });
    assert.equal(r.stillValid, false);
    assert.equal(r.suppressionCode, "MILESTONE_ALREADY_OBSERVED");
  });

  it("21. stale review suppressed if invalidated", () => {
    const r = revalidateReminderAgainstMilestone({
      eventType: "review_available",
      milestoneStatusAtDecision: "observed",
      expiresAt: null,
      current: baseInput({
        status: "observed",
        reviewAvailable: false,
      }),
      now: "2025-08-01T00:00:00.000Z",
    });
    assert.equal(r.stillValid, false);
  });
});

describe("FI-OUTCOME-INTELLIGENCE-1D messaging safety", () => {
  it("26-29. templates have no forbidden language", () => {
    const policy = getEngagementPolicy();
    for (const key of Object.values(policy.messageKeys)) {
      const text = renderReminderMessage(key, {
        stageLabel: "6-Month HairAudit",
        missingRequiredCount: 2,
      });
      const hits = scanMessageForForbiddenLanguage(text);
      assert.deepEqual(hits, [], text);
      const safe = assertReminderCopySafe(key, {
        stageLabel: "6-Month HairAudit",
        missingRequiredCount: 2,
      });
      assert.equal(safe.ok, true);
    }
    assert.ok(FORBIDDEN_ENGAGEMENT_LANGUAGE.length > 5);
  });

  it("30. message variables use safe labels", () => {
    const elig = evaluateEngagementEligibility(
      baseInput({
        status: "evidence_incomplete",
        evidenceFirstPresentAt: "2025-06-10T00:00:00.000Z",
      }),
      "2025-06-20T00:00:00.000Z"
    );
    assert.equal(elig.eligible, true);
    if (!elig.eligible) return;
    const event = buildReminderEvent({
      id: "e",
      input: baseInput({
        status: "evidence_incomplete",
        evidenceFirstPresentAt: "2025-06-10T00:00:00.000Z",
      }),
      eligibility: elig,
      decisionAt: "2025-06-20T00:00:00.000Z",
    });
    assert.equal(event.messageVariables.stageLabel, "6-Month HairAudit");
    assert.equal(event.messageVariables.missingRequiredCount, 2);
    assert.match(String(event.messageVariables.missingRequiredLabels), /Front View/);
    assert.doesNotMatch(
      String(event.messageVariables.missingRequiredLabels),
      /followup_/
    );
  });

  it("31. core event is channel-neutral", () => {
    const elig = evaluateEngagementEligibility(
      baseInput({ status: "due" }),
      "2025-06-20T00:00:00.000Z"
    );
    assert.equal(elig.eligible, true);
    if (!elig.eligible) return;
    const event = buildReminderEvent({
      id: "e",
      input: baseInput({
        status: "due",
        nextAction: {
          type: "upload_followup_images",
          href: "/cases/case-1/patient/photos",
        },
      }),
      eligibility: elig,
      decisionAt: "2025-06-20T00:00:00.000Z",
    });
    const blob = JSON.stringify(event);
    assert.doesNotMatch(blob, /twilio|sendgrid|whatsapp|sms|email/i);
    assert.equal(event.action.type, "open_capture");
    assert.equal(event.action.href, "/cases/case-1/patient/photos");
  });
});
