import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { resolveClinicProfileForUser } from "@/lib/clinicPortal";
import { normalizeIntakeFormData } from "@/lib/intake/normalizeIntakeFormData";

export const runtime = "nodejs";

type CaseRow = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string;
  submitted_at: string | null;
  procedure_date?: string | null;
  clinic_id?: string | null;
  doctor_id?: string | null;
  audit_type?: string | null;
  submission_channel?: string | null;
  visibility_scope?: string | null;
  archived_at?: string | null;
  evidence_score_patient?: string | null;
  confidence_label_patient?: string | null;
  evidence_score_doctor?: string | null;
  confidence_label_doctor?: string | null;
};

type ReportRow = {
  case_id: string;
  summary: Record<string, unknown> | null;
  patient_audit_version?: number | null;
  patient_audit_v2?: Record<string, unknown> | null;
  counts_for_awards?: boolean | null;
  version?: number;
};

function anonymizeName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return `${parts[0][0] ?? "P"}***`;
  return `${parts[0][0] ?? "P"}*** ${parts[1][0] ?? ""}***`;
}

function patientReferenceFromAnswers(caseId: string, normalized: Record<string, unknown>): string {
  const candidate = String(
    normalized.patient_name ??
      normalized.full_name ??
      normalized.name ??
      ""
  ).trim();
  const anon = anonymizeName(candidate);
  if (anon) return anon;
  return `PT-${caseId.slice(0, 6).toUpperCase()}`;
}

function classifyActionNeeded(input: {
  status: string;
  visibilityScope: string;
  clinicResponseStatus: string;
  evidenceStrength: string;
  archivedAt: string | null;
  submissionChannel: string;
}) {
  if (input.archivedAt) {
    return { key: "archived", label: "Archived", priority: 0 };
  }
  if (input.clinicResponseStatus === "pending_response" && input.submissionChannel === "patient_submitted") {
    return { key: "awaiting_clinic_details", label: "Awaiting clinic details", priority: 100 };
  }
  if (input.evidenceStrength === "C" || input.evidenceStrength === "D" || input.evidenceStrength === "N/A") {
    return { key: "missing_evidence", label: "Missing evidence", priority: 90 };
  }
  if (!input.visibilityScope || input.visibilityScope === "internal") {
    if (input.status === "complete") {
      return { key: "review_visibility", label: "Visibility not set for trust publishing", priority: 80 };
    }
  }
  if (input.status === "draft" || input.status === "submitted") {
    return { key: "in_progress", label: "Complete case details", priority: 70 };
  }
  if (input.status === "complete" && input.visibilityScope === "public") {
    return { key: "publish_eligible", label: "Publish eligible", priority: 60 };
  }
  return { key: "ready_for_review", label: "Ready for review", priority: 50 };
}

export async function GET() {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userEmail = String(user.email ?? "").toLowerCase();
  const { admin, clinicProfile } = await resolveClinicProfileForUser({
    userId: user.id,
    userEmail,
  });
  if (!clinicProfile) return NextResponse.json({ error: "Clinic profile missing" }, { status: 500 });

  const baseSelect =
    "id,title,status,created_at,submitted_at,clinic_id,doctor_id,audit_type,submission_channel,visibility_scope,archived_at,evidence_score_patient,confidence_label_patient,evidence_score_doctor,confidence_label_doctor";
  const fallbackSelect =
    "id,title,status,created_at,submitted_at,clinic_id,doctor_id,audit_type,submission_channel,visibility_scope,evidence_score_patient,confidence_label_patient,evidence_score_doctor,confidence_label_doctor";

  const ownedPrimary = await admin
    .from("cases")
    .select(baseSelect)
    .eq("clinic_id", user.id)
    .order("created_at", { ascending: false })
    .limit(300);
  const ownedCases = (ownedPrimary.error
    ? (
        await admin
          .from("cases")
          .select(fallbackSelect)
          .eq("clinic_id", user.id)
          .order("created_at", { ascending: false })
          .limit(300)
      ).data
    : ownedPrimary.data) as CaseRow[] | null;

  const { data: contributionRequests } = await admin
    .from("case_contribution_requests")
    .select("case_id,status,updated_at")
    .eq("clinic_profile_id", clinicProfile.id)
    .order("updated_at", { ascending: false })
    .limit(300);

  const requestRows =
    (contributionRequests as Array<{ case_id: string; status: string; updated_at?: string }> | null) ?? [];
  const requestByCase = new Map<string, string>();
  for (const row of requestRows) {
    const caseId = String(row.case_id ?? "");
    if (!caseId || requestByCase.has(caseId)) continue;
    requestByCase.set(caseId, String(row.status ?? ""));
  }

  const ownedIds = new Set((ownedCases ?? []).map((c) => String(c.id)));
  const requestedCaseIds = [...new Set(requestRows.map((r) => String(r.case_id ?? "")).filter(Boolean))];
  const missingRequestedIds = requestedCaseIds.filter((id) => !ownedIds.has(id));

  let contributedCaseRows: CaseRow[] = [];
  if (missingRequestedIds.length > 0) {
    const contributedPrimary = await admin
      .from("cases")
      .select(baseSelect)
      .in("id", missingRequestedIds);
    if (contributedPrimary.error) {
      const contributedFallback = await admin
        .from("cases")
        .select(fallbackSelect)
        .in("id", missingRequestedIds);
      contributedCaseRows = (contributedFallback.data as CaseRow[] | null) ?? [];
    } else {
      contributedCaseRows = (contributedPrimary.data as CaseRow[] | null) ?? [];
    }
  }

  const allCases = [...(ownedCases ?? []), ...contributedCaseRows];
  const caseIds = allCases.map((c) => String(c.id));

  const [{ data: workspaces }, reportsPrimary, { data: doctorProfiles }] = await Promise.all([
    admin
      .from("clinic_case_workspaces")
      .select("case_id,submission_channel,visibility_scope,clinic_response_status,updated_at")
      .eq("clinic_profile_id", clinicProfile.id),
    caseIds.length > 0
      ? admin
          .from("reports")
          .select("case_id,summary,patient_audit_version,patient_audit_v2,counts_for_awards,version")
          .in("case_id", caseIds)
          .order("version", { ascending: false })
      : Promise.resolve({ data: [] as ReportRow[], error: null }),
    (() => {
      const ids = [...new Set(allCases.map((c) => String(c.doctor_id ?? "")).filter(Boolean))];
      if (ids.length === 0) return Promise.resolve({ data: [] as Array<Record<string, unknown>> });
      return admin.from("profiles").select("id,name,display_name,email").in("id", ids);
    })(),
  ]);
  let reports = reportsPrimary.data as ReportRow[] | null;
  if (reportsPrimary.error && caseIds.length > 0) {
    const reportsFallback = await admin
      .from("reports")
      .select("case_id,summary,version")
      .in("case_id", caseIds)
      .order("version", { ascending: false });
    reports = (reportsFallback.data as ReportRow[] | null) ?? [];
  }

  const workspaceByCase = new Map(
    ((workspaces as Array<Record<string, unknown>> | null) ?? []).map((w) => [String(w.case_id), w])
  );
  const latestReportByCase = new Map<string, ReportRow>();
  for (const row of (reports as ReportRow[] | null) ?? []) {
    const caseId = String(row.case_id ?? "");
    if (!caseId || latestReportByCase.has(caseId)) continue;
    latestReportByCase.set(caseId, row);
  }

  const doctorNameById = new Map<string, string>();
  for (const row of (doctorProfiles as Array<Record<string, unknown>> | null) ?? []) {
    const id = String(row.id ?? "");
    if (!id) continue;
    const name = String(row.name ?? row.display_name ?? row.email ?? "").trim();
    if (name) doctorNameById.set(id, name);
  }

  const items = allCases.map((c) => {
    const caseId = String(c.id);
    const workspace = workspaceByCase.get(caseId) as Record<string, unknown> | undefined;
    const latestReport = latestReportByCase.get(caseId);

    const summary = (latestReport?.summary ?? {}) as Record<string, unknown>;
    const patientAnswersRaw =
      latestReport?.patient_audit_version === 2 && latestReport?.patient_audit_v2
        ? latestReport.patient_audit_v2
        : ((summary.patient_answers as Record<string, unknown> | undefined) ?? {});
    const normalizedPatient = normalizeIntakeFormData(patientAnswersRaw);

    const patientReference = patientReferenceFromAnswers(caseId, normalizedPatient);
    const procedureDate = String(normalizedPatient.procedure_date ?? "").trim() || null;
    const doctorNameFromAnswers = String(
      normalizedPatient.doctor_name ?? normalizedPatient.surgeon_name ?? ""
    ).trim();
    const doctorName =
      doctorNameFromAnswers ||
      doctorNameById.get(String(c.doctor_id ?? "")) ||
      null;

    const submissionChannel = String(
      workspace?.submission_channel ??
        c.submission_channel ??
        (requestByCase.has(caseId) ? "patient_submitted" : "clinic_submitted")
    );
    const visibilityScope = String(workspace?.visibility_scope ?? c.visibility_scope ?? "internal");
    const clinicResponseStatus = String(
      workspace?.clinic_response_status ??
        (requestByCase.has(caseId) ? "pending_response" : "not_requested")
    );
    const evidenceStrength = String(c.evidence_score_doctor ?? c.evidence_score_patient ?? "N/A");
    const confidenceLabel = String(c.confidence_label_doctor ?? c.confidence_label_patient ?? "Pending");
    const archivedAt = c.archived_at ?? null;
    const status = String(c.status ?? "draft");

    const action = classifyActionNeeded({
      status,
      visibilityScope,
      clinicResponseStatus,
      evidenceStrength,
      archivedAt,
      submissionChannel,
    });

    const publishEligible = Boolean(
      status === "complete" &&
        visibilityScope === "public" &&
        (latestReport?.counts_for_awards ?? true)
    );

    return {
      caseId,
      title: c.title ?? "Clinic case",
      patientReference,
      doctorName,
      procedureDate,
      submissionChannel,
      visibilityScope,
      auditStatus: status,
      evidenceStrength,
      confidenceLabel,
      actionNeeded: action.label,
      actionNeededKey: action.key,
      actionPriority: action.priority,
      createdAt: c.created_at,
      submittedAt: c.submitted_at ?? null,
      archivedAt,
      publishEligible,
      clinicResponseStatus,
    };
  });

  items.sort((a, b) => {
    if (a.archivedAt && !b.archivedAt) return 1;
    if (!a.archivedAt && b.archivedAt) return -1;
    if (a.actionPriority !== b.actionPriority) return b.actionPriority - a.actionPriority;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return NextResponse.json({ ok: true, items });
}
