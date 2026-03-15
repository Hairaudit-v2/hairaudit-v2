/**
 * DB helpers: create test cases, cleanup with TEST_ prefix.
 */

import type { SubmissionType } from "../config/canonicalMappings";
import type { SupabaseClient } from "@supabase/supabase-js";

const CASE_PREFIX = "qa_automated_";

export interface CreateCaseOptions {
  auditType: SubmissionType;
  userId: string;
  title?: string;
}

export async function createTestCase(
  supabase: SupabaseClient,
  options: CreateCaseOptions
): Promise<{ id: string }> {
  const { auditType, userId, title } = options;
  const insertData: Record<string, unknown> = {
    user_id: userId,
    title: title ?? `${CASE_PREFIX}${auditType} audit`,
    status: "draft",
    audit_type: auditType,
    submission_channel:
      auditType === "doctor"
        ? "doctor_submitted"
        : auditType === "clinic"
          ? "clinic_submitted"
          : "patient_submitted",
    visibility_scope: auditType === "patient" ? "public" : "internal",
  };
  if (auditType === "patient") (insertData as any).patient_id = userId;
  if (auditType === "doctor") (insertData as any).doctor_id = userId;
  if (auditType === "clinic") (insertData as any).clinic_id = userId;

  const { data, error } = await supabase
    .from("cases")
    .insert(insertData)
    .select("id")
    .single();

  if (error) throw new Error(`createTestCase failed: ${error.message}`);
  if (!data?.id) throw new Error("createTestCase: no id returned");
  return { id: data.id };
}

const BUCKET = process.env.CASE_FILES_BUCKET || "case-files";

/** List all file paths under a storage prefix (recursive). Supabase list() returns one level; we recurse and collect leaf paths. */
async function listStoragePaths(
  supabase: SupabaseClient,
  prefix: string
): Promise<string[]> {
  const paths: string[] = [];
  const { data: list, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (error || !list || list.length === 0) return paths;
  for (const item of list) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    const { data: inner, error: listErr } = await supabase.storage.from(BUCKET).list(fullPath, { limit: 1 });
    const hasChildren = !listErr && inner && inner.length > 0;
    if (hasChildren) {
      const nested = await listStoragePaths(supabase, fullPath);
      paths.push(...nested);
    } else {
      paths.push(fullPath);
    }
  }
  return paths;
}

/** Delete all storage objects under cases/<caseId>/ (best-effort). */
export async function cleanupCaseStorage(
  supabase: SupabaseClient,
  caseId: string
): Promise<{ removed: number; errors: string[] }> {
  const errors: string[] = [];
  const prefix = `cases/${caseId}`;
  const paths = await listStoragePaths(supabase, prefix);
  if (paths.length === 0) return { removed: 0, errors: [] };
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) errors.push(`Storage cleanup: ${error.message}`);
  return { removed: paths.length, errors };
}

/** Delete case, related uploads/reports/manifests, and storage objects under cases/<id>/ (best-effort). */
export async function cleanupTestCase(
  supabase: SupabaseClient,
  caseId: string
): Promise<void> {
  await supabase.from("case_evidence_manifests").delete().eq("case_id", caseId);
  await supabase.from("uploads").delete().eq("case_id", caseId);
  await supabase.from("reports").delete().eq("case_id", caseId);
  const { errors } = await cleanupCaseStorage(supabase, caseId);
  if (errors.length) {
    console.warn("[harness] cleanupCaseStorage:", errors);
  }
  await supabase.from("cases").delete().eq("id", caseId);
}

/** List case IDs with prefix for bulk cleanup. */
export async function listHarnessCaseIds(
  supabase: SupabaseClient
): Promise<string[]> {
  const { data } = await supabase
    .from("cases")
    .select("id")
    .like("title", `${CASE_PREFIX}%`);
  return (data ?? []).map((r: { id: string }) => r.id);
}

/** Auditor-facing snapshot: case status, manifest, missing evidence, report presence. Uses same data paths as app. */
export interface AuditorCaseSnapshot {
  caseStatus: string | null;
  auditType: string | null;
  manifestStatus: string | null;
  missingCategories: string[];
  missingEvidenceCount: number;
  reportPresent: boolean;
  reportProvisionalStatus: string | null;
}

export async function getAuditorCaseSnapshot(
  supabase: SupabaseClient,
  caseId: string
): Promise<AuditorCaseSnapshot> {
  const out: AuditorCaseSnapshot = {
    caseStatus: null,
    auditType: null,
    manifestStatus: null,
    missingCategories: [],
    missingEvidenceCount: 0,
    reportPresent: false,
    reportProvisionalStatus: null,
  };
  const { data: c } = await supabase
    .from("cases")
    .select("status, audit_type")
    .eq("id", caseId)
    .maybeSingle();
  if (c) {
    out.caseStatus = (c as { status?: string | null }).status ?? null;
    out.auditType = (c as { audit_type?: string | null }).audit_type ?? null;
  }
  const { data: manifest } = await supabase
    .from("case_evidence_manifests")
    .select("status, missing_categories")
    .eq("case_id", caseId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (manifest) {
    const m = manifest as { status?: string | null; missing_categories?: string[] | null };
    out.manifestStatus = m.status ?? null;
    out.missingCategories = Array.isArray(m.missing_categories) ? m.missing_categories : [];
    out.missingEvidenceCount = out.missingCategories.length;
  }
  const { data: report } = await supabase
    .from("reports")
    .select("id, provisional_status")
    .eq("case_id", caseId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (report) {
    out.reportPresent = true;
    out.reportProvisionalStatus = (report as { provisional_status?: string | null }).provisional_status ?? null;
  }
  return out;
}
