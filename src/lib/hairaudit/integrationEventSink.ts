/**
 * Staging-safe integration event sink — Phase 2G
 *
 * HTTP delivery adapter for HairAudit integration events. Default no-op.
 * Never throws to upload routes or emit callers.
 *
 * See: docs/hairaudit-v2-phase-2g-event-sink-fi-bridge.md
 */

import type { HairAuditEventPayload, HairAuditEventSink } from "@/lib/integrations/types";

const LOG_PREFIX = "[hairaudit:integration-sink]";
const DEFAULT_TIMEOUT_MS = 2000;
const MIN_TIMEOUT_MS = 1500;
const MAX_TIMEOUT_MS = 3000;

export type IntegrationSinkConfigError =
  | "sink_url_missing"
  | "non_https_in_production"
  | "service_role_key_reused"
  | "invalid_headers_json";

export type IntegrationSinkConfig = {
  sinkUrl: string;
  headers: Record<string, string>;
  timeoutMs: number;
};

export type IntegrationSinkConfigValidation =
  | { valid: true; config: IntegrationSinkConfig }
  | { valid: false; error: IntegrationSinkConfigError; message: string };

export function integrationEventsEnabled(): boolean {
  return (
    typeof process !== "undefined" && process.env?.INTEGRATION_EVENTS_ENABLED === "true"
  );
}

export function uploadEventsEnabledForSink(): boolean {
  return (
    typeof process !== "undefined" &&
    process.env?.HAIRAUDIT_UPLOAD_EVENTS_ENABLED === "true"
  );
}

/** Both gates required for upload-event HTTP delivery path. */
export function isUploadEventSinkDeliveryEnabled(): boolean {
  return uploadEventsEnabledForSink() && integrationEventsEnabled();
}

function isProductionRuntime(): boolean {
  return typeof process !== "undefined" && process.env?.NODE_ENV === "production";
}

function getServiceRoleKey(): string | undefined {
  return process.env?.SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined;
}

function containsServiceRoleKey(value: string, serviceRoleKey: string): boolean {
  return value.includes(serviceRoleKey);
}

/**
 * Parse INTEGRATION_EVENTS_HEADERS as JSON object.
 * Supports legacy single-line "Header-Name: value" for one header only.
 */
export function parseIntegrationEventHeaders(
  raw: string | undefined
): { ok: true; headers: Record<string, string> } | { ok: false; error: "invalid_headers_json" } {
  const trimmed = raw?.trim();
  if (!trimmed) return { ok: true, headers: {} };

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { ok: false, error: "invalid_headers_json" };
      }
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value !== "string") {
          return { ok: false, error: "invalid_headers_json" };
        }
        headers[key] = value;
      }
      return { ok: true, headers };
    } catch {
      return { ok: false, error: "invalid_headers_json" };
    }
  }

  const colonIdx = trimmed.indexOf(":");
  if (colonIdx <= 0) {
    return { ok: false, error: "invalid_headers_json" };
  }
  const name = trimmed.slice(0, colonIdx).trim();
  const value = trimmed.slice(colonIdx + 1).trim();
  if (!name || !value) {
    return { ok: false, error: "invalid_headers_json" };
  }
  return { ok: true, headers: { [name]: value } };
}

export function resolveIntegrationSinkTimeoutMs(env = process.env): number {
  const raw = env.INTEGRATION_EVENTS_TIMEOUT_MS?.trim();
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.round(parsed)));
}

/**
 * Validate sink configuration. Used by readiness checker and runtime delivery.
 */
export function validateIntegrationSinkConfig(
  env: NodeJS.ProcessEnv = process.env
): IntegrationSinkConfigValidation {
  const deliveryEnabled = env.INTEGRATION_EVENTS_ENABLED === "true";
  const sinkUrl = env.INTEGRATION_EVENTS_SINK_URL?.trim() ?? "";

  if (!deliveryEnabled) {
    if (!sinkUrl) {
      return {
        valid: false,
        error: "sink_url_missing",
        message: "Integration delivery disabled",
      };
    }
  }

  if (deliveryEnabled && !sinkUrl) {
    return {
      valid: false,
      error: "sink_url_missing",
      message: "INTEGRATION_EVENTS_SINK_URL is required when INTEGRATION_EVENTS_ENABLED=true",
    };
  }

  if (!sinkUrl) {
    return {
      valid: false,
      error: "sink_url_missing",
      message: "INTEGRATION_EVENTS_SINK_URL is not configured",
    };
  }

  const nodeEnv = (env.NODE_ENV ?? "").trim();
  if (nodeEnv === "production" && !sinkUrl.startsWith("https://")) {
    return {
      valid: false,
      error: "non_https_in_production",
      message: "INTEGRATION_EVENTS_SINK_URL must use HTTPS in production",
    };
  }

  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (serviceRoleKey) {
    if (containsServiceRoleKey(sinkUrl, serviceRoleKey)) {
      return {
        valid: false,
        error: "service_role_key_reused",
        message: "INTEGRATION_EVENTS_SINK_URL must not embed SUPABASE_SERVICE_ROLE_KEY",
      };
    }
    const headersRaw = env.INTEGRATION_EVENTS_HEADERS?.trim();
    if (headersRaw && containsServiceRoleKey(headersRaw, serviceRoleKey)) {
      return {
        valid: false,
        error: "service_role_key_reused",
        message: "INTEGRATION_EVENTS_HEADERS must not reuse SUPABASE_SERVICE_ROLE_KEY",
      };
    }
  }

  const headersResult = parseIntegrationEventHeaders(env.INTEGRATION_EVENTS_HEADERS);
  if (!headersResult.ok) {
    return {
      valid: false,
      error: "invalid_headers_json",
      message: "INTEGRATION_EVENTS_HEADERS must be valid JSON object or Header-Name: value",
    };
  }

  if (serviceRoleKey) {
    for (const value of Object.values(headersResult.headers)) {
      if (value === serviceRoleKey || containsServiceRoleKey(value, serviceRoleKey)) {
        return {
          valid: false,
          error: "service_role_key_reused",
          message: "INTEGRATION_EVENTS_HEADERS must not reuse SUPABASE_SERVICE_ROLE_KEY",
        };
      }
    }
  }

  return {
    valid: true,
    config: {
      sinkUrl,
      headers: headersResult.headers,
      timeoutMs: resolveIntegrationSinkTimeoutMs(env),
    },
  };
}

export type IntegrationSinkDeliverySummary = {
  eventName: string;
  delivered: boolean;
  status?: number;
  error?: string;
  skippedReason?: string;
};

function logSafeSummary(summary: IntegrationSinkDeliverySummary): void {
  const parts = [
    summary.eventName,
    summary.delivered ? "delivered" : "not-delivered",
  ];
  if (summary.status !== undefined) parts.push(`status=${summary.status}`);
  if (summary.skippedReason) parts.push(`skip=${summary.skippedReason}`);
  if (summary.error) parts.push(`error=${summary.error}`);
  console.info(LOG_PREFIX, parts.join(" "));
}

type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal }
) => Promise<{ ok: boolean; status: number }>;

/**
 * Deliver a single event to the configured HTTP sink. Never throws.
 */
export async function deliverIntegrationEvent(
  eventName: string,
  payload: HairAuditEventPayload,
  options?: {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: FetchLike;
    requireUploadEventFlags?: boolean;
  }
): Promise<IntegrationSinkDeliverySummary> {
  const env = options?.env ?? process.env;
  const fetchImpl = options?.fetchImpl ?? globalThis.fetch;

  if (options?.requireUploadEventFlags && !isUploadEventSinkDeliveryEnabled()) {
    const summary: IntegrationSinkDeliverySummary = {
      eventName,
      delivered: false,
      skippedReason: "upload-event-flags-off",
    };
    return summary;
  }

  if (!integrationEventsEnabled()) {
    return { eventName, delivered: false, skippedReason: "integration-events-disabled" };
  }

  const validation = validateIntegrationSinkConfig(env);
  if (!validation.valid) {
    logSafeSummary({
      eventName,
      delivered: false,
      skippedReason: validation.error,
      error: validation.message,
    });
    return {
      eventName,
      delivered: false,
      skippedReason: validation.error,
      error: validation.message,
    };
  }

  const { sinkUrl, headers, timeoutMs } = validation.config;
  const body = JSON.stringify({ event_name: eventName, payload });

  if (typeof fetchImpl !== "function") {
    logSafeSummary({ eventName, delivered: false, skippedReason: "fetch-unavailable" });
    return { eventName, delivered: false, skippedReason: "fetch-unavailable" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(sinkUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body,
      signal: controller.signal,
    });

    const summary: IntegrationSinkDeliverySummary = {
      eventName,
      delivered: response.ok,
      status: response.status,
    };
    if (!response.ok) {
      summary.error = "non-2xx-response";
    }
    logSafeSummary(summary);
    return summary;
  } catch (err) {
    const message = err instanceof Error ? err.name : "delivery-error";
    const summary: IntegrationSinkDeliverySummary = {
      eventName,
      delivered: false,
      error: message,
    };
    logSafeSummary(summary);
    return summary;
  } finally {
    clearTimeout(timer);
  }
}

/** Injectable HTTP sink for getEventSink(). Swallows all errors. */
export class HttpIntegrationEventSink implements HairAuditEventSink {
  constructor(
    private readonly options?: {
      env?: NodeJS.ProcessEnv;
      fetchImpl?: FetchLike;
    }
  ) {}

  async emit(eventName: string, payload: HairAuditEventPayload): Promise<void> {
    await deliverIntegrationEvent(eventName, payload, {
      env: this.options?.env,
      fetchImpl: this.options?.fetchImpl,
    });
  }
}

export function createIntegrationEventSink(options?: {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: FetchLike;
}): HairAuditEventSink {
  const env = options?.env ?? process.env;
  if (env.INTEGRATION_EVENTS_ENABLED !== "true") {
    return new NoOpIntegrationEventSink();
  }
  const validation = validateIntegrationSinkConfig(env);
  if (!validation.valid) {
    return new NoOpIntegrationEventSink();
  }
  return new HttpIntegrationEventSink(options);
}

class NoOpIntegrationEventSink implements HairAuditEventSink {
  async emit(_eventName: string, _payload: HairAuditEventPayload): Promise<void> {
    // no-op
  }
}
