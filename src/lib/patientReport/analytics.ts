/**
 * HA-PATIENT-REPORT-UI-1A — Privacy-safe patient report UI analytics.
 */

import { trackCta } from "@/lib/analytics/trackCta";
import {
  DONOR_ANALYTICS_FORBIDDEN_META_KEYS,
  donorHealingAnalyticsMeta,
} from "@/lib/patient/donorHealingEntry";
import type { PatientReportType } from "@/lib/patientReport/types";

export const PATIENT_REPORT_UI_EVENTS = [
  "patient_report_section_opened",
  "patient_report_photo_expanded",
  "patient_report_download_clicked",
  "patient_report_print_clicked",
  "patient_report_next_step_clicked",
] as const;

export type PatientReportUiEvent = (typeof PATIENT_REPORT_UI_EVENTS)[number];

export const PATIENT_REPORT_ANALYTICS_FORBIDDEN_KEYS = [
  ...DONOR_ANALYTICS_FORBIDDEN_META_KEYS,
  "patientDisplayName",
  "patient_display_name",
  "patient_id",
  "patientId",
  "orientationProvenanceId",
  "orientation_provenance_id",
  "photographId",
  "photograph_id",
  "photoId",
  "photo_id",
  "image_id",
  "imageId",
  "report_id",
  "reportId",
  "snapshot_id",
  "snapshotId",
  "health_answers",
  "imageUrl",
  "image_url",
] as const;

export type PatientReportAnalyticsContext = {
  reportType: PatientReportType;
  entryContext?: string;
  pathway?: string;
};

function sanitizeMeta(
  extra?: Record<string, unknown>
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!extra) return out;
  for (const [key, value] of Object.entries(extra)) {
    if (
      (PATIENT_REPORT_ANALYTICS_FORBIDDEN_KEYS as readonly string[]).includes(key) ||
      value == null
    ) {
      continue;
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Emit a patient-report UI event with privacy-safe dimensions only.
 * When entry_context is donor_healing, reuses donor funnel meta base.
 */
export function trackPatientReportUiEvent(
  event: PatientReportUiEvent,
  context: PatientReportAnalyticsContext,
  extra?: Record<string, unknown>
): void {
  const safeExtra = sanitizeMeta(extra);
  const base =
    context.entryContext === "donor_healing"
      ? donorHealingAnalyticsMeta({
          report_type: context.reportType,
          ...safeExtra,
        })
      : {
          report_type: context.reportType,
          ...(context.entryContext ? { entry_context: context.entryContext } : {}),
          ...(context.pathway ? { pathway: context.pathway } : {}),
          ...safeExtra,
        };

  // Strip any forbidden keys that slipped through donor meta merge.
  const cleaned = sanitizeMeta(base);
  trackCta(event, {
    report_type: context.reportType,
    ...(context.entryContext ? { entry_context: context.entryContext } : {}),
    ...(context.pathway ? { pathway: context.pathway } : {}),
    ...cleaned,
  });
}

/** Test helper — returns the payload that would be emitted (no side effects). */
export function buildPatientReportAnalyticsPayload(
  event: PatientReportUiEvent,
  context: PatientReportAnalyticsContext,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  const safeExtra = sanitizeMeta(extra);
  const merged =
    context.entryContext === "donor_healing"
      ? donorHealingAnalyticsMeta({
          report_type: context.reportType,
          ...safeExtra,
        })
      : {
          report_type: context.reportType,
          ...(context.entryContext ? { entry_context: context.entryContext } : {}),
          ...(context.pathway ? { pathway: context.pathway } : {}),
          ...safeExtra,
        };
  return {
    event,
    report_type: context.reportType,
    ...sanitizeMeta(merged),
  };
}

export function patientReportAnalyticsContainsForbiddenKeys(
  payload: Record<string, unknown>
): string[] {
  return Object.keys(payload).filter((key) =>
    (PATIENT_REPORT_ANALYTICS_FORBIDDEN_KEYS as readonly string[]).includes(key)
  );
}
