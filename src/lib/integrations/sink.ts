/**
 * Event sink implementations for future integration.
 * Default: no-op. Replace with HTTP/queue implementation when INTEGRATION_EVENTS_ENABLED=true.
 * See docs/FUTURE-INTEGRATION-ARCHITECTURE.md.
 */

import type { HairAuditEventSink, HairAuditEventPayload } from "./types";

class NoOpSink implements HairAuditEventSink {
  async emit(_eventName: string, _payload: HairAuditEventPayload): Promise<void> {
    // no-op
  }
}

let sinkInstance: HairAuditEventSink | null = null;

export function getEventSink(): HairAuditEventSink {
  if (!sinkInstance) {
    sinkInstance = new NoOpSink();
  }
  return sinkInstance;
}

export function setEventSink(sink: HairAuditEventSink): void {
  sinkInstance = sink;
}
