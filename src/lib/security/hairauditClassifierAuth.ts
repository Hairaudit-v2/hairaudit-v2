/**
 * HairAudit → FI OS image classifier internal API authentication.
 * Uses HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN only — never SUPABASE_SERVICE_ROLE_KEY.
 *
 * See: docs/hairaudit-phase-3f-fi-classifier-endpoint.md
 */

import { timingSafeEqual } from "crypto";
import { isProductionRuntime } from "@/lib/security/secrets";

export const HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN_ENV = "HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN" as const;
export const HAIRAUDIT_IMAGE_CLASSIFIER_MODE_ENV = "HAIRAUDIT_IMAGE_CLASSIFIER_MODE" as const;

export const MIN_CLASSIFIER_TOKEN_LENGTH = 16;

export function getHairauditClassifierToken(env: NodeJS.ProcessEnv = process.env): string | null {
  const token = env[HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN_ENV]?.trim();
  return token || null;
}

export function resolveProvidedBearerToken(req: Request): string {
  const auth = req.headers.get("authorization")?.trim() ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

function timingSafeTokenEqual(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}

export type HairauditClassifierTokenValidation =
  | { valid: true; token: string }
  | { valid: false; reason: "missing_config" | "too_short" | "service_role_reused" };

export function validateHairauditClassifierTokenConfig(
  env: NodeJS.ProcessEnv = process.env
): HairauditClassifierTokenValidation {
  const token = getHairauditClassifierToken(env);
  if (!token) {
    return { valid: false, reason: "missing_config" };
  }

  if (token.length < MIN_CLASSIFIER_TOKEN_LENGTH) {
    return { valid: false, reason: "too_short" };
  }

  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (serviceRole && token === serviceRole) {
    return { valid: false, reason: "service_role_reused" };
  }

  return { valid: true, token };
}

export function authorizeHairauditClassifierRequest(
  req: Request,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const config = validateHairauditClassifierTokenConfig(env);
  if (!config.valid) return false;

  const provided = resolveProvidedBearerToken(req);
  if (!provided || provided.length < MIN_CLASSIFIER_TOKEN_LENGTH) {
    return false;
  }

  return timingSafeTokenEqual(provided, config.token);
}

export function resolveHairauditClassifierMode(
  env: NodeJS.ProcessEnv = process.env
): "stub" | "live" {
  const mode = env[HAIRAUDIT_IMAGE_CLASSIFIER_MODE_ENV]?.trim().toLowerCase();
  return mode === "stub" ? "stub" : "live";
}

/** Log a production warning when stub mode is enabled (rollback / staging only). */
export function warnIfStubModeInProduction(env: NodeJS.ProcessEnv = process.env): void {
  if (isProductionRuntime() && resolveHairauditClassifierMode(env) === "stub") {
    // eslint-disable-next-line no-console
    console.warn(
      "[hairaudit-classifier] HAIRAUDIT_IMAGE_CLASSIFIER_MODE=stub is enabled in production — intended for rollback/testing only"
    );
  }
}
