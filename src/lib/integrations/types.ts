/**
 * Future integration: normalized event sink for analytics / Follicle Intelligence.
 * See docs/FUTURE-INTEGRATION-ARCHITECTURE.md.
 * Default implementation is no-op; swap in a real sink when INTEGRATION_EVENTS_ENABLED=true.
 */

export type HairAuditEventPayload = Record<string, string | number | boolean | null | undefined>;

export interface HairAuditEventSink {
  emit(eventName: string, payload: HairAuditEventPayload): Promise<void>;
}
