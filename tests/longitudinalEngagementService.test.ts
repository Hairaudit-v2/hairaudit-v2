/**
 * FI-OUTCOME-INTELLIGENCE-1D — Service: dedupe, cooldown, max, revalidation, fixtures.
 * Run: pnpm exec tsx --test tests/longitudinalEngagementService.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createLongitudinalEngagementService,
  InMemoryEngagementAuditSink,
} from "@/lib/outcomeIntelligence/longitudinalEngagementService";
import { InMemoryLongitudinalEngagementEventRepository } from "@/lib/outcomeIntelligence/longitudinalEngagementRepository";
import type { LongitudinalCapturePlan } from "@/lib/outcomeIntelligence/longitudinalCaptureTypes";
import type { LongitudinalCaptureMilestone } from "@/lib/outcomeIntelligence/longitudinalCaptureTypes";
import { resolveOutcomeCohortConfig } from "@/lib/outcomeIntelligence/cohortConfig";

const __dirname = dirname(fileURLToPath(import.meta.url));

function milestone(
  overrides: Partial<LongitudinalCaptureMilestone> = {}
): LongitudinalCaptureMilestone {
  return {
    stage: "month_6",
    targetDate: "2025-07-15",
    windowStart: "2025-06-15",
    windowEnd: "2025-08-14",
    status: "due",
    requiredEvidenceRoles: [
      "followup_front",
      "followup_top",
      "followup_recipient_closeup",
    ],
    recommendedEvidenceRoles: [],
    presentEvidenceRoles: [],
    missingRequiredEvidenceRoles: [
      "followup_front",
      "followup_top",
      "followup_recipient_closeup",
    ],
    missingRecommendedEvidenceRoles: [],
    observationSnapshotId: null,
    completedAt: null,
    lateEvidencePresent: false,
    comparisonAvailable: false,
    reviewAvailable: false,
    ...overrides,
  };
}

function plan(
  overrides: Partial<LongitudinalCapturePlan> = {},
  milestones?: LongitudinalCaptureMilestone[]
): LongitudinalCapturePlan {
  return {
    id: "plan-1",
    projectionSnapshotId: "proj-1",
    caseId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    patientId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    procedureDate: "2025-01-15",
    planVersion: "fi-outcome-capture-plan-v1",
    protocolVersion: "fi-outcome-capture-protocol-v1",
    createdAt: "2025-01-20T00:00:00.000Z",
    milestones: milestones ?? [milestone()],
    ...overrides,
  };
}

function makeService(opts?: {
  dryRun?: boolean;
  enabled?: boolean;
  persistEvents?: boolean;
  allowHistoricalRecovery?: boolean;
}) {
  const repo = new InMemoryLongitudinalEngagementEventRepository();
  const audit = new InMemoryEngagementAuditSink();
  const service = createLongitudinalEngagementService({
    eventRepository: repo,
    config: {
      enabled: opts?.enabled ?? true,
      emailEnabled: false,
      smsEnabled: false,
      pushEnabled: false,
      persistEvents: opts?.persistEvents ?? true,
      isProduction: false,
    },
    auditSink: audit,
    dryRun: opts?.dryRun ?? false,
    allowHistoricalRecovery: opts?.allowHistoricalRecovery ?? false,
  });
  return { service, repo, audit };
}

describe("FI-OUTCOME-INTELLIGENCE-1D fixtures A–I", () => {
  it("Fixture A: Month 6 upcoming", async () => {
    const { service } = makeService();
    const r = await service.decideForMilestone({
      plan: plan({}, [milestone({ status: "future" })]),
      milestone: milestone({ status: "future" }),
      now: "2025-06-10T00:00:00.000Z",
    });
    assert.equal(r.ok, true);
    if (!r.ok || r.suppressed) throw new Error("expected create");
    assert.equal(r.reminder.eventType, "upcoming_window");
  });

  it("Fixture B: Month 6 due, no photos", async () => {
    const { service } = makeService();
    const r = await service.decideForMilestone({
      plan: plan(),
      milestone: milestone({ status: "due" }),
      now: "2025-06-20T00:00:00.000Z",
    });
    assert.equal(r.ok && !r.suppressed, true);
    if (!r.ok || r.suppressed) return;
    assert.equal(r.reminder.eventType, "capture_due");
  });

  it("Fixture C: Month 6 partial, 2 required missing", async () => {
    const { service } = makeService();
    const m = milestone({
      status: "evidence_incomplete",
      presentEvidenceRoles: ["followup_front"],
      missingRequiredEvidenceRoles: [
        "followup_top",
        "followup_recipient_closeup",
      ],
    });
    const r = await service.decideForMilestone({
      plan: plan({}, [m]),
      milestone: m,
      now: "2025-06-25T00:00:00.000Z",
      evidenceFirstPresentAt: "2025-06-16T00:00:00.000Z",
    });
    assert.equal(r.ok && !r.suppressed, true);
    if (!r.ok || r.suppressed) return;
    assert.equal(r.reminder.eventType, "evidence_incomplete");
    assert.equal(r.reminder.messageVariables.missingRequiredCount, 2);
  });

  it("Fixture D: complete, waiting review", async () => {
    const { service } = makeService();
    const m = milestone({
      status: "ready_for_review",
      missingRequiredEvidenceRoles: [],
      presentEvidenceRoles: [
        "followup_front",
        "followup_top",
        "followup_recipient_closeup",
      ],
    });
    const r = await service.decideForMilestone({
      plan: plan({}, [m]),
      milestone: m,
      now: "2025-07-01T00:00:00.000Z",
    });
    assert.equal(r.ok && !r.suppressed, true);
    if (!r.ok || r.suppressed) return;
    assert.equal(r.reminder.eventType, "ready_for_review");
  });

  it("Fixture E: observed, 1G available", async () => {
    const { service } = makeService();
    const m = milestone({
      status: "observed",
      observationSnapshotId: "obs-1",
      reviewAvailable: true,
      missingRequiredEvidenceRoles: [],
    });
    const r = await service.decideForMilestone({
      plan: plan({}, [m]),
      milestone: m,
      now: "2025-08-01T00:00:00.000Z",
    });
    assert.equal(r.ok && !r.suppressed, true);
    if (!r.ok || r.suppressed) return;
    assert.equal(r.reminder.eventType, "review_available");
  });

  it("Fixture F: missed / recovery", async () => {
    const { service } = makeService();
    const m = milestone({ status: "missed" });
    const r = await service.decideForMilestone({
      plan: plan({}, [m]),
      milestone: m,
      now: "2025-08-22T00:00:00.000Z",
    });
    assert.equal(r.ok && !r.suppressed, true);
    if (!r.ok || r.suppressed) return;
    assert.equal(r.reminder.eventType, "late_capture_recovery");
  });

  it("Fixture G: Month 6 missed does not suppress Month 9 due", async () => {
    const { service } = makeService();
    const m6 = milestone({
      stage: "month_6",
      status: "missed",
      targetDate: "2025-07-15",
      windowStart: "2025-06-15",
      windowEnd: "2025-08-14",
    });
    const m9 = milestone({
      stage: "month_9",
      status: "due",
      targetDate: "2025-10-15",
      windowStart: "2025-09-15",
      windowEnd: "2025-11-14",
      missingRequiredEvidenceRoles: ["followup_front"],
    });
    // Max out month 6 contacts
    for (let i = 0; i < 3; i++) {
      await service.decideForMilestone({
        plan: plan({ patientId: `p-iso-${i}` }, [m6]),
        milestone: m6,
        now: `2025-08-${22 + i}T00:00:00.000Z`,
      });
    }
    const r9 = await service.decideForMilestone({
      plan: plan({ patientId: "patient-month9" }, [m6, m9]),
      milestone: m9,
      now: "2025-09-20T00:00:00.000Z",
    });
    assert.equal(r9.ok && !r9.suppressed, true);
    if (!r9.ok || r9.suppressed) return;
    assert.equal(r9.reminder.eventType, "capture_due");
    assert.equal(r9.reminder.stage, "month_9");
  });

  it("Fixture H: queued reminder becomes stale before send", async () => {
    const { service } = makeService();
    const due = milestone({ status: "due" });
    const created = await service.decideForMilestone({
      plan: plan({}, [due]),
      milestone: due,
      now: "2025-06-20T00:00:00.000Z",
    });
    assert.equal(created.ok && !created.suppressed, true);
    if (!created.ok || created.suppressed) return;

    const ready = milestone({
      status: "ready_for_review",
      missingRequiredEvidenceRoles: [],
      presentEvidenceRoles: [
        "followup_front",
        "followup_top",
        "followup_recipient_closeup",
      ],
    });
    const reval = await service.revalidateBeforeDelivery({
      eventId: created.event.id,
      current: service.toCanonicalInput({
        plan: plan({}, [ready]),
        milestone: ready,
      }),
      now: "2025-06-25T00:00:00.000Z",
    });
    assert.equal(reval.stillValid, false);
    assert.equal(reval.suppressionCode, "STATE_CHANGED");
  });

  it("Fixture I: max reminders reached", async () => {
    const { service, repo } = makeService();
    const m = milestone({ status: "due" });
    const p = plan({}, [m]);
    // Seed 3 delivered contact events with distinct fingerprints
    for (let i = 0; i < 3; i++) {
      await repo.insert({
        id: `seed-${i}`,
        projectionSnapshotId: p.projectionSnapshotId,
        caseId: p.caseId,
        patientId: `other-patient-${i}`,
        stage: "month_6",
        eventType: "capture_due",
        reasonCode: "SEED",
        policyVersion: "fi-outcome-engagement-v1",
        dedupeKey: `seed-dedupe-${i}`,
        status: "delivered",
        decisionAt: `2025-06-1${i}T00:00:00.000Z`,
        eligibleAfter: null,
        expiresAt: null,
        deliveredAt: `2025-06-1${i}T01:00:00.000Z`,
        suppressedAt: null,
        suppressionCode: null,
        channel: null,
        deliveryProviderRef: null,
        messageKey: "LONGITUDINAL_CAPTURE_DUE",
        messageVariables: {},
        stateFingerprint: `seed-${i}`,
        milestoneStatusAtDecision: "due",
        actionType: "open_capture",
        actionHref: null,
        createdAt: `2025-06-1${i}T00:00:00.000Z`,
        updatedAt: `2025-06-1${i}T00:00:00.000Z`,
      });
    }
    const r = await service.decideForMilestone({
      plan: p,
      milestone: m,
      now: "2025-06-20T00:00:00.000Z",
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.suppressed, true);
    if (!r.suppressed) return;
    assert.equal(r.suppressionCode, "MAX_REMINDERS_REACHED");
  });
});

describe("FI-OUTCOME-INTELLIGENCE-1D dedupe / cooldown", () => {
  it("14-15. identical replay idempotent", async () => {
    const { service } = makeService();
    const m = milestone({ status: "due" });
    const p = plan({}, [m]);
    const a = await service.decideForMilestone({
      plan: p,
      milestone: m,
      now: "2025-06-20T00:00:00.000Z",
    });
    const b = await service.decideForMilestone({
      plan: p,
      milestone: m,
      now: "2025-06-20T01:00:00.000Z",
    });
    assert.equal(a.ok && !a.suppressed && a.created, true);
    assert.equal(b.ok && !b.suppressed && b.reused, true);
    if (!a.ok || a.suppressed || !b.ok || b.suppressed) return;
    assert.equal(a.event.id, b.event.id);
  });

  it("16. cooldown suppresses rapid follow-up", async () => {
    const { service } = makeService();
    const m6 = milestone({ stage: "month_6", status: "due" });
    const m3 = milestone({
      stage: "month_3",
      status: "missed",
      targetDate: "2025-04-15",
      windowStart: "2025-03-25",
      windowEnd: "2025-05-06",
    });
    const p = plan({}, [m3, m6]);
    const first = await service.decideForMilestone({
      plan: p,
      milestone: m6,
      now: "2025-06-20T00:00:00.000Z",
    });
    assert.equal(first.ok && !first.suppressed, true);
    const second = await service.decideForMilestone({
      plan: p,
      milestone: m3,
      now: "2025-06-21T00:00:00.000Z",
    });
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.suppressed, true);
    if (!second.suppressed) return;
    assert.equal(second.suppressionCode, "COOLDOWN_ACTIVE");
  });

  it("17. meaningful state change allows new event type", async () => {
    const { service } = makeService();
    const due = milestone({ status: "due" });
    const p = plan({}, [due]);
    const a = await service.decideForMilestone({
      plan: p,
      milestone: due,
      now: "2025-06-20T00:00:00.000Z",
    });
    assert.equal(a.ok && !a.suppressed, true);

    // Advance past cooldown with different patient timeline — use +73h
    const incomplete = milestone({
      status: "evidence_incomplete",
      presentEvidenceRoles: ["followup_front"],
      missingRequiredEvidenceRoles: ["followup_top", "followup_recipient_closeup"],
    });
    const b = await service.decideForMilestone({
      plan: p,
      milestone: incomplete,
      now: "2025-06-24T02:00:00.000Z",
      evidenceFirstPresentAt: "2025-06-18T00:00:00.000Z",
    });
    assert.equal(b.ok && !b.suppressed, true);
    if (!b.ok || b.suppressed) return;
    assert.equal(b.reminder.eventType, "evidence_incomplete");
  });

  it("8. upcoming generated only once", async () => {
    const { service } = makeService();
    const m = milestone({ status: "future" });
    const p = plan({}, [m]);
    const a = await service.decideForMilestone({
      plan: p,
      milestone: m,
      now: "2025-06-10T00:00:00.000Z",
    });
    const b = await service.decideForMilestone({
      plan: p,
      milestone: m,
      now: "2025-06-11T00:00:00.000Z",
    });
    assert.equal(a.ok && a.created, true);
    assert.equal(b.ok && !b.suppressed && b.reused, true);
  });
});

describe("FI-OUTCOME-INTELLIGENCE-1D feature flags / cohort separation", () => {
  it("35. disabled engine no-ops (non-dry-run)", async () => {
    const { service } = makeService({ enabled: false, dryRun: false });
    const r = await service.decideForMilestone({
      plan: plan(),
      milestone: milestone({ status: "due" }),
      now: "2025-06-20T00:00:00.000Z",
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.code, "FEATURE_DISABLED");
  });

  it("36. dry-run creates no persistent delivery when persist off", async () => {
    const { service, repo } = makeService({
      enabled: true,
      dryRun: true,
      persistEvents: false,
    });
    const r = await service.decideForMilestone({
      plan: plan(),
      milestone: milestone({ status: "due" }),
      now: "2025-06-20T00:00:00.000Z",
    });
    assert.equal(r.ok && !r.suppressed && r.created, true);
    const all = await repo.list();
    assert.equal(all.length, 0);
  });

  it("37. apply fails closed without enable flag", () => {
    const { service } = makeService({ enabled: false, persistEvents: false });
    const gate = service.assertApplyAllowed();
    assert.equal(gate.ok, false);
  });

  it("works with cohort governance false", () => {
    const cfg = resolveOutcomeCohortConfig({
      FI_OUTCOME_COHORT_ENABLED: "false",
      FI_OUTCOME_COHORT_GOVERNANCE_APPROVED: "false",
    });
    assert.equal(cfg.enabled, false);
    assert.equal(cfg.governanceApproved, false);
    const { service } = makeService({ enabled: true });
    assert.ok(service);
  });

  it("22. changed missing-count suppresses obsolete text", async () => {
    const { service } = makeService();
    const m = milestone({
      status: "evidence_incomplete",
      missingRequiredEvidenceRoles: ["followup_top", "followup_recipient_closeup"],
    });
    const created = await service.decideForMilestone({
      plan: plan({}, [m]),
      milestone: m,
      now: "2025-06-25T00:00:00.000Z",
      evidenceFirstPresentAt: "2025-06-16T00:00:00.000Z",
    });
    assert.equal(created.ok && !created.suppressed, true);
    if (!created.ok || created.suppressed) return;

    const updated = milestone({
      status: "evidence_incomplete",
      missingRequiredEvidenceRoles: ["followup_recipient_closeup"],
    });
    const reval = await service.revalidateBeforeDelivery({
      eventId: created.event.id,
      current: service.toCanonicalInput({
        plan: plan({}, [updated]),
        milestone: updated,
      }),
      now: "2025-06-26T00:00:00.000Z",
    });
    assert.equal(reval.stillValid, false);
    assert.equal(reval.suppressionCode, "STATE_CHANGED");
  });
});

describe("FI-OUTCOME-INTELLIGENCE-1D patient DTO / RLS migration", () => {
  it("42. patient DTO excludes internal metadata", async () => {
    const { service } = makeService();
    const m = milestone({ status: "due" });
    const decided = await service.decideForMilestone({
      plan: plan({}, [m]),
      milestone: m,
      now: "2025-06-20T00:00:00.000Z",
    });
    assert.equal(decided.ok && !decided.suppressed, true);
    if (!decided.ok || decided.suppressed) return;
    const dto = service.toPatientEngagementDto({
      milestone: m,
      caseId: plan().caseId,
      event: decided.event,
    });
    const safe = service.assertPatientDtoSafe(dto);
    assert.equal(safe.ok, true, JSON.stringify(safe));
    assert.equal(
      dto.action?.href,
      `/cases/${plan().caseId}/patient/follow-up/month_6`
    );
  });

  it("38-41. migration SQL enforces service-role RLS", () => {
    const sql = readFileSync(
      join(
        __dirname,
        "../supabase/migrations/20260727200000_hairaudit_longitudinal_engagement_events.sql"
      ),
      "utf8"
    );
    assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
    assert.match(sql, /service_role/);
    assert.match(sql, /REVOKE ALL ON public\.hairaudit_longitudinal_engagement_events FROM anon/);
    assert.match(
      sql,
      /REVOKE ALL ON public\.hairaudit_longitudinal_engagement_events FROM authenticated/
    );
    assert.match(sql, /uq_hairaudit_longitudinal_engagement_events_dedupe/);
  });
});
