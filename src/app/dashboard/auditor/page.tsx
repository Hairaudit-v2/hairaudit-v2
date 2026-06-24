import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";
import { isMissingFeatureError } from "@/lib/db/isMissingFeatureError";
import AuditorDashboardClient from "./AuditorDashboardClient";
import { countUploadStats } from "@/lib/auditor/auditorQueueTriage";
import { shouldFallbackToEnglishInQueue, derivePatientSafeSummaryQueueStatus } from "@/lib/reports/patientSafeSummaryTranslationQueue";

export const revalidate = 60;

type CaseDashboardRow = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string;
  updated_at?: string | null;
  submitted_at?: string | null;
  audit_type?: "patient" | "doctor" | "clinic" | null;
  patient_review_pathway?: string | null;
  patient_id?: string | null;
  doctor_id?: string | null;
  clinic_id?: string | null;
  archived_at?: string | null;
  deleted_at?: string | null;
};

type ReportDashboardRow = {
  id?: string;
  case_id: string;
  pdf_path: string | null;
  status: string | null;
  created_at: string;
  auditor_review_status?: string | null;
  summary?: Record<string, unknown> | null;
};

type EvidenceDashboardRow = {
  case_id: string;
  quality_score: number | null;
  missing_categories: string[] | null;
  status?: string | null;
};

function isCompletedCase(caseRow: CaseDashboardRow, report: ReportDashboardRow | undefined): boolean {
  const reportReview = String(report?.auditor_review_status ?? "");
  const caseStatus = String(caseRow.status ?? "");
  const hasPdf = Boolean(report?.pdf_path);
  return (
    caseStatus === "complete" ||
    reportReview === "completed" ||
    (hasPdf && String(report?.status ?? "") === "complete")
  );
}

export default async function AuditorDashboardPage() {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createSupabaseAdminClient();

  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!isAuditor({ profileRole: profile?.role, userEmail: user.email })) redirect("/login/auditor");

  const primaryCasesRes = await admin
    .from("cases")
    .select(
      "id, title, status, created_at, updated_at, submitted_at, audit_type, patient_review_pathway, patient_id, doctor_id, clinic_id, archived_at, deleted_at"
    )
    .is("deleted_at", null)
    .is("archived_at", null)
    .neq("status", "complete")
    .order("updated_at", { ascending: false });

  let cases: CaseDashboardRow[] = [];
  if (!primaryCasesRes.error) {
    cases = ((primaryCasesRes.data ?? []) as unknown) as CaseDashboardRow[];
  } else if (isMissingFeatureError(primaryCasesRes.error)) {
    const fallbackCasesRes = await admin
      .from("cases")
      .select("id, title, status, created_at, updated_at, submitted_at, patient_id, doctor_id, clinic_id")
      .order("created_at", { ascending: false });
    cases = (fallbackCasesRes.data ?? []) as CaseDashboardRow[];
  }

  const caseIds = cases.map((x) => String(x.id));

  const { data: allReports } = await admin
    .from("reports")
    .select("id, case_id, pdf_path, status, created_at, auditor_review_status, summary")
    .in("case_id", caseIds.length ? caseIds : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at", { ascending: false });

  const reportByCase = new Map<string, ReportDashboardRow>();
  for (const r of (allReports ?? []) as ReportDashboardRow[]) {
    const cid = String(r.case_id);
    if (!reportByCase.has(cid)) {
      reportByCase.set(cid, {
        case_id: cid,
        id: r.id,
        pdf_path: r.pdf_path ?? null,
        status: r.status ?? null,
        created_at: r.created_at,
        auditor_review_status: r.auditor_review_status ?? null,
        summary: (r.summary ?? null) as Record<string, unknown> | null,
      });
    }
  }

  cases = cases.filter((c) => !isCompletedCase(c, reportByCase.get(String(c.id))));

  const activeCaseIds = cases.map((c) => String(c.id));

  const evidenceByCase = new Map<string, EvidenceDashboardRow>();
  try {
    const evidenceRes = await admin
      .from("case_evidence_manifests")
      .select("case_id, quality_score, missing_categories, status, created_at")
      .in("case_id", activeCaseIds.length ? activeCaseIds : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false });
    if (!evidenceRes.error || isMissingFeatureError(evidenceRes.error)) {
      for (const row of (evidenceRes.data ?? []) as EvidenceDashboardRow[]) {
        const cid = String(row.case_id);
        if (!evidenceByCase.has(cid)) {
          evidenceByCase.set(cid, {
            case_id: cid,
            quality_score: row.quality_score ?? null,
            missing_categories: Array.isArray(row.missing_categories) ? row.missing_categories : [],
            status: row.status ?? null,
          });
        }
      }
    }
  } catch {
    // optional table
  }

  const clinicUserIds = [...new Set(cases.map((c) => c.clinic_id).filter(Boolean))] as string[];
  const patientUserIds = [...new Set(cases.map((c) => c.patient_id).filter(Boolean))] as string[];

  const [{ data: clinicProfiles }, { data: patientProfiles }] = await Promise.all([
    clinicUserIds.length
      ? admin.from("clinic_profiles").select("linked_user_id, clinic_name").in("linked_user_id", clinicUserIds)
      : Promise.resolve({ data: [] as Array<{ linked_user_id: string; clinic_name: string }> }),
    patientUserIds.length
      ? admin.from("profiles").select("id, display_name, email").in("id", patientUserIds)
      : Promise.resolve({ data: [] as Array<{ id: string; display_name: string | null; email: string | null }> }),
  ]);

  const clinicNameByUserId = new Map<string, string>();
  for (const row of (clinicProfiles ?? []) as Array<{ linked_user_id: string; clinic_name: string }>) {
    if (row?.linked_user_id) clinicNameByUserId.set(String(row.linked_user_id), String(row.clinic_name ?? ""));
  }
  const patientNameByUserId = new Map<string, string>();
  const patientEmailByUserId = new Map<string, string>();
  for (const row of (patientProfiles ?? []) as Array<{ id: string; display_name: string | null; email: string | null }>) {
    if (row?.id) {
      patientNameByUserId.set(String(row.id), String(row.display_name ?? ""));
      patientEmailByUserId.set(String(row.id), String(row.email ?? ""));
    }
  }

  const clinicNameByCaseId: Record<string, string> = {};
  const patientNameByCaseId: Record<string, string> = {};
  const patientEmailByCaseId: Record<string, string> = {};
  for (const c of cases) {
    const cid = String(c.id);
    if (c.clinic_id) clinicNameByCaseId[cid] = clinicNameByUserId.get(String(c.clinic_id)) ?? "";
    if (c.patient_id) {
      patientNameByCaseId[cid] = patientNameByUserId.get(String(c.patient_id)) ?? "";
      patientEmailByCaseId[cid] = patientEmailByUserId.get(String(c.patient_id)) ?? "";
    }
  }

  const uploadStatsByCaseId: Record<
    string,
    { imageUploadCount: number; pdfDocumentCount: number; uploadTypes: Array<{ type?: string | null }> }
  > = {};
  try {
    const { data: uploadRows } = await admin
      .from("uploads")
      .select("case_id, type")
      .in("case_id", activeCaseIds.length ? activeCaseIds : ["00000000-0000-0000-0000-000000000000"]);
    const statsMap = countUploadStats((uploadRows ?? []) as Array<{ case_id: string; type?: string | null }>);
    for (const cid of activeCaseIds) {
      const stats = statsMap.get(cid);
      uploadStatsByCaseId[cid] = stats ?? { imageUploadCount: 0, pdfDocumentCount: 0, uploadTypes: [] };
    }
  } catch {
    for (const cid of activeCaseIds) {
      uploadStatsByCaseId[cid] = { imageUploadCount: 0, pdfDocumentCount: 0, uploadTypes: [] };
    }
  }

  const hasClinicalHistoryByCaseId: Record<string, boolean> = {};
  try {
    const { data: clinicalRows } = await admin
      .from("hairaudit_case_clinical_history")
      .select("case_id")
      .in("case_id", activeCaseIds.length ? activeCaseIds : ["00000000-0000-0000-0000-000000000000"]);
    for (const cid of activeCaseIds) hasClinicalHistoryByCaseId[cid] = false;
    for (const row of (clinicalRows ?? []) as Array<{ case_id: string }>) {
      if (row?.case_id) hasClinicalHistoryByCaseId[String(row.case_id)] = true;
    }
  } catch {
    for (const cid of activeCaseIds) hasClinicalHistoryByCaseId[cid] = false;
  }

  const waitingOnTranslationByCaseId: Record<string, boolean> = {};
  for (const cid of activeCaseIds) waitingOnTranslationByCaseId[cid] = false;

  const latestReportIds = [...reportByCase.values()]
    .map((r) => String(r.id ?? ""))
    .filter(Boolean);

  if (latestReportIds.length > 0) {
    try {
      const trRes = await admin
        .from("report_narrative_translations")
        .select("report_id, case_id, translation_status, review_status")
        .in("report_id", latestReportIds)
        .eq("section_id", "patientSafeSummaryNarrative")
        .eq("target_locale", "es");
      if (!trRes.error) {
        const reportIdToCaseId = new Map<string, string>();
        for (const [caseId, report] of reportByCase.entries()) {
          if (report.id) reportIdToCaseId.set(String(report.id), caseId);
        }
        for (const row of trRes.data ?? []) {
          const caseId = reportIdToCaseId.get(String(row.report_id));
          if (!caseId) continue;
          const status = derivePatientSafeSummaryQueueStatus({
            hasTranslation: true,
            translationStatus: row.translation_status,
            reviewStatus: row.review_status,
          });
          if (shouldFallbackToEnglishInQueue(status) || status === "generated_unreviewed") {
            waitingOnTranslationByCaseId[caseId] = true;
          }
        }
      }
    } catch {
      // optional pilot table
    }
  }

  const casesForClient = cases.map((c) => ({
    ...c,
    audit_type: c.audit_type ?? null,
  }));

  return (
    <div className="py-2">
      <AuditorDashboardClient
        cases={casesForClient}
        reportByCase={Object.fromEntries(reportByCase.entries())}
        evidenceByCase={Object.fromEntries(evidenceByCase.entries())}
        clinicNameByCaseId={clinicNameByCaseId}
        patientNameByCaseId={patientNameByCaseId}
        patientEmailByCaseId={patientEmailByCaseId}
        hasClinicalHistoryByCaseId={hasClinicalHistoryByCaseId}
        uploadStatsByCaseId={uploadStatsByCaseId}
        waitingOnTranslationByCaseId={waitingOnTranslationByCaseId}
      />
    </div>
  );
}
