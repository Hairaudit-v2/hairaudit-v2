/**
 * Event sink implementations for future integration.
 * Default: no-op. HTTP sink when INTEGRATION_EVENTS_ENABLED=true and sink URL is valid.
 * See docs/FUTURE-INTEGRATION-ARCHITECTURE.md and docs/hairaudit-v2-phase-2g-event-sink-fi-bridge.md.
 */

import { createIntegrationEventSink } from "@/lib/hairaudit/integrationEventSink";
import type { HairAuditEventSink } from "./types";

let sinkInstance: HairAuditEventSink | null = null;
let sinkEnvFingerprint: string | null = null;
let injectedSink: HairAuditEventSink | null = null;

function sinkEnvFingerprintFromProcess(): string {
  const env = process.env;
  return [
    env.INTEGRATION_EVENTS_ENABLED ?? "",
    env.INTEGRATION_EVENTS_SINK_URL ?? "",
    env.INTEGRATION_EVENTS_HEADERS ?? "",
    env.INTEGRATION_EVENTS_TIMEOUT_MS ?? "",
    env.NODE_ENV ?? "",
    env.SUPABASE_SERVICE_ROLE_KEY ? "srk-set" : "",
  ].join("|");
}

export function getEventSink(): HairAuditEventSink {
  if (injectedSink) return injectedSink;

  const fingerprint = sinkEnvFingerprintFromProcess();
  if (!sinkInstance || sinkEnvFingerprint !== fingerprint) {
    sinkInstance = createIntegrationEventSink();
    sinkEnvFingerprint = fingerprint;
  }
  return sinkInstance;
}

export function setEventSink(sink: HairAuditEventSink): void {
  injectedSink = sink;
}

/** Clear test injection so getEventSink() rebuilds from environment. */
export function resetEventSinkInjection(): void {
  injectedSink = null;
  sinkInstance = null;
  sinkEnvFingerprint = null;
}
