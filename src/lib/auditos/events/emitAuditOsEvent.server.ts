/**
 * Follicle Intelligence / AuditOS outbound events (Stage 4A).
 *
 * - **Disabled by default** — no sink calls unless `HAIRAUDIT_FI_EVENTS_ENABLED === "true"`.
 * - **No PII** — payloads are passed through a strict whitelist mapped to `HairAuditEventPayload` scalars only.
 * - **Integration sink** — when enabled, uses the existing `getEventSink()` from `@/lib/integrations/sink` (same no-op / injectable sink as `emitHairAuditEvent`, without requiring `INTEGRATION_EVENTS_ENABLED`).
 *
 * For HTTP delivery, configure a real sink via `setEventSink` in app bootstrap or tests.
 */

import { getEventSink } from "@/lib/integrations/sink";
import type { HairAuditEventPayload } from "@/lib/integrations/types";

export type AuditOsFiEventName =
  | "hairaudit.case.created"
  | "hairaudit.case.submitted"
  | "hairaudit.audit.completed"
  | "hairaudit.report.generated"
  | "hairaudit.report.released";

const ALLOWED_PAYLOAD_KEYS = new Set([
  "case_id",
  "report_id",
  "report_version",
  "pipeline_phase",
  "event_schema",
  "scoring_engine_version",
  /** Policy / narrative generation label when present on legacy summary (string only). */
  "scoring_version",
  "evidence_manifest_version",
  "generated_at",
]);

export function isAuditOsFiEventsEnabled(): boolean {
  return typeof process !== "undefined" && process.env?.HAIRAUDIT_FI_EVENTS_ENABLED === "true";
}

function scalarToPayloadValue(v: unknown): string | number | boolean | null | undefined {
  if (v === null || v === undefined) return v ?? undefined;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  return String(v);
}

/**
 * Keep only documented, non-identifying fields suitable for FI ingestion.
 * Unknown keys are dropped. Does not throw.
 */
export function sanitizeAuditOsFiPayload(raw: Record<string, unknown>): HairAuditEventPayload {
  const out: HairAuditEventPayload = {};
  for (const [key, val] of Object.entries(raw)) {
    if (!ALLOWED_PAYLOAD_KEYS.has(key)) continue;
    out[key] = scalarToPayloadValue(val);
  }
  return out;
}

/**
 * Emit an AuditOS / FI lifecycle event. No-op when `HAIRAUDIT_FI_EVENTS_ENABLED` is not `"true"`.
 * Safe to import from server routes and Inngest steps.
 */
export async function emitAuditOsEvent(eventName: AuditOsFiEventName, payload: Record<string, unknown>): Promise<void> {
  if (!isAuditOsFiEventsEnabled()) return;

  const safe = sanitizeAuditOsFiPayload(payload);
  if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
    console.info("[AuditOS:FI]", eventName, safe);
  }

  const sink = getEventSink();
  await sink.emit(eventName, safe);
}
