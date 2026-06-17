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
 *      docs/hairaudit-v2-phase-3a-fi-image-intelligence-enqueue.md
 *      docs/hairaudit-v2-phase-3b-fi-image-intelligence-worker-scaffold.md
 *      docs/hairaudit-v2-phase-3c-image-intelligence-persistence.md
 *      docs/hairaudit-v2-phase-3d-image-fetch-classifier-adapter.md
 *      docs/hairaudit-v2-phase-3e-fi-os-classifier-adapter.md
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
    description: "FI image-intelligence enqueue switch (Phase 3A — no AI execution)",
  },
  {
    id: "HAIRAUDIT_FI_IMAGE_INTELLIGENCE_WORKER_ENABLED",
    requiredForDelivery: false,
    description: "FI image-intelligence worker dry-run switch (Phase 3B — no AI execution)",
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

const FI_OS_CLASSIFIER_ENV = {
  url: "FI_OS_IMAGE_CLASSIFIER_URL",
  token: "FI_OS_IMAGE_CLASSIFIER_TOKEN",
};

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {{ ok: true } | { ok: false; reason: string }}
 */
function validateFiOsClassifierReadiness(env) {
  const url = env[FI_OS_CLASSIFIER_ENV.url]?.trim() ?? "";
  const token = env[FI_OS_CLASSIFIER_ENV.token]?.trim() ?? "";
  const nodeEnv = (env.NODE_ENV ?? "").trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url) {
    return {
      ok: false,
      reason: `${FI_OS_CLASSIFIER_ENV.url} is required when HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER=fi_os`,
    };
  }

  if (!token) {
    return {
      ok: false,
      reason: `${FI_OS_CLASSIFIER_ENV.token} is required when HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER=fi_os`,
    };
  }

  try {
    // eslint-disable-next-line no-new
    new URL(url);
  } catch {
    return {
      ok: false,
      reason: `${FI_OS_CLASSIFIER_ENV.url} is not a valid URL`,
    };
  }

  if (nodeEnv === "production" && !url.startsWith("https://")) {
    return {
      ok: false,
      reason: `${FI_OS_CLASSIFIER_ENV.url} must use HTTPS in production`,
    };
  }

  if (serviceRoleKey) {
    if (token === serviceRoleKey || url.includes(serviceRoleKey)) {
      return {
        ok: false,
        reason: `${FI_OS_CLASSIFIER_ENV.token} must not reuse SUPABASE_SERVICE_ROLE_KEY`,
      };
    }
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
  const fiImageIntelligenceWorkerEnabled =
    env.HAIRAUDIT_FI_IMAGE_INTELLIGENCE_WORKER_ENABLED === "true";
  const fiImageFetchEnabled = env.HAIRAUDIT_FI_IMAGE_FETCH_ENABLED === "true";
  const fiClassifierProvider = (
    env.HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER?.trim().toLowerCase() || "dry_run"
  );
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
        const inngestKey = env.INNGEST_EVENT_KEY?.trim();
        lines.push({
          id: flag.id,
          status: "WARN",
          message:
            `${flag.id}=true — FI image-intelligence enqueue active (Phase 3A); worker dry-run available when HAIRAUDIT_FI_IMAGE_INTELLIGENCE_WORKER_ENABLED=true`,
        });
        if (!inngestKey) {
          lines.push({
            id: "INNGEST_EVENT_KEY",
            status: "WARN",
            message:
              "INNGEST_EVENT_KEY unset — FI enqueue will skip until Inngest is configured",
          });
        } else {
          lines.push({
            id: "INNGEST_EVENT_KEY",
            status: "PASS",
            message: "INNGEST_EVENT_KEY is set (durable FI enqueue available)",
          });
        }
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
          message: `${flag.id} off (default — bridge mapping only, no enqueue)`,
        });
      }
      continue;
    }

    if (flag.id === "HAIRAUDIT_FI_IMAGE_INTELLIGENCE_WORKER_ENABLED") {
      if (isTrue) {
        lines.push({
          id: flag.id,
          status: "WARN",
          message:
            `${flag.id}=true — FI image-intelligence worker active (Phase 3C dry-run + persistence; no AI execution)`,
        });
        const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
        if (!serviceRoleKey) {
          lines.push({
            id: "fi-worker-persistence",
            status: "WARN",
            message:
              "SUPABASE_SERVICE_ROLE_KEY unset — worker persists to in-memory fallback only; enable service role for durable fi_image_intelligence_processed_jobs writes",
          });
        } else {
          lines.push({
            id: "fi-worker-persistence",
            status: "PASS",
            message:
              "SUPABASE_SERVICE_ROLE_KEY is set (fi_image_intelligence_processed_jobs persistence available)",
          });
        }
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
          message: `${flag.id} off (default — worker registered but returns skipped)`,
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
      message: "FI image intelligence enqueue disabled (expected default — no jobs submitted)",
    });
  } else {
    lines.push({
      id: "fi-ai-execution",
      status: "WARN",
      message:
        "HAIRAUDIT_FI_IMAGE_INTELLIGENCE_ENABLED=true — jobs enqueue via Inngest; worker dry-run requires HAIRAUDIT_FI_IMAGE_INTELLIGENCE_WORKER_ENABLED",
    });
  }

  if (fiImageIntelligenceWorkerEnabled) {
    lines.push({
      id: "fi-worker-dry-run",
      status: "WARN",
      message:
        "HAIRAUDIT_FI_IMAGE_INTELLIGENCE_WORKER_ENABLED=true — worker active (Phase 3D fetch/classifier scaffold; real AI not implemented)",
    });
  } else {
    lines.push({
      id: "fi-worker-dry-run",
      status: "PASS",
      message: "FI image-intelligence worker disabled (expected default — jobs skipped at handler)",
    });
  }

  if (fiImageFetchEnabled && !fiImageIntelligenceWorkerEnabled) {
    lines.push({
      id: "fi-image-fetch-without-worker",
      status: "WARN",
      message:
        "HAIRAUDIT_FI_IMAGE_FETCH_ENABLED=true but HAIRAUDIT_FI_IMAGE_INTELLIGENCE_WORKER_ENABLED is off — fetch will not run until worker is enabled",
    });
  } else if (fiImageFetchEnabled) {
    lines.push({
      id: "fi-image-fetch",
      status: "WARN",
      message:
        "HAIRAUDIT_FI_IMAGE_FETCH_ENABLED=true — worker will download image bytes from Supabase storage (requires SUPABASE_SERVICE_ROLE_KEY)",
    });
  } else {
    lines.push({
      id: "fi-image-fetch",
      status: "PASS",
      message: "HAIRAUDIT_FI_IMAGE_FETCH_ENABLED off (default — path validation only, no byte fetch)",
    });
  }

  const validProviders = new Set(["dry_run", "fi_os", "openai", "manual_stub"]);
  if (!validProviders.has(fiClassifierProvider)) {
    lines.push({
      id: "fi-classifier-provider",
      status: "WARN",
      message: `HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER=${fiClassifierProvider} is unknown — defaulting to dry_run`,
    });
  } else {
    lines.push({
      id: "fi-classifier-provider",
      status: fiClassifierProvider === "dry_run" ? "PASS" : "WARN",
      message: `HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER=${fiClassifierProvider}`,
    });
  }

  if (fiClassifierProvider === "fi_os") {
    const fiOsCheck = validateFiOsClassifierReadiness(env);
    if (!fiOsCheck.ok) {
      lines.push({
        id: "fi-classifier-ai-env",
        status: "FAIL",
        message: fiOsCheck.reason,
      });
    } else {
      lines.push({
        id: "fi-classifier-ai-env",
        status: "WARN",
        message:
          "FI_OS_IMAGE_CLASSIFIER_URL and FI_OS_IMAGE_CLASSIFIER_TOKEN are set — fi_os adapter will call the internal FI endpoint",
      });
    }
  } else if (fiClassifierProvider === "openai") {
    const hasKey = Boolean(env.OPENAI_API_KEY?.trim());
    if (!hasKey) {
      lines.push({
        id: "fi-classifier-ai-env",
        status: "FAIL",
        message:
          "OPENAI_API_KEY is required when HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER=openai",
      });
    } else {
      lines.push({
        id: "fi-classifier-ai-env",
        status: "WARN",
        message:
          "OPENAI_API_KEY is set but openai classification is not implemented (Phase 3F+)",
      });
    }
  }

  if (fiClassifierProvider === "fi_os") {
    lines.push({
      id: "fi-ai-execution-phase3e",
      status: "PASS",
      message:
        "fi_os provider uses internal FI HTTP adapter only — no direct OpenAI / Claude / Gemini calls",
    });
  } else {
    lines.push({
      id: "fi-ai-execution-phase3e",
      status: "PASS",
      message:
        "Direct OpenAI / Claude / Gemini classification not wired — use fi_os adapter or manual_stub/dry_run",
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

  console.log("HairAudit upload event readiness (Phase 2G / 3A / 3B / 3C / 3D / 3E)\n");

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
