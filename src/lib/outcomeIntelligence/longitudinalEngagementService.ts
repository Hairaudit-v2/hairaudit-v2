/**
 * FI-OUTCOME-INTELLIGENCE-1D — LongitudinalEngagementService.
 *
 * Loads canonical 1C milestone state, evaluates reminder policy, enforces
 * cooldown/dedupe/max-count, persists channel-neutral events, revalidates
 * before delivery. Notification provider logic stays elsewhere.
 *
 * Independent of FI_OUTCOME_COHORT_* governance.
 */

import { randomUUID } from "node:crypto";
import { patientSafeLabelForRole } from "./longitudinalCapturePolicy";
import { deriveNextAction } from "./longitudinalCaptureDto";
import type { LongitudinalCaptureMilestone } from "./longitudinalCaptureTypes";
import type { LongitudinalCapturePlan } from "./longitudinalCaptureTypes";
import type { LongitudinalEvidenceRole } from "@/lib/projection/types";
import {
  anyExternalChannelEnabled,
  assertEngagementApplyAllowed,
  resolveLongitudinalEngagementConfig,
  type LongitudinalEngagementConfig,
} from "./longitudinalEngagementConfig";
import {
  buildReminderEvent,
  evaluateEngagementEligibility,
  isContactEventType,
  mapReminderActionToPatientAction,
  patientActionLabel,
  revalidateReminderAgainstMilestone,
} from "./longitudinalEngagementDecision";
import { getEngagementPolicy } from "./longitudinalEngagementPolicy";
import type { LongitudinalEngagementEventRepository } from "./longitudinalEngagementRepository";
import {
  assertPatientEngagementDtoSafe,
  resolveChannelAllowance,
  type CommunicationPreferenceSnapshot,
} from "./longitudinalEngagementSafety";
import { renderReminderMessage } from "./longitudinalEngagementTemplates";
import {
  ENGAGEMENT_POLICY_VERSION,
  type CanonicalEngagementMilestoneInput,
  type EngagementBatchHealth,
  type EngagementDecisionResult,
  type LongitudinalEngagementAuditEvent,
  type LongitudinalEngagementEventRecord,
  type PatientLongitudinalEngagementDto,
  type RevalidationResult,
} from "./longitudinalEngagementTypes";

export type LongitudinalEngagementAuditSink = {
  write(event: LongitudinalEngagementAuditEvent): void | Promise<void>;
};

export class InMemoryEngagementAuditSink implements LongitudinalEngagementAuditSink {
  readonly events: LongitudinalEngagementAuditEvent[] = [];
  write(event: LongitudinalEngagementAuditEvent): void {
    this.events.push(event);
  }
}

export type LongitudinalEngagementServiceDeps = {
  eventRepository: LongitudinalEngagementEventRepository;
  config?: LongitudinalEngagementConfig;
  auditSink?: LongitudinalEngagementAuditSink;
  /**
   * When true, allow evaluating historical plans (operator campaign).
   * Default false — blocks historical blast.
   */
  allowHistoricalRecovery?: boolean;
  /** Dry-run: decide without persisting (unless persistDryRunArtifacts). */
  dryRun?: boolean;
};

function toCanonicalInput(args: {
  plan: LongitudinalCapturePlan;
  milestone: LongitudinalCaptureMilestone;
  evidenceFirstPresentAt?: string | null;
}): CanonicalEngagementMilestoneInput {
  const m = args.milestone;
  const missingLabels = m.missingRequiredEvidenceRoles.map((role) =>
    patientSafeLabelForRole(role as LongitudinalEvidenceRole)
  );
  const nextAction = deriveNextAction({
    status: m.status,
    stage: m.stage,
    caseId: args.plan.caseId,
    reviewAvailable: m.reviewAvailable,
    missingRequiredCount: m.missingRequiredEvidenceRoles.length,
  });
  return {
    projectionSnapshotId: args.plan.projectionSnapshotId,
    caseId: args.plan.caseId,
    patientId: args.plan.patientId,
    stage: m.stage,
    targetDate: m.targetDate,
    windowStart: m.windowStart,
    windowEnd: m.windowEnd,
    status: m.status,
    missingRequiredEvidenceRoles: m.missingRequiredEvidenceRoles,
    missingRequiredLabels: missingLabels,
    observationSnapshotId: m.observationSnapshotId,
    reviewAvailable: m.reviewAvailable,
    nextAction: { type: nextAction.type, href: nextAction.href },
    capturePolicyVersion: args.plan.planVersion,
    captureProtocolVersion: args.plan.protocolVersion,
    evidenceFirstPresentAt: args.evidenceFirstPresentAt ?? null,
    planCreatedAt: args.plan.createdAt,
  };
}

export class LongitudinalEngagementService {
  private readonly config: LongitudinalEngagementConfig;
  private readonly dryRun: boolean;
  private readonly allowHistoricalRecovery: boolean;

  constructor(private readonly deps: LongitudinalEngagementServiceDeps) {
    this.config =
      deps.config ?? resolveLongitudinalEngagementConfig(process.env);
    this.dryRun = deps.dryRun ?? false;
    this.allowHistoricalRecovery = deps.allowHistoricalRecovery ?? false;
  }

  /**
   * Evaluate + optionally persist a channel-neutral reminder for one milestone.
   */
  async decideForMilestone(args: {
    plan: LongitudinalCapturePlan;
    milestone: LongitudinalCaptureMilestone;
    now: string;
    evidenceFirstPresentAt?: string | null;
    preferences?: CommunicationPreferenceSnapshot | null;
  }): Promise<EngagementDecisionResult> {
    if (!this.config.enabled && !this.dryRun) {
      return {
        ok: false,
        code: "FEATURE_DISABLED",
        reason: "FI_LONGITUDINAL_ENGAGEMENT_ENABLED is not true.",
      };
    }

    const input = toCanonicalInput({
      plan: args.plan,
      milestone: args.milestone,
      evidenceFirstPresentAt: args.evidenceFirstPresentAt,
    });

    // Historical blast guard: plan created long after windows closed unless operator opts in
    if (
      !this.allowHistoricalRecovery &&
      input.planCreatedAt &&
      this.isHistoricalBlastCandidate(input, args.now)
    ) {
      return this.suppressResult({
        code: "HISTORICAL_BLAST_BLOCKED",
        reason:
          "Historical milestone engagement blocked by default (no automatic backfill blast).",
        input,
        now: args.now,
      });
    }

    const eligibility = evaluateEngagementEligibility(input, args.now);
    if (!eligibility.eligible) {
      await this.audit({
        type: "LONGITUDINAL_REMINDER_SUPPRESSED",
        at: args.now,
        projectionSnapshotId: input.projectionSnapshotId,
        stage: input.stage,
        eventType: null,
        suppressionCode: eligibility.code,
      });
      return {
        ok: true,
        created: false,
        reused: false,
        suppressed: true,
        suppressionCode: eligibility.code,
        reason: eligibility.reason,
        event: null,
      };
    }

    const reminder = buildReminderEvent({
      id: randomUUID(),
      input,
      eligibility,
      decisionAt: args.now,
    });

    // Idempotent replay
    const existing = await this.deps.eventRepository.findByDedupeKey(
      reminder.dedupeKey
    );
    if (existing) {
      await this.audit({
        type: "LONGITUDINAL_REMINDER_DECIDED",
        at: args.now,
        projectionSnapshotId: input.projectionSnapshotId,
        stage: input.stage,
        eventType: reminder.eventType,
        suppressionCode: "DUPLICATE",
      });
      return {
        ok: true,
        created: false,
        reused: true,
        suppressed: false,
        event: existing,
        reminder: {
          ...reminder,
          id: existing.id,
        },
      };
    }

    // Cooldown: 1 longitudinal contact per patient / 72h
    const policy = getEngagementPolicy();
    const cooldownSince = new Date(
      new Date(args.now).getTime() - policy.patientCooldownHours * 3600_000
    ).toISOString();
    const recent = await this.deps.eventRepository.list({
      patientId: input.patientId,
      statuses: ["pending", "delivered"],
      sinceDecisionAt: cooldownSince,
    });
    const recentContacts = recent.filter((e) => isContactEventType(e.eventType));
    if (
      isContactEventType(reminder.eventType) &&
      recentContacts.length > 0
    ) {
      return this.suppressAndMaybePersist({
        code: "COOLDOWN_ACTIVE",
        reason: `Patient cooldown active (${policy.patientCooldownHours}h).`,
        input,
        reminder,
        now: args.now,
      });
    }

    // Max reminders per milestone (contacts only; review_available separate)
    if (isContactEventType(reminder.eventType)) {
      const milestoneEvents = await this.deps.eventRepository.list({
        projectionSnapshotId: input.projectionSnapshotId,
        stage: input.stage,
        statuses: ["pending", "delivered"],
      });
      const contactCount = milestoneEvents.filter((e) =>
        isContactEventType(e.eventType)
      ).length;
      if (contactCount >= policy.maxContactRemindersPerMilestone) {
        return this.suppressAndMaybePersist({
          code: "MAX_REMINDERS_REACHED",
          reason: `Max ${policy.maxContactRemindersPerMilestone} contacts for milestone.`,
          input,
          reminder,
          now: args.now,
        });
      }
    } else if (reminder.eventType === "review_available") {
      const prior = await this.deps.eventRepository.list({
        projectionSnapshotId: input.projectionSnapshotId,
        stage: input.stage,
        eventType: "review_available",
        statuses: ["pending", "delivered"],
      });
      if (prior.length > 0) {
        return {
          ok: true,
          created: false,
          reused: true,
          suppressed: false,
          event: prior[0]!,
          reminder: { ...reminder, id: prior[0]!.id },
        };
      }
    }

    // Channel preference check only matters for external delivery path —
    // core event remains channel-neutral and may still be persisted.
    void args.preferences;
    void resolveChannelAllowance;

    const record = this.toRecord(reminder, input, "pending");

    if (this.dryRun && !this.config.persistEvents) {
      await this.audit({
        type: "LONGITUDINAL_REMINDER_DECIDED",
        at: args.now,
        projectionSnapshotId: input.projectionSnapshotId,
        stage: input.stage,
        eventType: reminder.eventType,
        suppressionCode: null,
      });
      return {
        ok: true,
        created: true,
        reused: false,
        suppressed: false,
        event: record,
        reminder,
      };
    }

    if (!this.config.enabled && this.dryRun) {
      // dry-run with feature off: still return would-create without requiring enable
      await this.audit({
        type: "LONGITUDINAL_REMINDER_DECIDED",
        at: args.now,
        projectionSnapshotId: input.projectionSnapshotId,
        stage: input.stage,
        eventType: reminder.eventType,
        suppressionCode: null,
      });
      return {
        ok: true,
        created: true,
        reused: false,
        suppressed: false,
        event: record,
        reminder,
      };
    }

    try {
      const inserted = await this.deps.eventRepository.insert(record);
      await this.audit({
        type: "LONGITUDINAL_REMINDER_DECIDED",
        at: args.now,
        projectionSnapshotId: input.projectionSnapshotId,
        stage: input.stage,
        eventType: reminder.eventType,
        suppressionCode: null,
      });
      return {
        ok: true,
        created: true,
        reused: false,
        suppressed: false,
        event: inserted,
        reminder,
      };
    } catch {
      const raced = await this.deps.eventRepository.findByDedupeKey(
        reminder.dedupeKey
      );
      if (raced) {
        return {
          ok: true,
          created: false,
          reused: true,
          suppressed: false,
          event: raced,
          reminder: { ...reminder, id: raced.id },
        };
      }
      throw new Error("Failed to insert engagement event.");
    }
  }

  /**
   * Re-read 1C state and suppress stale pending events before delivery.
   */
  async revalidateBeforeDelivery(args: {
    eventId: string;
    current: CanonicalEngagementMilestoneInput;
    now: string;
  }): Promise<RevalidationResult> {
    const event = await this.deps.eventRepository.findById(args.eventId);
    if (!event) {
      throw new Error(`Engagement event not found: ${args.eventId}`);
    }

    const check = revalidateReminderAgainstMilestone({
      eventType: event.eventType,
      milestoneStatusAtDecision: event.milestoneStatusAtDecision,
      expiresAt: event.expiresAt,
      current: args.current,
      now: args.now,
    });

    // Obsolete message variables (missing count changed)
    if (
      check.stillValid &&
      event.eventType === "evidence_incomplete" &&
      Number(event.messageVariables.missingRequiredCount ?? -1) !==
        args.current.missingRequiredEvidenceRoles.length
    ) {
      const updated = await this.suppressEvent(
        event,
        "STATE_CHANGED",
        args.now
      );
      return {
        ok: true,
        stillValid: false,
        suppressionCode: "STATE_CHANGED",
        event: updated,
      };
    }

    if (!check.stillValid && check.suppressionCode) {
      const updated = await this.suppressEvent(
        event,
        check.suppressionCode,
        args.now
      );
      await this.audit({
        type: "LONGITUDINAL_REMINDER_SUPPRESSED",
        at: args.now,
        projectionSnapshotId: event.projectionSnapshotId,
        stage: event.stage,
        eventType: event.eventType,
        suppressionCode: check.suppressionCode,
      });
      return {
        ok: true,
        stillValid: false,
        suppressionCode: check.suppressionCode,
        event: updated,
      };
    }

    return { ok: true, stillValid: true, event };
  }

  /**
   * Mark delivery-ready event as delivered (adapter calls this).
   * Does not send — adapters own transport.
   */
  async markDelivered(args: {
    eventId: string;
    now: string;
    channel?: string | null;
    deliveryProviderRef?: string | null;
  }): Promise<LongitudinalEngagementEventRecord> {
    if (!anyExternalChannelEnabled(this.config) && !this.config.persistEvents) {
      // In-app / deferred: still allow status transition for tests
    }
    const updated = await this.deps.eventRepository.update(args.eventId, {
      status: "delivered",
      deliveredAt: args.now,
      channel: args.channel ?? null,
      deliveryProviderRef: args.deliveryProviderRef ?? null,
      updatedAt: args.now,
    });
    await this.audit({
      type: "LONGITUDINAL_REMINDER_DELIVERED",
      at: args.now,
      projectionSnapshotId: updated.projectionSnapshotId,
      stage: updated.stage,
      eventType: updated.eventType,
      suppressionCode: null,
    });
    return updated;
  }

  async markFailed(args: {
    eventId: string;
    now: string;
  }): Promise<LongitudinalEngagementEventRecord> {
    const updated = await this.deps.eventRepository.update(args.eventId, {
      status: "failed",
      updatedAt: args.now,
    });
    await this.audit({
      type: "LONGITUDINAL_REMINDER_FAILED",
      at: args.now,
      projectionSnapshotId: updated.projectionSnapshotId,
      stage: updated.stage,
      eventType: updated.eventType,
      suppressionCode: null,
    });
    return updated;
  }

  /**
   * Patient-safe engagement DTO from 1C milestone + optional latest event.
   * Reuses 1C nextAction hrefs when caseId is provided.
   */
  toPatientEngagementDto(args: {
    milestone: LongitudinalCaptureMilestone;
    caseId: string;
    event?: LongitudinalEngagementEventRecord | null;
  }): PatientLongitudinalEngagementDto {
    const m = args.milestone;
    let message: string | null = null;
    if (args.event && args.event.status === "pending") {
      message = renderReminderMessage(args.event.messageKey, {
        stageLabel: String(args.event.messageVariables.stageLabel ?? ""),
        missingRequiredCount: Number(
          args.event.messageVariables.missingRequiredCount ?? 0
        ),
      });
    }
    const next = deriveNextAction({
      status: m.status,
      stage: m.stage,
      caseId: args.caseId,
      reviewAvailable: m.reviewAvailable,
      missingRequiredCount: m.missingRequiredEvidenceRoles.length,
    });
    const actionType = args.event
      ? mapReminderActionToPatientAction(args.event.actionType)
      : next.type;
    return {
      stage: m.stage,
      status: m.status,
      message,
      action: {
        type: actionType,
        label: patientActionLabel({ actionType, stage: m.stage }),
        href: args.event?.actionHref ?? next.href,
      },
    };
  }

  assertPatientDtoSafe = assertPatientEngagementDtoSafe;

  /**
   * Batch evaluate all milestones on a plan. Aggregate counts only.
   */
  async evaluatePlan(args: {
    plan: LongitudinalCapturePlan;
    now: string;
    evidenceFirstPresentAtByStage?: Partial<
      Record<LongitudinalCaptureMilestone["stage"], string>
    >;
  }): Promise<EngagementBatchHealth> {
    const health: EngagementBatchHealth = {
      eligibleMilestones: 0,
      eventsCreated: 0,
      eventsReused: 0,
      eventsSuppressed: 0,
      deliveryReady: 0,
      delivered: 0,
      failed: 0,
      byEventType: {},
      byStage: {},
    };

    for (const milestone of args.plan.milestones) {
      const result = await this.decideForMilestone({
        plan: args.plan,
        milestone,
        now: args.now,
        evidenceFirstPresentAt:
          args.evidenceFirstPresentAtByStage?.[milestone.stage] ?? null,
      });
      if (!result.ok) {
        health.eventsSuppressed += 1;
        continue;
      }
      if (result.suppressed) {
        health.eventsSuppressed += 1;
        continue;
      }
      health.eligibleMilestones += 1;
      if (result.created) {
        health.eventsCreated += 1;
        health.deliveryReady += 1;
        const et = result.reminder.eventType;
        health.byEventType[et] = (health.byEventType[et] ?? 0) + 1;
        health.byStage[milestone.stage] =
          (health.byStage[milestone.stage] ?? 0) + 1;
      } else if (result.reused) {
        health.eventsReused += 1;
      }
    }
    return health;
  }

  assertApplyAllowed(opts?: { requireExternalDelivery?: boolean }) {
    return assertEngagementApplyAllowed(this.config, opts);
  }

  /** Build canonical input from plan+milestone (tests / worker). */
  toCanonicalInput = toCanonicalInput;

  private isHistoricalBlastCandidate(
    input: CanonicalEngagementMilestoneInput,
    now: string
  ): boolean {
    // If plan was created after the engagement window already closed for a
    // missed/recovery scenario, treating as historical campaign territory.
    if (!input.planCreatedAt) return false;
    const planDay = input.planCreatedAt.slice(0, 10);
    const nowDay = now.slice(0, 10);
    if (
      (input.status === "missed" ||
        input.status === "ready_for_review" ||
        input.status === "observed") &&
      planDay > input.windowEnd &&
      nowDay > input.windowEnd
    ) {
      return true;
    }
    return false;
  }

  private toRecord(
    reminder: ReturnType<typeof buildReminderEvent>,
    input: CanonicalEngagementMilestoneInput,
    status: LongitudinalEngagementEventRecord["status"]
  ): LongitudinalEngagementEventRecord {
    return {
      id: reminder.id,
      projectionSnapshotId: reminder.projectionSnapshotId,
      caseId: input.caseId,
      patientId: input.patientId,
      stage: reminder.stage,
      eventType: reminder.eventType,
      reasonCode: reminder.reasonCode,
      policyVersion: ENGAGEMENT_POLICY_VERSION,
      dedupeKey: reminder.dedupeKey,
      status,
      decisionAt: reminder.decisionAt,
      eligibleAfter: reminder.eligibleAfter,
      expiresAt: reminder.expiresAt,
      deliveredAt: null,
      suppressedAt: null,
      suppressionCode: null,
      channel: null,
      deliveryProviderRef: null,
      messageKey: reminder.patientSafeMessageKey,
      messageVariables: reminder.messageVariables,
      stateFingerprint: reminder.stateFingerprint,
      milestoneStatusAtDecision: reminder.milestoneStatusAtDecision,
      actionType: reminder.action.type,
      actionHref: reminder.action.href,
      createdAt: reminder.decisionAt,
      updatedAt: reminder.decisionAt,
    };
  }

  private async suppressEvent(
    event: LongitudinalEngagementEventRecord,
    code: NonNullable<LongitudinalEngagementEventRecord["suppressionCode"]>,
    now: string
  ): Promise<LongitudinalEngagementEventRecord> {
    if (this.dryRun && !this.config.persistEvents) {
      return {
        ...event,
        status: "suppressed",
        suppressedAt: now,
        suppressionCode: code,
        updatedAt: now,
      };
    }
    return this.deps.eventRepository.update(event.id, {
      status: "suppressed",
      suppressedAt: now,
      suppressionCode: code,
      updatedAt: now,
    });
  }

  private async suppressResult(args: {
    code: NonNullable<LongitudinalEngagementEventRecord["suppressionCode"]>;
    reason: string;
    input: CanonicalEngagementMilestoneInput;
    now: string;
  }): Promise<EngagementDecisionResult> {
    await this.audit({
      type: "LONGITUDINAL_REMINDER_SUPPRESSED",
      at: args.now,
      projectionSnapshotId: args.input.projectionSnapshotId,
      stage: args.input.stage,
      eventType: null,
      suppressionCode: args.code,
    });
    return {
      ok: true,
      created: false,
      reused: false,
      suppressed: true,
      suppressionCode: args.code,
      reason: args.reason,
      event: null,
    };
  }

  private async suppressAndMaybePersist(args: {
    code: NonNullable<LongitudinalEngagementEventRecord["suppressionCode"]>;
    reason: string;
    input: CanonicalEngagementMilestoneInput;
    reminder: ReturnType<typeof buildReminderEvent>;
    now: string;
  }): Promise<EngagementDecisionResult> {
    await this.audit({
      type: "LONGITUDINAL_REMINDER_SUPPRESSED",
      at: args.now,
      projectionSnapshotId: args.input.projectionSnapshotId,
      stage: args.input.stage,
      eventType: args.reminder.eventType,
      suppressionCode: args.code,
    });

    if (this.dryRun || (!this.config.enabled && !this.config.persistEvents)) {
      return {
        ok: true,
        created: false,
        reused: false,
        suppressed: true,
        suppressionCode: args.code,
        reason: args.reason,
        event: null,
      };
    }

    // Persist suppressed decision for audit trail when apply+persist
    const record = this.toRecord(args.reminder, args.input, "suppressed");
    record.suppressedAt = args.now;
    record.suppressionCode = args.code;
    // Unique dedupe would block — use distinct fingerprint for suppression audit
    record.dedupeKey = `${args.reminder.dedupeKey}::suppressed::${args.code}::${args.now}`;
    record.id = randomUUID();
    try {
      const inserted = await this.deps.eventRepository.insert(record);
      return {
        ok: true,
        created: false,
        reused: false,
        suppressed: true,
        suppressionCode: args.code,
        reason: args.reason,
        event: inserted,
      };
    } catch {
      return {
        ok: true,
        created: false,
        reused: false,
        suppressed: true,
        suppressionCode: args.code,
        reason: args.reason,
        event: null,
      };
    }
  }

  private async audit(
    partial: Omit<LongitudinalEngagementAuditEvent, "policyVersion">
  ): Promise<void> {
    if (!this.deps.auditSink) return;
    await this.deps.auditSink.write({
      ...partial,
      policyVersion: ENGAGEMENT_POLICY_VERSION,
    });
  }
}

export function createLongitudinalEngagementService(
  deps: LongitudinalEngagementServiceDeps
): LongitudinalEngagementService {
  return new LongitudinalEngagementService(deps);
}

export { toCanonicalInput as milestoneToEngagementInput };
