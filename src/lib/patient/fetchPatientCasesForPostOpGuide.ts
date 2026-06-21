import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizedPatientAnswersFromReportRow } from "@/lib/patient/answersFromReportRow";
import type { CaseRowForPostOpGuide } from "@/lib/patient/caseSubmitStatus";
import {
  buildPatientResumeCaseContext,
  buildPatientResumeReviewViewModel,
  type PatientResumeCaseInput,
  type PatientResumeReviewViewModel,
} from "@/lib/patient/patientResumeReview";

export type PatientCaseRowWithId = CaseRowForPostOpGuide &
  Pick<PatientResumeCaseInput, "id" | "title" | "created_at" | "patient_review_pathway">;

/**
 * Same case scope as the patient dashboard: rows visible to the patient for guide eligibility.
 */
export async function fetchPatientCasesForPostOpGuide(
  admin: SupabaseClient,
  userId: string
): Promise<PatientCaseRowWithId[]> {
  const { data: cases } = await admin
    .from("cases")
    .select("id, title, status, created_at, submitted_at, audit_type, patient_review_pathway")
    .or(`patient_id.eq.${userId},and(user_id.eq.${userId},patient_id.is.null)`)
    .order("created_at", { ascending: false });
  return (cases ?? []) as PatientCaseRowWithId[];
}

export async function buildPatientResumeReviewForDashboard(
  admin: SupabaseClient,
  cases: readonly PatientCaseRowWithId[]
): Promise<PatientResumeReviewViewModel> {
  if (cases.length === 0) {
    return buildPatientResumeReviewViewModel({ contexts: [] });
  }

  const caseIds = cases.map((c) => c.id);
  const pdfByCase: Record<string, boolean> = {};

  const { data: reportRows } = await admin
    .from("reports")
    .select("case_id, pdf_path, version")
    .in("case_id", caseIds)
    .in("status", ["complete", "pdf_ready"])
    .not("pdf_path", "is", null)
    .order("version", { ascending: false });

  for (const r of reportRows ?? []) {
    const row = r as { case_id: string; pdf_path: string | null };
    const path = String(row.pdf_path ?? "").trim();
    if (row.case_id && path && pdfByCase[row.case_id] == null) {
      pdfByCase[row.case_id] = true;
    }
  }

  const contexts = await Promise.all(
    cases.map(async (c) => {
      const [{ data: uploads }, reportRes] = await Promise.all([
        admin.from("uploads").select("id, type").eq("case_id", c.id),
        admin
          .from("reports")
          .select("summary, patient_audit_version, patient_audit_v2")
          .eq("case_id", c.id)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      let patientAnswers: Record<string, unknown> | null = null;
      if (reportRes.error && String(reportRes.error.message || "").includes("patient_audit")) {
        const fallback = await admin
          .from("reports")
          .select("summary")
          .eq("case_id", c.id)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();
        patientAnswers = normalizedPatientAnswersFromReportRow(fallback.data ?? null);
      } else {
        patientAnswers = normalizedPatientAnswersFromReportRow(reportRes.data ?? null);
      }

      return buildPatientResumeCaseContext({
        case: c,
        uploads: uploads ?? [],
        patientAnswers,
        hasReportPdf: Boolean(pdfByCase[c.id]),
      });
    })
  );

  return buildPatientResumeReviewViewModel({ contexts });
}
