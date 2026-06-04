// HairAudit Mobile Surgery Upload Portal — Stage 4A
// Sanitization of the surgery-upload index URL search params. Everything that
// flows into a server-side query passes through here first so raw user input
// never reaches the query builder unchecked.
import { isValidProcedureType } from "./fields";
import { isEvidenceReviewStatus, type EvidenceReviewStatus } from "./evidenceReview";
import { isAuditHandoffStatus, type AuditHandoffStatus } from "./auditHandoff";

/** Allowed page sizes (default first). Anything else sanitizes to the default. */
export const SURGERY_PAGE_SIZES = [25, 50, 100] as const;
export const DEFAULT_SURGERY_PAGE_SIZE = 25;

/** Bound for the free-text surgeon search so we never build absurd LIKE patterns. */
export const MAX_SURGEON_FILTER_LENGTH = 120;
/** Bound for the text-only clinic fallback key. */
export const MAX_CLINIC_NAME_FILTER_LENGTH = 200;

export type SurgeryStatusFilter = "all" | "draft" | "submitted";

/** "" means all review statuses; otherwise a valid EvidenceReviewStatus. */
export type SurgeryReviewStatusFilter = "" | EvidenceReviewStatus;

/** "" means all handoff statuses; otherwise a valid AuditHandoffStatus. */
export type SurgeryHandoffStatusFilter = "" | AuditHandoffStatus;

/** Sanitized, query-ready filter state (no pagination). */
export type SurgeryUploadFilters = {
  status: SurgeryStatusFilter;
  /** Stage 5: evidence review status filter ("" = all). */
  reviewStatus: SurgeryReviewStatusFilter;
  /** Stage 6B: audit handoff status filter ("" = all). */
  handoffStatus: SurgeryHandoffStatusFilter;
  /** "" | "id:<uuid>" | "name:<lowercased>" | "__unknown__" */
  clinic: string;
  /** Trimmed, length-limited free text for a case-insensitive partial match. */
  surgeon: string;
  /** "" or a valid procedure type. */
  procedure: string;
  missing: boolean;
  /** Inclusive YYYY-MM-DD lower bound, or null when absent/invalid. */
  from: string | null;
  /** Inclusive YYYY-MM-DD upper bound, or null when absent/invalid. */
  to: string | null;
};

export type SurgeryUploadQueryParams = SurgeryUploadFilters & {
  page: number;
  pageSize: number;
};

export const UNKNOWN_CLINIC_KEY = "__unknown__";

type RawSearchParams = Record<string, string | string[] | undefined>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function firstValue(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

/**
 * Validate a YYYY-MM-DD string. Rejects malformed strings AND impossible
 * calendar dates (e.g. 2026-02-31) via a UTC round-trip. Returns null on any
 * failure so callers can safely ignore invalid dates.
 */
function sanitizeDate(raw: string): string | null {
  const v = raw.trim();
  if (!DATE_RE.test(v)) return null;
  const ts = Date.parse(`${v}T00:00:00Z`);
  if (Number.isNaN(ts)) return null;
  const roundTrip = new Date(ts).toISOString().slice(0, 10);
  return roundTrip === v ? v : null;
}

/**
 * Normalize the clinic filter value. Mirrors the option keys produced server-side
 * so a selected option always round-trips. Linked clinics use the stable
 * clinic_profile_id ("id:<uuid>"); text-only fallback uses a lowercased name; the
 * shared unknown bucket covers rows with no linked clinic. Anything else => "".
 */
function sanitizeClinic(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (v === UNKNOWN_CLINIC_KEY) return UNKNOWN_CLINIC_KEY;
  if (v.startsWith("id:")) {
    const id = v.slice(3);
    return UUID_RE.test(id) ? `id:${id.toLowerCase()}` : "";
  }
  if (v.startsWith("name:")) {
    const name = v.slice(5).slice(0, MAX_CLINIC_NAME_FILTER_LENGTH).trim().toLowerCase();
    return name ? `name:${name}` : "";
  }
  return "";
}

/**
 * Parse + sanitize the raw search params into a safe, query-ready shape.
 * Invalid values fall back to safe defaults rather than throwing.
 */
export function parseSurgeryUploadSearchParams(
  raw: RawSearchParams
): SurgeryUploadQueryParams {
  const statusRaw = firstValue(raw.status).trim();
  const status: SurgeryStatusFilter =
    statusRaw === "draft" || statusRaw === "submitted" ? statusRaw : "all";

  const reviewStatusRaw = firstValue(raw.reviewStatus).trim();
  const reviewStatus: SurgeryReviewStatusFilter = isEvidenceReviewStatus(reviewStatusRaw)
    ? reviewStatusRaw
    : "";

  const handoffStatusRaw = firstValue(raw.handoffStatus).trim();
  const handoffStatus: SurgeryHandoffStatusFilter = isAuditHandoffStatus(handoffStatusRaw)
    ? handoffStatusRaw
    : "";

  const procedureRaw = firstValue(raw.procedure).trim();
  const procedure = isValidProcedureType(procedureRaw) ? procedureRaw : "";

  const surgeon = firstValue(raw.surgeon).trim().slice(0, MAX_SURGEON_FILTER_LENGTH);

  const clinic = sanitizeClinic(firstValue(raw.clinic));

  const missingRaw = firstValue(raw.missing).trim();
  const missing = missingRaw === "1" || missingRaw === "true";

  const from = sanitizeDate(firstValue(raw.from));
  const to = sanitizeDate(firstValue(raw.to));

  const pageSizeRaw = Number(firstValue(raw.pageSize));
  const pageSize = (SURGERY_PAGE_SIZES as readonly number[]).includes(pageSizeRaw)
    ? pageSizeRaw
    : DEFAULT_SURGERY_PAGE_SIZE;

  const pageRaw = Math.floor(Number(firstValue(raw.page)));
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;

  return {
    status,
    reviewStatus,
    handoffStatus,
    clinic,
    surgeon,
    procedure,
    missing,
    from,
    to,
    page,
    pageSize,
  };
}

/** True when any non-default filter is active (drives empty-state copy / clear UI). */
export function hasActiveSurgeryFilters(f: SurgeryUploadFilters): boolean {
  return (
    f.status !== "all" ||
    Boolean(f.reviewStatus) ||
    Boolean(f.handoffStatus) ||
    Boolean(f.clinic) ||
    Boolean(f.surgeon) ||
    Boolean(f.procedure) ||
    f.missing ||
    Boolean(f.from) ||
    Boolean(f.to)
  );
}
