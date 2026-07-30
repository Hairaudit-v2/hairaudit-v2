/**
 * HA-PRE-SURGERY-INTELLIGENCE-2D — Provider-output validation before clinician_review.
 *
 * Malformed or mismatched output must move the attempt to failed, not clinician_review.
 */

import type { PreSurgeryIllustrativeProjection } from "../types";

export const SUPPORTED_PROJECTION_OUTPUT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type ProjectionOutputValidationInput = {
  caseId: string;
  attemptId: string;
  expectedProviderRequestId: string | null;
  actualProviderRequestId: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  widthPx: number | null;
  heightPx: number | null;
  outputChecksum: string | null;
  storageChecksumRecorded: boolean;
  safetyMetadataPresent: boolean;
  /** True if payload looks executable / polyglot / HTML/JS. */
  malformedOrExecutablePayload: boolean;
  /** True if unexpected embedded patient-identifying fields detected. */
  unexpectedEmbeddedPatientData: boolean;
  maxFileSizeBytes?: number;
  expectedMinWidth?: number;
  expectedMinHeight?: number;
  expectedMaxWidth?: number;
  expectedMaxHeight?: number;
};

export type ProjectionOutputValidationCheck = {
  check: string;
  passed: boolean;
  detail: string;
};

export type ProjectionOutputValidationResult =
  | {
      ok: true;
      checks: ProjectionOutputValidationCheck[];
      targetStatus: "clinician_review";
    }
  | {
      ok: false;
      checks: ProjectionOutputValidationCheck[];
      failures: ProjectionOutputValidationCheck[];
      targetStatus: "failed";
      failureCode: string;
      failureMessage: string;
    };

const DEFAULT_MAX_BYTES = 15 * 1024 * 1024;
const DEFAULT_MIN_DIM = 256;
const DEFAULT_MAX_DIM = 8192;

function c(check: string, passed: boolean, detail: string): ProjectionOutputValidationCheck {
  return { check, passed, detail };
}

export function validateProviderProjectionOutput(
  input: ProjectionOutputValidationInput
): ProjectionOutputValidationResult {
  const maxBytes = input.maxFileSizeBytes ?? DEFAULT_MAX_BYTES;
  const minW = input.expectedMinWidth ?? DEFAULT_MIN_DIM;
  const minH = input.expectedMinHeight ?? DEFAULT_MIN_DIM;
  const maxW = input.expectedMaxWidth ?? DEFAULT_MAX_DIM;
  const maxH = input.expectedMaxHeight ?? DEFAULT_MAX_DIM;

  const mimeOk =
    input.mimeType != null &&
    (SUPPORTED_PROJECTION_OUTPUT_MIME_TYPES as readonly string[]).includes(input.mimeType);

  const checks: ProjectionOutputValidationCheck[] = [
    c(
      "supported_image_format",
      mimeOk,
      mimeOk
        ? `MIME type ${input.mimeType} supported`
        : `Unsupported or missing MIME type: ${input.mimeType ?? "null"}`
    ),
    c(
      "valid_mime_type",
      mimeOk,
      mimeOk ? "Valid image MIME type" : "MIME type is not a supported image type"
    ),
    c(
      "maximum_file_size",
      input.fileSizeBytes != null && input.fileSizeBytes > 0 && input.fileSizeBytes <= maxBytes,
      input.fileSizeBytes != null
        ? `Size ${input.fileSizeBytes} bytes (max ${maxBytes})`
        : "File size missing"
    ),
    c(
      "expected_dimensions",
      input.widthPx != null &&
        input.heightPx != null &&
        input.widthPx >= minW &&
        input.heightPx >= minH &&
        input.widthPx <= maxW &&
        input.heightPx <= maxH,
      input.widthPx != null && input.heightPx != null
        ? `Dimensions ${input.widthPx}x${input.heightPx}`
        : "Dimensions missing"
    ),
    c(
      "no_malformed_or_executable_payload",
      !input.malformedOrExecutablePayload,
      input.malformedOrExecutablePayload
        ? "Malformed or executable payload detected"
        : "Payload is not executable/malformed"
    ),
    c(
      "case_and_attempt_correspondence",
      Boolean(input.caseId) && Boolean(input.attemptId),
      "Output must correspond to the requested case and attempt"
    ),
    c(
      "provider_request_id_match",
      !input.expectedProviderRequestId ||
        input.expectedProviderRequestId === input.actualProviderRequestId,
      input.expectedProviderRequestId
        ? input.expectedProviderRequestId === input.actualProviderRequestId
          ? "Provider request ID matches"
          : "Provider request ID mismatch"
        : "No expected provider request ID (sync provider)"
    ),
    c(
      "safety_metadata_present",
      input.safetyMetadataPresent,
      input.safetyMetadataPresent
        ? "Safety metadata present"
        : "Missing required safety metadata"
    ),
    c(
      "no_unexpected_embedded_patient_data",
      !input.unexpectedEmbeddedPatientData,
      input.unexpectedEmbeddedPatientData
        ? "Unexpected embedded patient data detected"
        : "No unexpected embedded patient data"
    ),
    c(
      "storage_checksum_recorded",
      input.storageChecksumRecorded && Boolean(input.outputChecksum),
      input.storageChecksumRecorded && input.outputChecksum
        ? `Storage checksum recorded: ${input.outputChecksum.slice(0, 12)}…`
        : "Storage checksum missing"
    ),
  ];

  const failures = checks.filter((x) => !x.passed);
  if (failures.length > 0) {
    return {
      ok: false,
      checks,
      failures,
      targetStatus: "failed",
      failureCode: failures[0]!.check,
      failureMessage: failures.map((f) => f.detail).join("; "),
    };
  }

  return { ok: true, checks, targetStatus: "clinician_review" };
}

/** Apply output-validation outcome to a projection attempt. */
export function applyOutputValidationToProjection(
  projection: PreSurgeryIllustrativeProjection,
  validation: ProjectionOutputValidationResult
): PreSurgeryIllustrativeProjection {
  if (validation.ok) {
    return {
      ...projection,
      status: "clinician_review",
      patientSharingEnabled: false,
    };
  }
  return {
    ...projection,
    status: "failed",
    patientSharingEnabled: false,
    failureCode: validation.failureCode,
    failureMessage: validation.failureMessage,
    storagePath: null,
  };
}
