/**
 * Emit normalized HairAudit events for future analytics / Follicle Intelligence.
 * No-op unless INTEGRATION_EVENTS_ENABLED is set and a non–no-op sink is configured.
 * See docs/FUTURE-INTEGRATION-ARCHITECTURE.md.
 */

import { getEventSink } from "./sink";
import type { HairAuditEventPayload } from "./types";

function integrationEventsEnabled(): boolean {
  return typeof process !== "undefined" && process.env?.INTEGRATION_EVENTS_ENABLED === "true";
}

/**
 * Emit a normalized event. Safe to call from any code path; does nothing when disabled.
 * Reads `INTEGRATION_EVENTS_ENABLED` on each call so tests and runtime toggles behave predictably.
 */
export async function emitHairAuditEvent(
  eventName: string,
  payload: HairAuditEventPayload
): Promise<void> {
  if (!integrationEventsEnabled()) return;
  const sink = getEventSink();
  await sink.emit(eventName, payload);
}
