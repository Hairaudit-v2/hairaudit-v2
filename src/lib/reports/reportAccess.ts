/**
 * Shared authorization for report PDFs, signed report URLs, and related storage keys.
 * See docs/stage1c-report-access-hardening.md
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireCaseAccess, type CaseAccessRow, type AuthFailure } from "@/lib/auth/permissions";
import { isDoctorCaseParticipant, isClinicCaseParticipant, isPatientCaseParticipant } from "@/lib/auth/permissions";
import { evaluateProfessionalAccess, loadProfileRole } from "@/lib/nexus/professionalAccess.server";
import { extractCaseIdFromPdfPath } from "@/lib/reports/pdfPathCaseId";
import { getCaseFilesBucketNameForReadOnlyUse } from "@/lib/hairaudit/uploadStorage";

export type ReportRowForAccess = {
  id: string;
  case_id: string;
  pdf_path: string | null;
  version?: number | null;
};

export function resolveReportCaseId(report: Pick<ReportRowForAccess, "case_id">): string {
  return String(report.case_id ?? "").trim();
}

/**
 * Rejects traversal / obvious malformation, then ensures the PDF object key resolves to the given case id
 * (same rules as {@link extractCaseIdFromPdfPath}, case-insensitive UUID compare).
 */
export function storagePathBelongsToReportCase(caseId: string, pdfPath: string): boolean {
  if (!caseId || !pdfPath) return false;
  let path = String(pdfPath).trim();
  if (path.includes("..") || path.includes("\\")) return false;
  try {
    path = decodeURIComponent(path);
  } catch {
    return false;
  }
  if (path.includes("..")) return false;
  const withoutHost = path.replace(/^https?:\/\/[^/]+/i, "");
  const extracted = extractCaseIdFromPdfPath(withoutHost);
  if (!extracted) return false;
  return extracted.toLowerCase() === caseId.trim().toLowerCase();
}

function statusFromAuthFailure(f: AuthFailure): number {
  return f.response.status;
}

export type AuthorizedReportPdfContext =
  | {
      ok: true;
      report: ReportRowForAccess;
      case: CaseAccessRow;
      pdfPath: string;
      storage: SupabaseClient["storage"];
      bucket: string;
    }
  | { ok: false; status: number; error: string };

/**
 * Load `reports` row, enforce {@link canAccessCase} for its `case_id`, and validate `pdf_path` namespace.
 * Callers stream from storage only after `ok: true`.
 */
export async function loadAuthorizedReportPdfDownloadContext(args: {
  userId: string;
  reportId: string;
  supabaseAuth: SupabaseClient;
}): Promise<AuthorizedReportPdfContext> {
  const admin = tryCreateSupabaseAdminClient();
  const db = admin ?? args.supabaseAuth;

  const { data: report, error: reportErr } = await db
    .from("reports")
    .select("id, case_id, pdf_path, version")
    .eq("id", args.reportId)
    .maybeSingle();

  if (reportErr) {
    console.error("[reportAccess] report lookup error", { reportId: args.reportId, message: reportErr.message });
    return { ok: false, status: 500, error: "Something went wrong" };
  }
  if (!report) {
    return { ok: false, status: 404, error: "Report not found" };
  }

  const caseId = resolveReportCaseId(report as ReportRowForAccess);
  const version = Number((report as ReportRowForAccess).version ?? 0);
  const storedPath = String(report.pdf_path ?? "").trim();
  const pdfPath = storedPath || (version > 0 ? `${caseId}/v${version}.pdf` : "");
  if (!pdfPath) {
    return { ok: false, status: 404, error: "Report file not ready" };
  }

  const gate = await requireCaseAccess({
    userId: args.userId,
    caseId,
    supabaseAuth: args.supabaseAuth,
  });
  if (!gate.ok) {
    const status = statusFromAuthFailure(gate);
    return {
      ok: false,
      status,
      error: status === 404 ? "Report not found" : "Forbidden",
    };
  }

  const caseRow = gate.data.case;
  const adminClient = admin ?? args.supabaseAuth;
  const profileRole = await loadProfileRole(adminClient, args.userId);
  if (
    (isDoctorCaseParticipant(args.userId, caseRow) || isClinicCaseParticipant(args.userId, caseRow)) &&
    !isPatientCaseParticipant(args.userId, caseRow)
  ) {
    const access = await evaluateProfessionalAccess({
      admin: adminClient,
      userId: args.userId,
      userEmail: undefined,
      profileRole,
      action: "report_access",
    });
    if (!access.allowed) {
      return { ok: false, status: access.httpStatus, error: access.reason };
    }
  }

  if (!storagePathBelongsToReportCase(caseId, pdfPath)) {
    console.error("[reportAccess] pdf path does not match case", { reportId: args.reportId, caseId });
    return { ok: false, status: 404, error: "Report not found" };
  }

  const bucket = getCaseFilesBucketNameForReadOnlyUse();
  const storage = (admin ?? args.supabaseAuth).storage;

  return {
    ok: true,
    report: report as ReportRowForAccess,
    case: gate.data.case,
    pdfPath,
    storage,
    bucket,
  };
}

/** Same as {@link requireCaseAccess} — explicit name for report routes that key off `caseId`. */
export async function requireReportAccessByCaseId(args: {
  userId: string;
  caseId: string;
  supabaseAuth: SupabaseClient;
}) {
  return requireCaseAccess(args);
}

export async function requireReportAccessByReportId(args: {
  userId: string;
  reportId: string;
  supabaseAuth: SupabaseClient;
}): Promise<
  | { ok: true; report: ReportRowForAccess; case: CaseAccessRow }
  | { ok: false; status: number; error: string }
> {
  const ctx = await loadAuthorizedReportPdfDownloadContext({
    userId: args.userId,
    reportId: args.reportId,
    supabaseAuth: args.supabaseAuth,
  });
  if (!ctx.ok) {
    return { ok: false, status: ctx.status, error: ctx.error };
  }
  return { ok: true, report: ctx.report, case: ctx.case };
}

/** @alias {@link requireReportAccessByReportId} */
export const requireReportAccess = requireReportAccessByReportId;
