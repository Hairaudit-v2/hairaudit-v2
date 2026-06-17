/**
 * HairAudit upload event staging readiness checker — Phase 2F / 2G
 *
 * Validates environment flags and secret hygiene for FI-compatible event
 * forwarding without making external network calls.
 *
 * Usage: npm run check:hairaudit-events
 *
 * See: docs/hairaudit-v2-phase-2f-upload-deleted-events-readiness.md
 *      docs/hairaudit-v2-phase-2g-event-sink-fi-bridge.md
 */

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

/** @typedef {"PASS" | "WARN" | "FAIL"} ReadinessStatus */

/** @typedef {{ id: string; status: ReadinessStatus; message: string }} ReadinessLine */

const UPLOAD_EVENT_FLAGS = [
  {
    id: "HAIRAUDIT_UPLOAD_EVENTS_ENABLED",
    requiredForDelivery: true,
    description: "forwards upload lifecycle events to emitHairAuditEvent",
  },
  {
    id: "INTEGRATION_EVENTS_ENABLED",
    requiredForDelivery: true,
    description: "allows integration sink delivery",
  },
  {
    id: "HAIRAUDIT_UPLOAD_EVENTS_DEBUG",
    requiredForDelivery: false,
    description: "debug logging for upload events (non-production only)",
  },
  {
    id: "HAIRAUDIT_FI_IMAGE_INTELLIGENCE_ENABLED",
    requiredForDelivery: false,
    description: "future FI image-intelligence enqueue switch (contract only in Phase 2G)",
  },
];

const INTEGRATION_SINK_VARS = [
  "INTEGRATION_EVENTS_SINK_URL",
  "INTEGRATION_EVENTS_HEADERS",
];

const SECRET_ENV_KEYS = [
  "INTEGRATION_EVENTS_HEADERS",
  "INTEGRATION_EVENTS_API_KEY",
  "INTEGRATION_EVENTS_AUTH_TOKEN",
];

/**
 * @param {string | undefined} raw
 * @returns {{ ok: true } | { ok: false; reason: string }}
 */
export function validateIntegrationHeadersJson(raw) {
  const trimmed = raw?.trim();
  if (!trimmed) return { ok: true };

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { ok: false, reason: "must be a JSON object" };
      }
      for (const value of Object.values(parsed)) {
        if (typeof value !== "string") {
          return { ok: false, reason: "header values must be strings" };
        }
      }
      return { ok: true };
    } catch {
      return { ok: false, reason: "invalid JSON" };
    }
  }

  const colonIdx = trimmed.indexOf(":");
  if (colonIdx <= 0) {
    return { ok: false, reason: 'use JSON object or "Header-Name: value"' };
  }
  return { ok: true };
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {ReadinessLine[]}
 */
export function runHairAuditEventReadinessChecks(env = process.env) {
  /** @type {ReadinessLine[]} */
  const lines = [];

  const uploadEventsEnabled = env.HAIRAUDIT_UPLOAD_EVENTS_ENABLED === "true";
  const integrationEventsEnabled = env.INTEGRATION_EVENTS_ENABLED === "true";
  const fiImageIntelligenceEnabled = env.HAIRAUDIT_FI_IMAGE_INTELLIGENCE_ENABLED === "true";
  const debugEnabled = env.HAIRAUDIT_UPLOAD_EVENTS_DEBUG === "true";
  const nodeEnv = (env.NODE_ENV ?? "").trim();

  for (const flag of UPLOAD_EVENT_FLAGS) {
    const value = env[flag.id];
    const isTrue = value === "true";

    if (flag.id === "HAIRAUDIT_UPLOAD_EVENTS_DEBUG" && isTrue && nodeEnv === "production") {
      lines.push({
        id: flag.id,
        status: "WARN",
        message: `${flag.id}=true in production — debug logging should stay off in prod`,
      });
      continue;
    }

    if (flag.id === "HAIRAUDIT_FI_IMAGE_INTELLIGENCE_ENABLED") {
      if (isTrue) {
        lines.push({
          id: flag.id,
          status: "WARN",
          message:
            `${flag.id}=true — FI bridge contract active but AI execution is not implemented yet (Phase 2G)`,
        });
      } else if (value !== undefined && value !== "false" && value !== "") {
        lines.push({
          id: flag.id,
          status: "WARN",
          message: `${flag.id} is set but not "true" (value: ${value})`,
        });
      } else {
        lines.push({
          id: flag.id,
          status: "PASS",
          message: `${flag.id} off (default — bridge mapping only, no enqueue execution)`,
        });
      }
      continue;
    }

    if (isTrue) {
      lines.push({
        id: flag.id,
        status: "PASS",
        message: `${flag.id}=true (${flag.description})`,
      });
    } else if (value !== undefined && value !== "false" && value !== "") {
      lines.push({
        id: flag.id,
        status: "WARN",
        message: `${flag.id} is set but not "true" (value: ${value})`,
      });
    } else {
      lines.push({
        id: flag.id,
        status: "PASS",
        message: `${flag.id} off (default safe — no external upload event delivery)`,
      });
    }
  }

  const deliveryRequested = uploadEventsEnabled && integrationEventsEnabled;
  if (deliveryRequested) {
    lines.push({
      id: "delivery-gates",
      status: "WARN",
      message:
        "Both HAIRAUDIT_UPLOAD_EVENTS_ENABLED and INTEGRATION_EVENTS_ENABLED are true — verify sink config before staging rollout",
    });
  } else {
    lines.push({
      id: "delivery-gates",
      status: "PASS",
      message: "External upload event delivery disabled (expected default)",
    });
  }

  const sinkUrl = env.INTEGRATION_EVENTS_SINK_URL?.trim() ?? "";
  if (deliveryRequested && !sinkUrl) {
    lines.push({
      id: "INTEGRATION_EVENTS_SINK_URL",
      status: "FAIL",
      message: "INTEGRATION_EVENTS_SINK_URL is required when delivery flags are enabled",
    });
  } else if (!sinkUrl) {
    lines.push({
      id: "INTEGRATION_EVENTS_SINK_URL",
      status: "PASS",
      message: "INTEGRATION_EVENTS_SINK_URL unset (ok while delivery disabled)",
    });
  } else {
    lines.push({
      id: "INTEGRATION_EVENTS_SINK_URL",
      status: deliveryRequested ? "PASS" : "WARN",
      message: deliveryRequested
        ? "INTEGRATION_EVENTS_SINK_URL is set"
        : "INTEGRATION_EVENTS_SINK_URL is set while delivery flags are off — no outbound calls expected",
    });

    if (nodeEnv === "production" && !sinkUrl.startsWith("https://")) {
      lines.push({
        id: "sink-url-https",
        status: "FAIL",
        message: "INTEGRATION_EVENTS_SINK_URL must use HTTPS in production",
      });
    } else if (sinkUrl.startsWith("https://")) {
      lines.push({
        id: "sink-url-https",
        status: "PASS",
        message: "Sink URL uses HTTPS",
      });
    } else if (sinkUrl) {
      lines.push({
        id: "sink-url-https",
        status: "PASS",
        message: "Sink URL is HTTP (allowed outside production)",
      });
    }
  }

  const headersRaw = env.INTEGRATION_EVENTS_HEADERS?.trim();
  if (!headersRaw) {
    lines.push({
      id: "INTEGRATION_EVENTS_HEADERS",
      status: deliveryRequested ? "PASS" : "PASS",
      message: deliveryRequested
        ? "INTEGRATION_EVENTS_HEADERS unset (optional auth headers)"
        : "INTEGRATION_EVENTS_HEADERS unset (ok while delivery disabled)",
    });
  } else {
    const headerCheck = validateIntegrationHeadersJson(headersRaw);
    if (!headerCheck.ok) {
      lines.push({
        id: "INTEGRATION_EVENTS_HEADERS",
        status: "FAIL",
        message: `INTEGRATION_EVENTS_HEADERS invalid — ${headerCheck.reason}`,
      });
    } else {
      lines.push({
        id: "INTEGRATION_EVENTS_HEADERS",
        status: "PASS",
        message: "INTEGRATION_EVENTS_HEADERS is valid JSON or Header-Name: value",
      });
    }
  }

  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (serviceRoleKey) {
    for (const secretKey of SECRET_ENV_KEYS) {
      const candidate = env[secretKey]?.trim();
      if (candidate && candidate === serviceRoleKey) {
        lines.push({
          id: `secret-reuse:${secretKey}`,
          status: "FAIL",
          message: `${secretKey} must not reuse SUPABASE_SERVICE_ROLE_KEY`,
        });
      }
    }

    if (
      env.INTEGRATION_EVENTS_HEADERS?.includes(serviceRoleKey) ||
      env.INTEGRATION_EVENTS_SINK_URL?.includes(serviceRoleKey)
    ) {
      lines.push({
        id: "secret-reuse:integration",
        status: "FAIL",
        message: "Integration event config must not embed SUPABASE_SERVICE_ROLE_KEY",
      });
    }
  }

  const failCount = lines.filter((l) => l.status === "FAIL").length;
  if (failCount === 0 && !lines.some((l) => l.id.startsWith("secret-reuse"))) {
    lines.push({
      id: "service-role-isolation",
      status: "PASS",
      message: "No integration secret reuse of SUPABASE_SERVICE_ROLE_KEY detected",
    });
  }

  if (!fiImageIntelligenceEnabled) {
    lines.push({
      id: "fi-ai-execution",
      status: "PASS",
      message: "FI image intelligence AI execution not enabled (expected — contract-only in Phase 2G)",
    });
  } else {
    lines.push({
      id: "fi-ai-execution",
      status: "WARN",
      message:
        "HAIRAUDIT_FI_IMAGE_INTELLIGENCE_ENABLED=true but queue/AI execution is not implemented yet",
    });
  }

  return lines;
}

/**
 * @param {ReadinessLine[]} lines
 * @returns {number} exit code
 */
export function printReadinessReport(lines) {
  let hasFail = false;
  let hasWarn = false;

  console.log("HairAudit upload event readiness (Phase 2G)\n");

  for (const line of lines) {
    const prefix = `[${line.status}]`;
    console.log(`${prefix} ${line.message}`);
    if (line.status === "FAIL") hasFail = true;
    if (line.status === "WARN") hasWarn = true;
  }

  console.log("");
  if (hasFail) {
    console.log("Result: FAIL — fix secret/config issues before enabling staging delivery.");
    return 1;
  }
  if (hasWarn) {
    console.log("Result: WARN — review flags before enabling staging delivery.");
    return 0;
  }
  console.log("Result: PASS — safe default; enable flags deliberately for staging.");
  return 0;
}

const isMain =
  process.argv[1] &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);

if (isMain) {
  const lines = runHairAuditEventReadinessChecks();
  const code = printReadinessReport(lines);
  process.exit(code);
}
