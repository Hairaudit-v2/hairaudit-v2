/**
 * Upload event dispatcher — Phase 2E
 *
 * Non-blocking hook for upload lifecycle events. Default: no-op.
 * When enabled, forwards to the integration event bridge (still no-op until
 * INTEGRATION_EVENTS_ENABLED and a real sink are configured).
 *
 * Must never block or fail upload routes.
 */

import { emitHairAuditEvent } from "@/lib/integrations/emit";
import {
  buildHairAuditUploadCreatedEvent,
  buildHairAuditUploadDeletedEvent,
  flattenUploadEventForSink,
  uploadEventPayloadIsSafe,
  type BuildHairAuditUploadCreatedEventInput,
  type BuildHairAuditUploadDeletedEventInput,
  type HairAuditUploadEvent,
} from "./uploadEvents";

const LOG_PREFIX = "[hairaudit:upload-events]";

function uploadEventsEnabled(): boolean {
  return (
    typeof process !== "undefined" && process.env?.HAIRAUDIT_UPLOAD_EVENTS_ENABLED === "true"
  );
}

function uploadEventsDebug(): boolean {
  return (
    typeof process !== "undefined" && process.env?.HAIRAUDIT_UPLOAD_EVENTS_DEBUG === "true"
  );
}

function isDevelopmentRuntime(): boolean {
  return typeof process !== "undefined" && process.env?.NODE_ENV !== "production";
}

/**
 * Dispatch a built upload event. Fire-and-forget; swallows all errors.
 */
export function dispatchHairAuditUploadEvent(event: HairAuditUploadEvent): void {
  void dispatchHairAuditUploadEventAsync(event).catch(() => {
    /* never propagate */
  });
}

async function dispatchHairAuditUploadEventAsync(event: HairAuditUploadEvent): Promise<void> {
  const flat = flattenUploadEventForSink(event);
  const safety = uploadEventPayloadIsSafe(flat);
  if (!safety.safe) {
    if (uploadEventsDebug() && isDevelopmentRuntime()) {
      console.warn(LOG_PREFIX, "skipped unsafe payload", safety.violations);
    }
    return;
  }

  if (uploadEventsDebug() && isDevelopmentRuntime()) {
    console.debug(LOG_PREFIX, event.event_name, flat);
  }

  if (!uploadEventsEnabled()) return;

  await emitHairAuditEvent(event.event_name, flat);
}

/**
 * Build and dispatch `hairaudit.upload.created` after a confirmed DB insert.
 * Safe to call from upload routes — never throws.
 */
export function notifyHairAuditUploadCreated(input: BuildHairAuditUploadCreatedEventInput): void {
  try {
    const event = buildHairAuditUploadCreatedEvent(input);
    dispatchHairAuditUploadEvent(event);
  } catch {
    /* never block upload success */
  }
}

/**
 * Build and dispatch `hairaudit.upload.deleted` after confirmed storage + DB removal.
 * Safe to call from delete routes — never throws.
 */
export function notifyHairAuditUploadDeleted(input: BuildHairAuditUploadDeletedEventInput): void {
  try {
    const event = buildHairAuditUploadDeletedEvent(input);
    dispatchHairAuditUploadEvent(event);
  } catch {
    /* never block delete success */
  }
}
