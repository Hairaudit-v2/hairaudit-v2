/**
 * FI-OUTCOME-INTELLIGENCE-1D — Safety: channels, quiet hours, consent gap, copy.
 * Run: pnpm exec tsx --test tests/longitudinalEngagementSafety.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  COMMUNICATION_PREFERENCE_GAP,
  resolveChannelAllowance,
  isWithinQuietHours,
  assertReminderCopySafe,
  assertPatientEngagementDtoSafe,
} from "@/lib/outcomeIntelligence/longitudinalEngagementSafety";
import {
  resolveLongitudinalEngagementConfig,
  assertEngagementApplyAllowed,
  anyExternalChannelEnabled,
} from "@/lib/outcomeIntelligence/longitudinalEngagementConfig";
import { getEngagementPolicy } from "@/lib/outcomeIntelligence/longitudinalEngagementPolicy";

describe("FI-OUTCOME-INTELLIGENCE-1D channels / consent", () => {
  it("32-33. disallowed channel not delivered; no channel → no external send", () => {
    const config = resolveLongitudinalEngagementConfig({
      FI_LONGITUDINAL_ENGAGEMENT_ENABLED: "true",
    });
    assert.equal(anyExternalChannelEnabled(config), false);
    const email = resolveChannelAllowance({
      config,
      channel: "email",
    });
    assert.equal(email.allowed, false);
    const sms = resolveChannelAllowance({
      config: { ...config, smsEnabled: true },
      preferences: { smsAllowed: false },
      channel: "sms",
    });
    assert.equal(sms.allowed, false);
  });

  it("34. consent/preference respected when present", () => {
    const config = resolveLongitudinalEngagementConfig({
      FI_LONGITUDINAL_ENGAGEMENT_ENABLED: "true",
      FI_LONGITUDINAL_EMAIL_ENABLED: "true",
    });
    const ok = resolveChannelAllowance({
      config,
      preferences: { emailAllowed: true, transactionalAllowed: true },
      channel: "email",
    });
    assert.equal(ok.allowed, true);
    const blocked = resolveChannelAllowance({
      config,
      preferences: { transactionalAllowed: false },
      channel: "email",
    });
    assert.equal(blocked.allowed, false);
  });

  it("documents communication preference gap", () => {
    assert.match(COMMUNICATION_PREFERENCE_GAP, /No canonical patient communication preference/);
  });
});

describe("FI-OUTCOME-INTELLIGENCE-1D quiet hours", () => {
  it("enforces 08:00–19:00 window", () => {
    const policy = getEngagementPolicy();
    assert.equal(policy.quietHoursStartLocal, 8);
    assert.equal(policy.quietHoursEndLocal, 19);
    assert.equal(
      isWithinQuietHours({ now: "2025-06-20T10:00:00.000Z" }),
      true
    );
    assert.equal(
      isWithinQuietHours({ now: "2025-06-20T03:00:00.000Z" }),
      false
    );
    assert.equal(
      isWithinQuietHours({ now: "2025-06-20T20:00:00.000Z" }),
      false
    );
  });
});

describe("FI-OUTCOME-INTELLIGENCE-1D activation gates", () => {
  it("default flags off", () => {
    const config = resolveLongitudinalEngagementConfig({});
    assert.equal(config.enabled, false);
    assert.equal(config.emailEnabled, false);
    assert.equal(config.smsEnabled, false);
    assert.equal(config.pushEnabled, false);
  });

  it("apply requires enable + persist or channel", () => {
    const disabled = assertEngagementApplyAllowed(
      resolveLongitudinalEngagementConfig({})
    );
    assert.equal(disabled.ok, false);

    const persistOnly = assertEngagementApplyAllowed(
      resolveLongitudinalEngagementConfig({
        FI_LONGITUDINAL_ENGAGEMENT_ENABLED: "true",
        FI_LONGITUDINAL_PERSIST_EVENTS: "true",
      })
    );
    assert.equal(persistOnly.ok, true);

    const noPersist = assertEngagementApplyAllowed(
      resolveLongitudinalEngagementConfig({
        FI_LONGITUDINAL_ENGAGEMENT_ENABLED: "true",
      })
    );
    assert.equal(noPersist.ok, false);
  });
});

describe("FI-OUTCOME-INTELLIGENCE-1D DTO safety", () => {
  it("rejects internal fields and forbidden copy", () => {
    const bad = assertPatientEngagementDtoSafe({
      stage: "month_6",
      status: "due",
      message: "Your transplant is on track",
      action: null,
    });
    assert.equal(bad.ok, false);

    const good = assertReminderCopySafe("LONGITUDINAL_LATE_CAPTURE_RECOVERY", {
      stageLabel: "6-Month HairAudit",
    });
    assert.equal(good.ok, true);
  });
});
