/**
 * Emit normalized HairAudit events for future analytics / Follicle Intelligence.
 * No-op unless INTEGRATION_EVENTS_ENABLED is set and a non–no-op sink is configured.
 * See docs/FUTURE-INTEGRATION-ARCHITECTURE.md.
 */

import { getEventSink } from "./sink";
import type { HairAuditEventPayload } from "./types";

const INTEGRATION_EVENTS_ENABLED =
  typeof process !== "undefined" &&
  process.env?.INTEGRATION_EVENTS_ENABLED === "true";

/**
 * Emit a normalized event. Safe to call from any code path; does nothing when disabled.
 */
export async function emitHairAuditEvent(
  eventName: string,
  payload: HairAuditEventPayload
): Promise<void> {
  if (!INTEGRATION_EVENTS_ENABLED) return;
  const sink = getEventSink();
  await sink.emit(eventName, payload);
}
