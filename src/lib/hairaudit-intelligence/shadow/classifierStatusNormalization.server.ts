/**
 * HA-INTELLIGENCE-5 — map FI classifier quality/protocol vocabulary to upload metadata contract.
 */

import type { PhotoProtocolStatus, PhotoQualityStatus } from "@/lib/hairaudit/uploadContract";

export type NormalizedFiClassifierStatuses = {
  qualityStatus: PhotoQualityStatus | null;
  protocolStatus: PhotoProtocolStatus | null;
  qualityStatusRaw: string | null;
  protocolStatusRaw: string | null;
};

function normalizeToken(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

const FI_QUALITY_PASS = new Set(["excellent", "good", "acceptable", "pass"]);
const FI_QUALITY_WARN = new Set(["warn", "warning", "minor_deviation"]);
const FI_QUALITY_FAIL = new Set([
  "low",
  "poor",
  "unacceptable",
  "fail",
  "failed",
  "missing_required_view",
  "non_compliant",
  "major_deviation",
]);
const FI_QUALITY_UNKNOWN = new Set(["unknown", "not_evaluated", ""]);

const FI_PROTOCOL_COMPLIANT = new Set(["compliant", "pass", "excellent", "good", "acceptable"]);
const FI_PROTOCOL_MINOR = new Set(["minor_deviation", "warn", "warning"]);
const FI_PROTOCOL_MAJOR = new Set([
  "major_deviation",
  "missing_required_view",
  "low",
  "poor",
]);
const FI_PROTOCOL_NON_COMPLIANT = new Set(["non_compliant", "unacceptable", "fail", "failed"]);
const FI_PROTOCOL_NOT_ASSESSED = new Set(["unknown", "not_evaluated", "not_assessed", ""]);

/** Map FI quality_status into upload metadata PhotoQualityStatus. */
export function normalizeFiQualityStatusToUploadContract(
  raw: unknown
): PhotoQualityStatus | null {
  const token = normalizeToken(raw);
  if (!token || FI_QUALITY_UNKNOWN.has(token)) return null;
  if (FI_QUALITY_PASS.has(token)) return "pass";
  if (FI_QUALITY_WARN.has(token)) return "warn";
  if (FI_QUALITY_FAIL.has(token)) return "fail";
  return "warn";
}

/** Map FI protocol_status into upload metadata PhotoProtocolStatus. */
export function normalizeFiProtocolStatusToUploadContract(
  raw: unknown
): PhotoProtocolStatus | null {
  const token = normalizeToken(raw);
  if (!token || FI_PROTOCOL_NOT_ASSESSED.has(token)) return null;
  if (FI_PROTOCOL_COMPLIANT.has(token)) return "compliant";
  if (FI_PROTOCOL_MINOR.has(token)) return "minor_deviation";
  if (FI_PROTOCOL_NON_COMPLIANT.has(token)) return "non_compliant";
  if (FI_PROTOCOL_MAJOR.has(token)) return "major_deviation";
  return "minor_deviation";
}

/** Normalize FI quality/protocol pair and preserve raw tokens for metadata write-back. */
export function normalizeFiClassifierStatuses(args: {
  qualityStatus?: unknown;
  protocolStatus?: unknown;
}): NormalizedFiClassifierStatuses {
  const qualityStatusRaw = readRawStatus(args.qualityStatus);
  const protocolStatusRaw = readRawStatus(args.protocolStatus);

  return {
    qualityStatus: normalizeFiQualityStatusToUploadContract(qualityStatusRaw),
    protocolStatus: normalizeFiProtocolStatusToUploadContract(protocolStatusRaw),
    qualityStatusRaw,
    protocolStatusRaw,
  };
}

function readRawStatus(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
