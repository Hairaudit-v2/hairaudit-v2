// HairAudit Mobile Surgery Upload Portal — Stage 4A
// Server-side filtering + pagination for the surgery upload index. The previous
// implementation fetched a capped 50-row set and filtered client-side; this moves
// the real work to the database so the portal scales with upload volume.
//
// Access model (unchanged): non-auditors are constrained to created_by = userId.
// clinic_profile_id is ONLY ever used as a filter/reporting key here — never as an
// access grant.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRequiredPhotoCountSummary } from "./checklist";
import { SURGERY_PROCEDURE_TYPES } from "./fields";
import { loadAuditIntakeStatusesByCase } from "./auditIntakeQuery";
import {
  UNKNOWN_CLINIC_KEY,
  type SurgeryUploadQueryParams,
} from "./listParams";

const PROCEDURE_LABELS: Record<string, string> = Object.fromEntries(
  SURGERY_PROCEDURE_TYPES.map((p) => [p.value, p.label])
);

const UNKNOWN_CLINIC_LABEL = "Unknown clinic";

// When missing=true we cannot express the per-case minCount completion check in
// pure SQL (it depends on per-slot upload counts vs JSON config), so we scan a
// bounded candidate window of the most-recent matching rows and post-filter in
// memory. Total/next-page are exact within the window and flagged approximate if
// the window saturates. 500 comfortably covers realistic clinic/doctor volumes
// while keeping the in-memory pass and the single uploads fetch cheap.
const MAX_MISSING_CANDIDATES = 500;

// Filter dropdown options must reflect more than the current page, so we derive
// them from a bounded recent scan of allowed uploads rather than distinct SQL.
const OPTIONS_SCAN_LIMIT = 1000;

const ROW_COLUMNS =
  "case_id, patient_reference, clinic_name, clinic_profile_id, surgeon_name, surgery_date, procedure_type, status, submitted_at, photo_checklist_config, created_at, created_by, evidence_review_status, audit_handoff_status";

/** Raw surgery_upload_details row as selected for the index. */
type RawRow = {
  case_id: string;
  patient_reference: string | null;
  clinic_name: string | null;
  clinic_profile_id: string | null;
  surgeon_name: string | null;
  surgery_date: string | null;
  procedure_type: string | null;
  status: string;
  submitted_at: string | null;
  photo_checklist_config: unknown | null;
  created_at: string;
  created_by: string | null;
  evidence_review_status: string | null;
  audit_handoff_status: string | null;
};

/** A fully-mapped, completion-annotated row handed to the client. */
export type SurgeryUploadListItem = {
  case_id: string;
  patient_reference: string | null;
  clinic_name: string | null;
  clinic_profile_id: string | null;
  surgeon_name: string | null;
  surgery_date: string | null;
  procedure_type: string | null;
  status: string;
  submitted_at: string | null;
  created_at: string;
  /** Stage 5: evidence review workflow status. */
  evidence_review_status: string;
  /** Stage 6B: audit pipeline handoff status. */
  audit_handoff_status: string;
  /** Stage 6C: audit intake queue status (null when no intake record exists). */
  audit_intake_status: string | null;
  /** Sum of min(uploaded, minCount) across required slots (the "7" in 7/8). */
  requiredSatisfiedCount: number;
  /** Sum of per-slot minCounts across required slots (the "8" in 7/8). */
  requiredCountTotal: number;
  /** True when any required slot is below its minCount. */
  missingRequired: boolean;
};

export type SelectOption = { value: string; label: string };

export type SurgeryUploadFilterOptions = {
  clinics: SelectOption[];
  surgeons: SelectOption[];
  procedures: SelectOption[];
};

export type SurgeryUploadListResult = {
  rows: SurgeryUploadListItem[];
  page: number;
  pageSize: number;
  /** Exact total when known; null is not used today but kept for forward-compat. */
  totalCount: number;
  /** True when totalCount is a lower bound (missing-filter window saturated). */
  totalCountApproximate: boolean;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  /** Null when the total is approximate (page count cannot be trusted). */
  totalPages: number | null;
  options: SurgeryUploadFilterOptions;
};

/** Escape LIKE/ILIKE wildcards so user text is matched literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

function clinicKey(row: {
  clinic_profile_id: string | null;
  clinic_name: string | null;
}): string {
  if (row.clinic_profile_id) return `id:${row.clinic_profile_id}`;
  const name = (row.clinic_name ?? "").trim();
  return name ? `name:${name.toLowerCase()}` : UNKNOWN_CLINIC_KEY;
}

function clinicLabel(row: { clinic_name: string | null }): string {
  const name = (row.clinic_name ?? "").trim();
  return name || UNKNOWN_CLINIC_LABEL;
}

/**
 * Apply access + sanitized filters to a surgery_upload_details query. Access is
 * applied FIRST and independently of clinic_profile_id so the clinic filter can
 * never widen visibility for non-auditors.
 */
function applyFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  isAuditor: boolean,
  userId: string,
  params: SurgeryUploadQueryParams
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  let q = query;
  if (!isAuditor) q = q.eq("created_by", userId);
  if (params.status !== "all") q = q.eq("status", params.status);
  if (params.reviewStatus) q = q.eq("evidence_review_status", params.reviewStatus);
  if (params.handoffStatus) q = q.eq("audit_handoff_status", params.handoffStatus);
  if (params.procedure) q = q.eq("procedure_type", params.procedure);
  if (params.surgeon) q = q.ilike("surgeon_name", `%${escapeLike(params.surgeon)}%`);
  if (params.clinic === UNKNOWN_CLINIC_KEY) {
    q = q.is("clinic_profile_id", null);
  } else if (params.clinic.startsWith("id:")) {
    q = q.eq("clinic_profile_id", params.clinic.slice(3));
  } else if (params.clinic.startsWith("name:")) {
    // Text-only fallback: only rows WITHOUT a linked clinic profile, matched on
    // the snapshot name case-insensitively (linked clinics use the id branch).
    q = q.is("clinic_profile_id", null).ilike("clinic_name", escapeLike(params.clinic.slice(5)));
  }
  if (params.from) q = q.gte("surgery_date", params.from);
  if (params.to) q = q.lte("surgery_date", params.to);
  return q;
}

/**
 * Fetch uploads for the given cases in ONE query and annotate each raw row with
 * minCount-aware required-photo completion. Avoids N+1 by grouping in memory.
 */
async function attachCompletion(
  admin: SupabaseClient,
  rows: RawRow[]
): Promise<SurgeryUploadListItem[]> {
  if (rows.length === 0) return [];
  const caseIds = rows.map((r) => r.case_id);
  const { data: ups } = await admin
    .from("uploads")
    .select("case_id, type")
    .in("case_id", caseIds);

  const byCase = new Map<string, { type: string }[]>();
  for (const u of (ups ?? []) as Array<{ case_id: string; type: string }>) {
    const arr = byCase.get(u.case_id);
    if (arr) arr.push({ type: u.type });
    else byCase.set(u.case_id, [{ type: u.type }]);
  }

  // Stage 6C: annotate each row with its audit intake status (best-effort).
  const intakeByCase = await loadAuditIntakeStatusesByCase(admin, caseIds);

  return rows.map((r) => {
    const summary = getRequiredPhotoCountSummary(
      byCase.get(r.case_id) ?? [],
      r.photo_checklist_config
    );
    return {
      case_id: r.case_id,
      patient_reference: r.patient_reference,
      clinic_name: r.clinic_name,
      clinic_profile_id: r.clinic_profile_id,
      surgeon_name: r.surgeon_name,
      surgery_date: r.surgery_date,
      procedure_type: r.procedure_type,
      status: r.status,
      submitted_at: r.submitted_at,
      created_at: r.created_at,
      evidence_review_status: r.evidence_review_status ?? "not_reviewed",
      audit_handoff_status: r.audit_handoff_status ?? "not_sent",
      audit_intake_status: intakeByCase.get(r.case_id) ?? null,
      requiredSatisfiedCount: summary.requiredSatisfiedCount,
      requiredCountTotal: summary.requiredCountTotal,
      missingRequired: summary.missingRequired,
    };
  });
}

/**
 * Build filter dropdown options from a bounded recent scan of ALLOWED uploads
 * (access filter only — independent of the active filters), so options are not
 * limited to the current page. Limitation: options reflect up to the most recent
 * OPTIONS_SCAN_LIMIT allowed uploads; older one-off values may not appear.
 */
async function loadFilterOptions(
  admin: SupabaseClient,
  isAuditor: boolean,
  userId: string
): Promise<SurgeryUploadFilterOptions> {
  let q = admin
    .from("surgery_upload_details")
    .select("clinic_profile_id, clinic_name, surgeon_name, procedure_type")
    .order("created_at", { ascending: false })
    .limit(OPTIONS_SCAN_LIMIT);
  if (!isAuditor) q = q.eq("created_by", userId);

  const { data } = await q;
  const rows = (data ?? []) as Array<{
    clinic_profile_id: string | null;
    clinic_name: string | null;
    surgeon_name: string | null;
    procedure_type: string | null;
  }>;

  const clinicMap = new Map<string, string>();
  const surgeonSet = new Set<string>();
  const procedureSet = new Set<string>();
  for (const r of rows) {
    const key = clinicKey(r);
    if (!clinicMap.has(key)) clinicMap.set(key, clinicLabel(r));
    const surgeon = (r.surgeon_name ?? "").trim();
    if (surgeon) surgeonSet.add(surgeon);
    const proc = (r.procedure_type ?? "").trim();
    if (proc) procedureSet.add(proc);
  }

  const clinics = Array.from(clinicMap.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const surgeons = Array.from(surgeonSet)
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ value, label: value }));
  const procedures = Array.from(procedureSet)
    .map((value) => ({ value, label: PROCEDURE_LABELS[value] ?? value }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return { clinics, surgeons, procedures };
}

/**
 * Load one page of the surgery upload index with server-side filtering,
 * pagination, completion annotation, and filter options.
 */
export async function loadSurgeryUploadIndex(opts: {
  admin: SupabaseClient;
  userId: string;
  isAuditor: boolean;
  params: SurgeryUploadQueryParams;
}): Promise<SurgeryUploadListResult> {
  const { admin, userId, isAuditor, params } = opts;
  const { page, pageSize } = params;
  const offset = (page - 1) * pageSize;

  const options = await loadFilterOptions(admin, isAuditor, userId);

  if (params.missing) {
    // Post-filter path: scan a bounded candidate window, compute completion, keep
    // only incomplete cases, then slice the requested page in memory.
    const base = applyFilters(
      admin.from("surgery_upload_details").select(ROW_COLUMNS),
      isAuditor,
      userId,
      params
    )
      .order("created_at", { ascending: false })
      .range(0, MAX_MISSING_CANDIDATES - 1);

    const { data } = await base;
    const candidates = (data ?? []) as RawRow[];
    const saturated = candidates.length === MAX_MISSING_CANDIDATES;

    const annotated = await attachCompletion(admin, candidates);
    const missingRows = annotated.filter((r) => r.missingRequired);

    const totalCount = missingRows.length;
    const rows = missingRows.slice(offset, offset + pageSize);
    const hasNextPage = offset + rows.length < totalCount;

    return {
      rows,
      page,
      pageSize,
      totalCount,
      totalCountApproximate: saturated,
      hasPrevPage: page > 1,
      hasNextPage,
      totalPages: saturated ? null : Math.max(1, Math.ceil(totalCount / pageSize)),
      options,
    };
  }

  // Standard path: exact server-side count + range pagination.
  const query = applyFilters(
    admin.from("surgery_upload_details").select(ROW_COLUMNS, { count: "exact" }),
    isAuditor,
    userId,
    params
  )
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const { data, count } = await query;
  const rawRows = (data ?? []) as RawRow[];
  const totalCount = count ?? 0;
  const rows = await attachCompletion(admin, rawRows);

  return {
    rows,
    page,
    pageSize,
    totalCount,
    totalCountApproximate: false,
    hasPrevPage: page > 1,
    hasNextPage: offset + rows.length < totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    options,
  };
}
