/**
 * FI-OUTCOME-INTELLIGENCE-1A — Pseudonymous cohort identity via keyed HMAC-SHA256.
 *
 * Not plain SHA-256 of IDs. Secret stays server-side. Namespaces separate
 * patient vs procedure vs partition keys.
 */

import { createHmac } from "node:crypto";

export const COHORT_SUBJECT_NAMESPACE = "fi-outcome-patient-v1" as const;
export const COHORT_PROCEDURE_NAMESPACE = "fi-outcome-procedure-v1" as const;
export const COHORT_PARTITION_NAMESPACE = "fi-outcome-partition-v1" as const;

/**
 * Single-deployment partition label for 1A.
 * Tenant strategy: deployment-local, provider-agnostic — no clinic/surgeon keys,
 * no silent cross-tenant pooling of identifiable tenant IDs.
 */
export const COHORT_DEFAULT_PARTITION_LABEL = "hairaudit-deployment" as const;

export class CohortHmacSecretMissingError extends Error {
  readonly code = "MISSING_HMAC_SECRET" as const;
  constructor(message = "FI_OUTCOME_COHORT_HMAC_SECRET is required.") {
    super(message);
    this.name = "CohortHmacSecretMissingError";
  }
}

function requireSecret(secret: string | null | undefined): string {
  const s = String(secret ?? "").trim();
  if (!s) throw new CohortHmacSecretMissingError();
  return s;
}

/**
 * Deterministic non-reversible analytics key.
 * Input format: `{namespace}:{stableIdentity}`
 */
export function hmacCohortKey(args: {
  secret: string | null | undefined;
  namespace: string;
  stableIdentity: string;
}): string {
  const secret = requireSecret(args.secret);
  const material = `${args.namespace}:${args.stableIdentity}`;
  return createHmac("sha256", secret).update(material, "utf8").digest("hex");
}

export function deriveCohortSubjectKey(args: {
  secret: string | null | undefined;
  patientId: string;
}): string {
  return hmacCohortKey({
    secret: args.secret,
    namespace: COHORT_SUBJECT_NAMESPACE,
    stableIdentity: args.patientId,
  });
}

export function deriveCohortProcedureKey(args: {
  secret: string | null | undefined;
  caseId: string;
}): string {
  return hmacCohortKey({
    secret: args.secret,
    namespace: COHORT_PROCEDURE_NAMESPACE,
    stableIdentity: args.caseId,
  });
}

export function deriveCohortPartitionKey(args: {
  secret: string | null | undefined;
  partitionLabel?: string;
}): string {
  return hmacCohortKey({
    secret: args.secret,
    namespace: COHORT_PARTITION_NAMESPACE,
    stableIdentity: args.partitionLabel ?? COHORT_DEFAULT_PARTITION_LABEL,
  });
}
