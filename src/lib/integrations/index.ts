/**
 * Future-ready integration layer: canonical IDs (DB columns) and optional event emission.
 * See docs/FUTURE-INTEGRATION-ARCHITECTURE.md.
 */

export { emitHairAuditEvent } from "./emit";
export { getEventSink, setEventSink } from "./sink";
export type { HairAuditEventSink, HairAuditEventPayload } from "./types";
