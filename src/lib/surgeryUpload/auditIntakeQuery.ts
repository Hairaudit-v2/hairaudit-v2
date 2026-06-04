// HairAudit Mobile Surgery Upload Portal — Stage 6C
// Server-side loaders for the audit intake queue: list (filter + paginate),
// load-by-case, and snapshot building. Access control is the CALLER's
// responsibility — the dashboard page gates on canManageAuditIntake (auditor/admin
// only) before calling the list loader, and per-case loaders are only invoked on
// pages that already enforced case access. RLS is the backstop.
//
// Access model: clinic_profile_id is ONLY ever a filter/reporting key here, never
// an access grant. The queue is auditor/admin-only; per-case status is read-only
// for participants on case pages.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRequiredPhotoCountSummary } from "./checklist";
import { SURGERY_PROCEDURE_TYPES } from "./fields";
import {
  normalizeAuditIntakePriority,
  normalizeAuditIntakeStatus,
  type AuditIntakePriority,
  type AuditIntakeRow,
  type AuditIntakeStatus,
} from "./auditIntake";
import {
  UNKNOWN_CLINIC_KEY,
  type AuditIntakeQueryParams,
} from "./auditIntakeListParams";

const PROCEDURE_LABELS: Record<string, string> = Object.fromEntries(
  SURGERY_PROCEDURE_TYPES.map((p) => [p.value, p.label])
);

const UNKNOWN_CLINIC_LABEL = "Unknown clinic";

// Bounded scan window for the detail-filtered path + filter options. The intake
// queue is small relative to the upload index, so this comfortably covers it.
const MAX_CANDIDATES = 500;
const OPTIONS_SCAN_LIMIT = 1000;

const INTAKE_ROW_COLUMNS =
  "id, case_id, surgery_upload_details_id, status, priority, assigned_to, created_by, created_at, updated_at, started_at, completed_at, cancelled_at, failed_at, error_message, intake_notes, reviewer_notes, source, metadata";

type DetailRow = {
  case_id: string;
  patient_reference: string | null;
  clinic_name: string | null;
  clinic_profile_id: string | null;
  surgeon_name: string | null;
  surgery_date: string | null;
  procedure_type: string | null;
  evidence_review_status: string | null;
  audit_handoff_status: string | null;
  photo_checklist_config: unknown | null;
};

/** A fully-mapped, display-ready intake queue row. */
export type AuditIntakeQueueRow = {
  id: string;
  case_id: string;
  status: AuditIntakeStatus;
  priority: AuditIntakePriority;
  assigned_to: string | null;
  assignedLabel: string | null;
  intake_notes: string | null;
  reviewer_notes: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  patient_reference: string | null;
  clinic_name: string | null;
  clinic_profile_id: string | null;
  surgeon_name: string | null;
  procedure_type: string | null;
  surgery_date: string | null;
  evidence_review_status: string;
  audit_handoff_status: string;
  requiredSatisfiedCount: number;
  requiredCountTotal: number;
  missingRequired: boolean;
};

export type SelectOption = { value: string; label: string };

export type AuditIntakeFilterOptions = {
  clinics: SelectOption[];
  surgeons: SelectOption[];
  procedures: SelectOption[];
  assignees: SelectOption[];
};

export type AuditIntakeListResult = {
  rows: AuditIntakeQueueRow[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalCountApproximate: boolean;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  totalPages: number | null;
  options: AuditIntakeFilterOptions;
};

function clinicKey(row: { clinic_profile_id: string | null; clinic_name: string | null }): string {
  if (row.clinic_profile_id) return `id:${row.clinic_profile_id}`;
  const name = (row.clinic_name ?? "").trim();
  return name ? `name:${name.toLowerCase()}` : UNKNOWN_CLINIC_KEY;
}

function clinicLabel(row: { clinic_name: string | null }): string {
  return (row.clinic_name ?? "").trim() || UNKNOWN_CLINIC_LABEL;
}

/** Apply intake-column filters (status/priority/assigned/date). */
function applyIntakeFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  params: AuditIntakeQueryParams
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  let q = query;
  if (params.status !== "all") q = q.eq("status", params.status);
  if (params.priority) q = q.eq("priority", params.priority);
  if (params.assignedTo === "unassigned") q = q.is("assigned_to", null);
  else if (params.assignedTo) q = q.eq("assigned_to", params.assignedTo);
  if (params.from) q = q.gte("created_at", params.from);
  if (params.to) q = q.lte("created_at", `${params.to}T23:59:59.999Z`);
  return q;
}

/** True when any filter that lives on surgery_upload_details is active. */
function hasDetailFilter(params: AuditIntakeQueryParams): boolean {
  return Boolean(params.clinic || params.procedure || params.search);
}

async function loadDetailsByCase(
  admin: SupabaseClient,
  caseIds: string[]
): Promise<Map<string, DetailRow>> {
  const map = new Map<string, DetailRow>();
  if (caseIds.length === 0) return map;
  const { data } = await admin
    .from("surgery_upload_details")
    .select(
      "case_id, patient_reference, clinic_name, clinic_profile_id, surgeon_name, surgery_date, procedure_type, evidence_review_status, audit_handoff_status, photo_checklist_config"
    )
    .in("case_id", caseIds);
  for (const r of (data ?? []) as DetailRow[]) map.set(r.case_id, r);
  return map;
}

async function loadCompletionByCase(
  admin: SupabaseClient,
  details: Map<string, DetailRow>
): Promise<Map<string, ReturnType<typeof getRequiredPhotoCountSummary>>> {
  const result = new Map<string, ReturnType<typeof getRequiredPhotoCountSummary>>();
  const caseIds = Array.from(details.keys());
  if (caseIds.length === 0) return result;
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
  for (const [caseId, detail] of details) {
    result.set(
      caseId,
      getRequiredPhotoCountSummary(byCase.get(caseId) ?? [], detail.photo_checklist_config)
    );
  }
  return result;
}

async function loadAssigneeLabels(
  admin: SupabaseClient,
  assignedIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const ids = Array.from(new Set(assignedIds.filter(Boolean)));
  if (ids.length === 0) return map;
  try {
    const { data } = await admin
      .from("profiles")
      .select("id, role, display_name")
      .in("id", ids);
    for (const p of (data ?? []) as Array<{
      id: string;
      role?: string | null;
      display_name?: string | null;
    }>) {
      const name = p.display_name?.trim();
      map.set(p.id, name || (p.role === "auditor" ? "Reviewer" : "User"));
    }
  } catch {
    /* assignee enrichment is non-critical */
  }
  return map;
}

/** Map raw intake rows + joined details/completion/assignees into view models. */
function mapRows(
  intakeRows: AuditIntakeRow[],
  details: Map<string, DetailRow>,
  completion: Map<string, ReturnType<typeof getRequiredPhotoCountSummary>>,
  assignees: Map<string, string>
): AuditIntakeQueueRow[] {
  return intakeRows.map((r) => {
    const d = details.get(r.case_id);
    const comp = completion.get(r.case_id);
    return {
      id: r.id,
      case_id: r.case_id,
      status: normalizeAuditIntakeStatus(r.status),
      priority: normalizeAuditIntakePriority(r.priority),
      assigned_to: r.assigned_to,
      assignedLabel: r.assigned_to ? assignees.get(r.assigned_to) ?? "Reviewer" : null,
      intake_notes: r.intake_notes,
      reviewer_notes: r.reviewer_notes,
      error_message: r.error_message,
      created_at: r.created_at,
      updated_at: r.updated_at,
      started_at: r.started_at,
      completed_at: r.completed_at,
      patient_reference: d?.patient_reference ?? null,
      clinic_name: d?.clinic_name ?? null,
      clinic_profile_id: d?.clinic_profile_id ?? null,
      surgeon_name: d?.surgeon_name ?? null,
      procedure_type: d?.procedure_type ?? null,
      surgery_date: d?.surgery_date ?? null,
      evidence_review_status: d?.evidence_review_status ?? "not_reviewed",
      audit_handoff_status: d?.audit_handoff_status ?? "not_sent",
      requiredSatisfiedCount: comp?.requiredSatisfiedCount ?? 0,
      requiredCountTotal: comp?.requiredCountTotal ?? 0,
      missingRequired: comp?.missingRequired ?? false,
    };
  });
}

function matchesDetailFilter(
  row: AuditIntakeQueueRow,
  params: AuditIntakeQueryParams
): boolean {
  if (params.procedure && row.procedure_type !== params.procedure) return false;
  if (params.clinic) {
    if (params.clinic === UNKNOWN_CLINIC_KEY) {
      if (row.clinic_profile_id) return false;
    } else if (params.clinic.startsWith("id:")) {
      if (row.clinic_profile_id !== params.clinic.slice(3)) return false;
    } else if (params.clinic.startsWith("name:")) {
      const want = params.clinic.slice(5);
      const have = (row.clinic_name ?? "").trim().toLowerCase();
      if (row.clinic_profile_id || have !== want) return false;
    }
  }
  if (params.search) {
    const needle = params.search.toLowerCase();
    const hay = `${row.surgeon_name ?? ""} ${row.patient_reference ?? ""}`.toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}

async function buildFilterOptions(admin: SupabaseClient): Promise<AuditIntakeFilterOptions> {
  const { data } = await admin
    .from("surgery_upload_audit_intake")
    .select("case_id, assigned_to")
    .order("created_at", { ascending: false })
    .limit(OPTIONS_SCAN_LIMIT);
  const intake = (data ?? []) as Array<{ case_id: string; assigned_to: string | null }>;
  const details = await loadDetailsByCase(
    admin,
    intake.map((r) => r.case_id)
  );
  const assignees = await loadAssigneeLabels(
    admin,
    intake.map((r) => r.assigned_to).filter((x): x is string => !!x)
  );

  const clinicMap = new Map<string, string>();
  const surgeonSet = new Set<string>();
  const procedureSet = new Set<string>();
  for (const d of details.values()) {
    const key = clinicKey(d);
    if (!clinicMap.has(key)) clinicMap.set(key, clinicLabel(d));
    const surgeon = (d.surgeon_name ?? "").trim();
    if (surgeon) surgeonSet.add(surgeon);
    const proc = (d.procedure_type ?? "").trim();
    if (proc) procedureSet.add(proc);
  }
  const assigneeMap = new Map<string, string>();
  for (const r of intake) {
    if (r.assigned_to && !assigneeMap.has(r.assigned_to)) {
      assigneeMap.set(r.assigned_to, assignees.get(r.assigned_to) ?? "Reviewer");
    }
  }

  return {
    clinics: Array.from(clinicMap.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    surgeons: Array.from(surgeonSet)
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ value, label: value })),
    procedures: Array.from(procedureSet)
      .map((value) => ({ value, label: PROCEDURE_LABELS[value] ?? value }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    assignees: Array.from(assigneeMap.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  };
}

/** Load one page of the audit intake queue with filtering + pagination. */
export async function loadAuditIntakeQueue(opts: {
  admin: SupabaseClient;
  params: AuditIntakeQueryParams;
}): Promise<AuditIntakeListResult> {
  const { admin, params } = opts;
  const { page, pageSize } = params;
  const offset = (page - 1) * pageSize;

  const options = await buildFilterOptions(admin);

  if (hasDetailFilter(params)) {
    // Detail-filtered path: bounded scan, join details, filter in memory, paginate.
    const { data } = await applyIntakeFilters(
      admin.from("surgery_upload_audit_intake").select(INTAKE_ROW_COLUMNS),
      params
    )
      .order("created_at", { ascending: false })
      .range(0, MAX_CANDIDATES - 1);
    const candidates = (data ?? []) as AuditIntakeRow[];
    const saturated = candidates.length === MAX_CANDIDATES;

    const details = await loadDetailsByCase(
      admin,
      candidates.map((r) => r.case_id)
    );
    const completion = await loadCompletionByCase(admin, details);
    const assignees = await loadAssigneeLabels(
      admin,
      candidates.map((r) => r.assigned_to).filter((x): x is string => !!x)
    );
    const mapped = mapRows(candidates, details, completion, assignees);
    const filtered = mapped.filter((r) => matchesDetailFilter(r, params));

    const totalCount = filtered.length;
    const rows = filtered.slice(offset, offset + pageSize);
    return {
      rows,
      page,
      pageSize,
      totalCount,
      totalCountApproximate: saturated,
      hasPrevPage: page > 1,
      hasNextPage: offset + rows.length < totalCount,
      totalPages: saturated ? null : Math.max(1, Math.ceil(totalCount / pageSize)),
      options,
    };
  }

  // Standard path: exact server-side count + range pagination.
  const { data, count } = await applyIntakeFilters(
    admin.from("surgery_upload_audit_intake").select(INTAKE_ROW_COLUMNS, { count: "exact" }),
    params
  )
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const intakeRows = (data ?? []) as AuditIntakeRow[];
  const totalCount = count ?? 0;
  const details = await loadDetailsByCase(
    admin,
    intakeRows.map((r) => r.case_id)
  );
  const completion = await loadCompletionByCase(admin, details);
  const assignees = await loadAssigneeLabels(
    admin,
    intakeRows.map((r) => r.assigned_to).filter((x): x is string => !!x)
  );
  const rows = mapRows(intakeRows, details, completion, assignees);

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

/** Load the single intake record for a case (or null). Best-effort. */
export async function loadAuditIntakeByCase(
  db: SupabaseClient,
  caseId: string
): Promise<AuditIntakeRow | null> {
  try {
    const { data, error } = await db
      .from("surgery_upload_audit_intake")
      .select(INTAKE_ROW_COLUMNS)
      .eq("case_id", caseId)
      .maybeSingle();
    if (error || !data) return null;
    return data as AuditIntakeRow;
  } catch {
    return null;
  }
}

/** Map intake case_ids -> status for lightweight index badges. Best-effort. */
export async function loadAuditIntakeStatusesByCase(
  admin: SupabaseClient,
  caseIds: string[]
): Promise<Map<string, AuditIntakeStatus>> {
  const map = new Map<string, AuditIntakeStatus>();
  if (caseIds.length === 0) return map;
  try {
    const { data } = await admin
      .from("surgery_upload_audit_intake")
      .select("case_id, status")
      .in("case_id", caseIds);
    for (const r of (data ?? []) as Array<{ case_id: string; status: string }>) {
      map.set(r.case_id, normalizeAuditIntakeStatus(r.status));
    }
  } catch {
    /* table may not exist in older environments */
  }
  return map;
}
