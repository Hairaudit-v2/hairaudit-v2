/**
 * HA-PRE-SURGERY-INTELLIGENCE-2C — ImagingOS HTTP projection provider adapter.
 * Authenticated requests, optional HMAC signing, timeouts, retries, idempotency keys.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type {
  PreSurgeryProjectionInput,
  PreSurgeryProjectionProvider,
  PreSurgeryProjectionResult,
} from "./provider";
import type { ResolvedProjectionProviderConfig } from "./config";
import { toProviderSafeCanonicalPayload } from "./canonicalRequest";
import { STANDARD_PRE_SURGERY_PROJECTION_ASSUMPTIONS } from "./modes";

export type ImagingOsFetchImpl = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type ImagingOsAdapterOptions = {
  config: ResolvedProjectionProviderConfig;
  authToken: string;
  signingSecret?: string | null;
  fetchImpl?: ImagingOsFetchImpl;
  sleep?: (ms: number) => Promise<void>;
};

const TRANSIENT_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function sleepDefault(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function signImagingOsRequest(args: {
  method: string;
  path: string;
  body: string;
  timestamp: string;
  idempotencyKey: string;
  secret: string;
}): string {
  const payload = [
    args.method.toUpperCase(),
    args.path,
    args.timestamp,
    args.idempotencyKey,
    createHash("sha256").update(args.body, "utf8").digest("hex"),
  ].join("\n");
  return createHmac("sha256", args.secret).update(payload, "utf8").digest("hex");
}

export function verifyImagingOsCallbackSignature(args: {
  body: string;
  timestamp: string;
  signature: string;
  secret: string;
  maxSkewSeconds?: number;
  nowMs?: number;
}): { ok: true } | { ok: false; code: "invalid_signature" | "timestamp_skew" } {
  const maxSkew = args.maxSkewSeconds ?? 300;
  const ts = Number.parseInt(args.timestamp, 10);
  const now = args.nowMs ?? Date.now();
  if (!Number.isFinite(ts) || Math.abs(now - ts * 1000) > maxSkew * 1000) {
    return { ok: false, code: "timestamp_skew" };
  }
  const expected = createHmac("sha256", args.secret)
    .update(`${args.timestamp}.${args.body}`, "utf8")
    .digest("hex");
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(args.signature.trim(), "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, code: "invalid_signature" };
    }
  } catch {
    return { ok: false, code: "invalid_signature" };
  }
  return { ok: true };
}

function buildRequestBody(input: PreSurgeryProjectionInput, modelVersion: string): string {
  const canonical = input.canonicalRequest
    ? toProviderSafeCanonicalPayload(input.canonicalRequest)
    : null;
  return JSON.stringify({
    schemaVersion: "ha-imagingos-pre-surgery-projection-request-v1",
    idempotencyKey: input.idempotencyKey ?? null,
    inputChecksum: input.inputChecksum ?? null,
    modelVersion,
    mode: input.mode,
    caseId: input.caseId,
    sourceImageId: input.sourceImageId,
    sourceImageRef: input.sourceImageRef,
    approvedGraftPlanId: input.approvedGraftPlanId,
    approvedGraftPlanVersion: input.approvedGraftPlan.version,
    approvedGraftPlanChecksum: input.approvedGraftPlan.checksum,
    approvedAnnotationIds: input.approvedAnnotations.map((a) => a.id),
    constraints: input.patientSafeProjectionConstraints,
    deterministicSeed: input.deterministicSeed ?? null,
    canonical,
  });
}

function parseSuccessBody(
  json: Record<string, unknown>,
  mode: PreSurgeryProjectionInput["mode"]
): Extract<PreSurgeryProjectionResult, { ok: true }> | null {
  const outputStorageRef = String(json.outputStorageRef ?? json.output_storage_ref ?? "").trim();
  const outputChecksum = String(json.outputChecksum ?? json.output_checksum ?? "").trim();
  if (!outputStorageRef || !outputChecksum) return null;
  return {
    ok: true,
    outputStorageRef,
    outputChecksum,
    limitations: Array.isArray(json.limitations)
      ? json.limitations.map(String)
      : [
          "Illustrative planning aid — not a guarantee of density, growth, survival, or final appearance.",
        ],
    planningAssumptions: Array.isArray(json.planningAssumptions)
      ? json.planningAssumptions.map(String)
      : [...STANDARD_PRE_SURGERY_PROJECTION_ASSUMPTIONS],
    mode,
    providerRequestId: json.providerRequestId
      ? String(json.providerRequestId)
      : json.request_id
        ? String(json.request_id)
        : null,
    providerResponseId: json.providerResponseId
      ? String(json.providerResponseId)
      : json.response_id
        ? String(json.response_id)
        : null,
    modelVersion: json.modelVersion ? String(json.modelVersion) : null,
  };
}

export function createImagingOsPreSurgeryProjectionProvider(
  options: ImagingOsAdapterOptions
): PreSurgeryProjectionProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? sleepDefault;
  const { config } = options;

  return {
    async healthcheck() {
      const started = Date.now();
      if (!config.endpoint || !options.authToken) {
        return {
          healthy: false,
          detail: "imagingos_misconfigured",
          latencyMs: Date.now() - started,
        };
      }
      try {
        const healthUrl = new URL("health", config.endpoint.endsWith("/") ? config.endpoint : `${config.endpoint}/`);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), config.connectTimeoutMs);
        const res = await fetchImpl(healthUrl, {
          method: "GET",
          headers: { Authorization: `Bearer ${options.authToken}` },
          signal: controller.signal,
        });
        clearTimeout(timer);
        return {
          healthy: res.ok,
          detail: res.ok ? "ok" : `http_${res.status}`,
          latencyMs: Date.now() - started,
        };
      } catch (e) {
        return {
          healthy: false,
          detail: e instanceof Error ? e.message : "healthcheck_failed",
          latencyMs: Date.now() - started,
        };
      }
    },

    async generateProjection(input: PreSurgeryProjectionInput): Promise<PreSurgeryProjectionResult> {
      if (!config.endpoint || !options.authToken) {
        return {
          ok: false,
          errorCode: "provider_misconfigured",
          message: "ImagingOS projection endpoint or token is not configured",
          retryable: false,
        };
      }

      if (input.abortSignal?.aborted) {
        return {
          ok: false,
          errorCode: "provider_cancelled",
          message: "Projection request was cancelled",
          retryable: false,
        };
      }

      const path = "/v1/pre-surgery/projections";
      const url = new URL(
        path.replace(/^\//, ""),
        config.endpoint.endsWith("/") ? config.endpoint : `${config.endpoint}/`
      );
      const body = buildRequestBody(input, config.modelVersion);
      const idempotencyKey =
        input.idempotencyKey ??
        createHash("sha256")
          .update(`${input.caseId}:${input.inputChecksum ?? input.sourceImageId}:${input.mode}`)
          .digest("hex")
          .slice(0, 32);

      let attempt = 0;
      let lastError: PreSurgeryProjectionResult | null = null;

      while (attempt <= config.maxRetries) {
        if (input.abortSignal?.aborted) {
          return {
            ok: false,
            errorCode: "provider_cancelled",
            message: "Projection request was cancelled",
            retryable: false,
          };
        }

        const timestamp = String(Math.floor(Date.now() / 1000));
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options.authToken}`,
          "Idempotency-Key": idempotencyKey,
          "X-HairAudit-Timestamp": timestamp,
          "X-HairAudit-Case-Id": input.caseId,
        };
        if (options.signingSecret) {
          headers["X-HairAudit-Signature"] = signImagingOsRequest({
            method: "POST",
            path,
            body,
            timestamp,
            idempotencyKey,
            secret: options.signingSecret,
          });
        }

        const controller = new AbortController();
        const onAbort = () => controller.abort();
        input.abortSignal?.addEventListener("abort", onAbort, { once: true });
        const timer = setTimeout(() => controller.abort(), config.generationTimeoutMs);

        try {
          const res = await fetchImpl(url, {
            method: "POST",
            headers,
            body,
            signal: controller.signal,
          });
          clearTimeout(timer);
          input.abortSignal?.removeEventListener("abort", onAbort);

          const text = await res.text();
          let json: Record<string, unknown> = {};
          try {
            json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
          } catch {
            lastError = {
              ok: false,
              errorCode: "provider_response_invalid",
              message: "ImagingOS returned non-JSON body",
              retryable: TRANSIENT_STATUS.has(res.status),
              httpStatus: res.status,
            };
            if (!lastError.retryable || attempt >= config.maxRetries) return lastError;
            attempt += 1;
            await sleep(100 * 2 ** attempt);
            continue;
          }

          if (!res.ok) {
            const retryable = TRANSIENT_STATUS.has(res.status);
            lastError = {
              ok: false,
              errorCode:
                res.status === 401 || res.status === 403
                  ? "provider_auth"
                  : retryable
                    ? "provider_transient"
                    : "provider_permanent",
              message: String(json.message ?? json.error ?? `ImagingOS HTTP ${res.status}`),
              retryable,
              httpStatus: res.status,
              providerRequestId: json.request_id ? String(json.request_id) : null,
              providerResponseId: json.response_id ? String(json.response_id) : null,
            };
            if (!retryable || attempt >= config.maxRetries) return lastError;
            attempt += 1;
            await sleep(100 * 2 ** attempt);
            continue;
          }

          if (json.ok === false || json.rejected === true) {
            return {
              ok: false,
              errorCode: String(json.errorCode ?? "provider_safety_rejected"),
              message: String(json.message ?? "ImagingOS rejected projection generation"),
              retryable: false,
              providerRequestId: json.request_id ? String(json.request_id) : null,
              providerResponseId: json.response_id ? String(json.response_id) : null,
            };
          }

          const success = parseSuccessBody(json, input.mode);
          if (!success) {
            return {
              ok: false,
              errorCode: "provider_response_invalid",
              message: "ImagingOS response missing outputStorageRef/outputChecksum",
              retryable: false,
              httpStatus: res.status,
            };
          }
          return {
            ...success,
            modelVersion: success.modelVersion ?? config.modelVersion,
          };
        } catch (e) {
          clearTimeout(timer);
          input.abortSignal?.removeEventListener("abort", onAbort);
          const aborted =
            (e instanceof Error && e.name === "AbortError") || input.abortSignal?.aborted;
          lastError = {
            ok: false,
            errorCode: aborted ? "provider_timeout" : "provider_transient",
            message: aborted
              ? "ImagingOS projection request timed out"
              : e instanceof Error
                ? e.message
                : "ImagingOS request failed",
            retryable: !aborted,
          };
          if (!lastError.retryable || attempt >= config.maxRetries) return lastError;
          attempt += 1;
          await sleep(100 * 2 ** attempt);
        }
      }

      return (
        lastError ?? {
          ok: false,
          errorCode: "provider_failure",
          message: "ImagingOS projection failed",
          retryable: false,
        }
      );
    },
  };
}
