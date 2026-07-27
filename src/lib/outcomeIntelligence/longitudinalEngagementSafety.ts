/**
 * FI-OUTCOME-INTELLIGENCE-1D — Messaging safety, quiet hours, consent gaps.
 *
 * Consent: no canonical patient communication-preference system exists for
 * longitudinal reminders. Until one does, default is no new external channel
 * sends. In-app / persisted channel-neutral events remain allowed when gated.
 */

import {
  FORBIDDEN_ENGAGEMENT_LANGUAGE,
  renderReminderMessage,
  type ReminderTemplateVariables,
} from "./longitudinalEngagementTemplates";
import { getEngagementPolicy } from "./longitudinalEngagementPolicy";
import type {
  LongitudinalReminderMessageKey,
  PatientLongitudinalEngagementDto,
} from "./longitudinalEngagementTypes";
import type { LongitudinalEngagementConfig } from "./longitudinalEngagementConfig";

export type CommunicationPreferenceSnapshot = {
  emailAllowed?: boolean;
  smsAllowed?: boolean;
  pushAllowed?: boolean;
  marketingOptIn?: boolean;
  transactionalAllowed?: boolean;
};

/**
 * Documented gap — HairAudit has notification emails for report-ready / delayed
 * review, but no canonical preference row for longitudinal follow-up channels.
 */
export const COMMUNICATION_PREFERENCE_GAP =
  "No canonical patient communication preference system for longitudinal reminders. " +
  "Default: no external channel sends unless FI_LONGITUDINAL_* channel flags are explicitly enabled " +
  "and an adapter is wired. Prefer treating follow-up reminders as transactional when preferences exist.";

export function resolveChannelAllowance(args: {
  config: LongitudinalEngagementConfig;
  preferences?: CommunicationPreferenceSnapshot | null;
  channel: "email" | "sms" | "push";
}): { allowed: boolean; reason: string } {
  const prefs = args.preferences ?? null;
  switch (args.channel) {
    case "email": {
      if (!args.config.emailEnabled) {
        return { allowed: false, reason: "FI_LONGITUDINAL_EMAIL_ENABLED is not true." };
      }
      if (prefs && prefs.emailAllowed === false) {
        return { allowed: false, reason: "Patient email preference disallows send." };
      }
      if (prefs && prefs.transactionalAllowed === false) {
        return {
          allowed: false,
          reason: "Patient transactional preference disallows send.",
        };
      }
      return { allowed: true, reason: "email allowed by flag (+ prefs if present)" };
    }
    case "sms": {
      if (!args.config.smsEnabled) {
        return { allowed: false, reason: "FI_LONGITUDINAL_SMS_ENABLED is not true." };
      }
      if (prefs && prefs.smsAllowed === false) {
        return { allowed: false, reason: "Patient SMS preference disallows send." };
      }
      return { allowed: true, reason: "sms allowed by flag (+ prefs if present)" };
    }
    case "push": {
      if (!args.config.pushEnabled) {
        return { allowed: false, reason: "FI_LONGITUDINAL_PUSH_ENABLED is not true." };
      }
      if (prefs && prefs.pushAllowed === false) {
        return { allowed: false, reason: "Patient push preference disallows send." };
      }
      return { allowed: true, reason: "push allowed by flag (+ prefs if present)" };
    }
    default: {
      const _exhaustive: never = args.channel;
      return _exhaustive;
    }
  }
}

/**
 * Quiet hours for external delivery. Hour is 0–23 in patient local time when
 * provided; otherwise UTC (same convention as 1C date arithmetic).
 */
export function isWithinQuietHours(args: {
  now: Date | string;
  timeZoneOffsetMinutes?: number | null;
  startHour?: number;
  endHour?: number;
}): boolean {
  const policy = getEngagementPolicy();
  const start = args.startHour ?? policy.quietHoursStartLocal;
  const end = args.endHour ?? policy.quietHoursEndLocal;
  const d = typeof args.now === "string" ? new Date(args.now) : args.now;
  if (Number.isNaN(d.getTime())) return false;

  let hour: number;
  if (
    args.timeZoneOffsetMinutes != null &&
    Number.isFinite(args.timeZoneOffsetMinutes)
  ) {
    const localMs = d.getTime() + args.timeZoneOffsetMinutes * 60_000;
    hour = new Date(localMs).getUTCHours();
  } else {
    hour = d.getUTCHours();
  }
  return hour >= start && hour < end;
}

export function scanMessageForForbiddenLanguage(text: string): string[] {
  const lower = text.toLowerCase();
  return FORBIDDEN_ENGAGEMENT_LANGUAGE.filter((p) => lower.includes(p.toLowerCase()));
}

export function assertReminderCopySafe(
  key: LongitudinalReminderMessageKey,
  variables: ReminderTemplateVariables
): { ok: true } | { ok: false; violations: string[] } {
  const text = renderReminderMessage(key, variables);
  const violations = scanMessageForForbiddenLanguage(text);
  if (/\d+\s*%/.test(text) && /growth|survival|success/i.test(text)) {
    violations.push("percentage_outcome_language");
  }
  return violations.length ? { ok: false, violations } : { ok: true };
}

export function assertPatientEngagementDtoSafe(
  dto: PatientLongitudinalEngagementDto
): { ok: true } | { ok: false; violations: string[] } {
  const blob = JSON.stringify(dto);
  const violations: string[] = [];
  const forbidden = [
    /"caseId"/i,
    /"patientId"/i,
    /"projectionSnapshotId"/i,
    /"dedupeKey"/i,
    /"suppressionCode"/i,
    /"deliveryProviderRef"/i,
    /"eventId"/i,
    /graft survival/i,
    /on track/i,
    /"cohort/i,
  ];
  for (const re of forbidden) {
    if (re.test(blob)) violations.push(re.source);
  }
  if (dto.message) {
    violations.push(...scanMessageForForbiddenLanguage(dto.message));
  }
  return violations.length ? { ok: false, violations } : { ok: true };
}
