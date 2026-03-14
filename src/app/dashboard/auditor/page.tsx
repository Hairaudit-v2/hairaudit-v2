import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";
import { isMissingFeatureError } from "@/lib/db/isMissingFeatureError";
import AuditorDashboardClient from "./AuditorDashboardClient";
import {
  getAuditDashboardMode,
  getAuditKpis,
  getAuditPriorityBreakdown,
  getAuditStatusBreakdown,
  getAuditVolumeSeries,
  getRecentOperationalAudits,
  type DashboardRange,
} from "@/lib/dashboard/auditOperations";
import AuditKpiCards from "@/components/dashboard/AuditKpiCards";
import AuditVolumeChart from "@/components/dashboard/AuditVolumeChart";
import AuditStatusChart from "@/components/dashboard/AuditStatusChart";
import AuditPriorityChart from "@/components/dashboard/AuditPriorityChart";
import OperationalAuditsTable from "@/components/dashboard/OperationalAuditsTable";

export const revalidate = 60;

type CaseDashboardRow = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string;
  updated_at?: string | null;
  submitted_at?: string | null;
  audit_type?: "patient" | "doctor" | "clinic" | null;
  submission_channel?: string | null;
  visibility_scope?: string | null;
  patient_id?: string | null;
  doctor_id?: string | null;
  clinic_id?: string | null;
  assigned_auditor_id?: string | null;
  auditor_last_edited_at?: string | null;
  archived_at?: string | null;
  archived_by?: string | null;
  archived_reason?: string | null;
  deleted_at?: string | null;
};

type ReportDashboardRow = {
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

type GiiDashboardRow = {
  case_id: string;
  confidence: number;
  confidence_label: "low" | "medium" | "high";
  evidence_sufficiency_score?: number | null;
  auditor_status: "pending" | "approved" | "rejected" | "needs_more_evidence";
  audited_by?: string | null;
  audited_at?: string | null;
  created_at?: string | null;
};

function parseRange(value: string | undefined): DashboardRange {
  if (value === "today" || value === "7d" || value === "30d" || value === "90d") return value;
  return "7d";
}

export default async function AuditorDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ range?: string }> | { range?: string };
}) {
  const params = await Promise.resolve(searchParams ?? {});
  const range = parseRange(params.range);
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
      "id, title, status, created_at, updated_at, submitted_at, audit_type, patient_id, doctor_id, clinic_id, assigned_auditor_id, auditor_last_edited_at, archived_at, archived_by, archived_reason, deleted_at"
      + ", submission_channel, visibility_scope"
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

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

  const caseIds = (cases ?? []).map((x) => String(x.id));

  const { data: allReports } = await admin
    .from("reports")
    .select("case_id, pdf_path, status, created_at, auditor_review_status, summary")
    .in("case_id", caseIds.length ? caseIds : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at", { ascending: false });

  const reportByCase = new Map<
    string,
    {
      case_id: string;
      pdf_path: string | null;
      status: string | null;
      created_at: string;
      auditor_review_status?: string | null;
      summary?: Record<string, unknown> | null;
    }
  >();
  for (const r of (allReports ?? []) as ReportDashboardRow[]) {
    const cid = String(r.case_id);
    if (!reportByCase.has(cid)) {
      reportByCase.set(cid, {
        case_id: cid,
        pdf_path: r.pdf_path ?? null,
        status: r.status ?? null,
        created_at: r.created_at,
        auditor_review_status: r.auditor_review_status ?? null,
        summary: (r.summary ?? null) as Record<string, unknown> | null,
      });
    }
  }

  const evidenceByCase = new Map<string, EvidenceDashboardRow>();
  try {
    const evidenceRes = await admin
      .from("case_evidence_manifests")
      .select("case_id, quality_score, missing_categories, prepared_images, status, created_at")
      .in("case_id", caseIds.length ? caseIds : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false });
    if (evidenceRes.error && !isMissingFeatureError(evidenceRes.error)) {
      throw evidenceRes.error;
    }
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
  } catch {
    // Evidence manifest table may not be deployed yet in every environment.
  }

  const giiLatestByCase = new Map<string, GiiDashboardRow>();
  const giiSelectWithEvidence =
    "id, case_id, claimed_grafts, estimated_extracted_min, estimated_extracted_max, estimated_implanted_min, estimated_implanted_max, variance_claimed_vs_implanted_min_pct, variance_claimed_vs_implanted_max_pct, variance_claimed_vs_extracted_min_pct, variance_claimed_vs_extracted_max_pct, confidence, confidence_label, evidence_sufficiency_score, inputs_used, limitations, flags, ai_notes, auditor_status, auditor_notes, auditor_adjustments, audited_by, audited_at, created_at, updated_at";
  const giiSelectFallback =
    "id, case_id, claimed_grafts, estimated_extracted_min, estimated_extracted_max, estimated_implanted_min, estimated_implanted_max, variance_claimed_vs_implanted_min_pct, variance_claimed_vs_implanted_max_pct, variance_claimed_vs_extracted_min_pct, variance_claimed_vs_extracted_max_pct, confidence, confidence_label, inputs_used, limitations, flags, ai_notes, auditor_status, auditor_notes, auditor_adjustments, audited_by, audited_at, created_at, updated_at";
  try {
    const primaryRes = await admin
      .from("graft_integrity_estimates")
      .select(giiSelectWithEvidence)
      .order("created_at", { ascending: false })
      .limit(200);

    if (!primaryRes.error) {
      for (const r of (primaryRes.data ?? []) as GiiDashboardRow[]) {
        const cid = String(r.case_id);
        if (!giiLatestByCase.has(cid)) giiLatestByCase.set(cid, r);
      }
    } else if (isMissingFeatureError(primaryRes.error)) {
      const fallbackRes = await admin
        .from("graft_integrity_estimates")
        .select(giiSelectFallback)
        .order("created_at", { ascending: false })
        .limit(200);

      if (!fallbackRes.error) {
        for (const r of (fallbackRes.data ?? []) as GiiDashboardRow[]) {
          const cid = String(r.case_id);
          if (!giiLatestByCase.has(cid)) giiLatestByCase.set(cid, r);
        }
      }
    }
  } catch {
    // optional feature table can be absent in some environments
  }

  const clinicUserIds = [...new Set(cases.map((c) => c.clinic_id).filter(Boolean))] as string[];
  const patientUserIds = [...new Set(cases.map((c) => c.patient_id).filter(Boolean))] as string[];
  const assignedAuditorIds = [...new Set(cases.map((c) => c.assigned_auditor_id).filter(Boolean))] as string[];

  const [{ data: clinicProfiles }, { data: patientProfiles }, { data: auditorProfiles }] = await Promise.all([
    clinicUserIds.length
      ? admin.from("clinic_profiles").select("linked_user_id, clinic_name").in("linked_user_id", clinicUserIds)
      : Promise.resolve({ data: [] as Array<{ linked_user_id: string; clinic_name: string }> }),
    patientUserIds.length
      ? admin.from("profiles").select("id, display_name").in("id", patientUserIds)
      : Promise.resolve({ data: [] as Array<{ id: string; display_name: string | null }> }),
    assignedAuditorIds.length
      ? admin.from("profiles").select("id, display_name").in("id", assignedAuditorIds)
      : Promise.resolve({ data: [] as Array<{ id: string; display_name: string | null }> }),
  ]);

  const clinicNameByUserId = new Map<string, string>();
  for (const row of (clinicProfiles ?? []) as Array<{ linked_user_id: string; clinic_name: string }>) {
    if (row?.linked_user_id) clinicNameByUserId.set(String(row.linked_user_id), String(row.clinic_name ?? ""));
  }
  const patientNameByUserId = new Map<string, string>();
  for (const row of (patientProfiles ?? []) as Array<{ id: string; display_name: string | null }>) {
    if (row?.id) patientNameByUserId.set(String(row.id), String(row.display_name ?? ""));
  }
  const assignedAuditorNameById = new Map<string, string>();
  for (const row of (auditorProfiles ?? []) as Array<{ id: string; display_name: string | null }>) {
    if (row?.id) assignedAuditorNameById.set(String(row.id), String(row.display_name ?? ""));
  }

  const clinicNameByCaseId: Record<string, string> = {};
  const patientNameByCaseId: Record<string, string> = {};
  for (const c of cases) {
    const cid = String(c.id);
    if (c.clinic_id) clinicNameByCaseId[cid] = clinicNameByUserId.get(String(c.clinic_id)) ?? "";
    if (c.patient_id) patientNameByCaseId[cid] = patientNameByUserId.get(String(c.patient_id)) ?? "";
  }
  const casesForClient = cases.map((c) => ({
    ...c,
    audit_type: c.audit_type ?? null,
  }));

  const [kpis, volumeSeries, statusBreakdown, priorityBreakdown, operationalAudits] = await Promise.all([
    getAuditKpis(range),
    getAuditVolumeSeries(range),
    getAuditStatusBreakdown(range),
    getAuditPriorityBreakdown(range),
    getRecentOperationalAudits(range),
  ]);
  const mode = getAuditDashboardMode();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6 py-2">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Live Operations Dashboard</h2>
            <p className="text-sm text-slate-500">Audit volume, workflow throughput, and backlog risk indicators.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(["today", "7d", "30d", "90d"] as const).map((key) => (
              <Link
                key={key}
                href={`/dashboard/auditor?range=${key}`}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  range === key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {key}
              </Link>
            ))}
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
                mode === "demo" ? "border-amber-300 bg-amber-50 text-amber-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"
              }`}
            >
              {mode} mode
            </span>
          </div>
        </div>
      </section>

      <AuditKpiCards kpis={kpis} />

      <div className="grid gap-4 lg:grid-cols-2">
        <AuditVolumeChart points={volumeSeries} />
        <div className="space-y-4">
          <AuditStatusChart breakdown={statusBreakdown} />
          <AuditPriorityChart breakdown={priorityBreakdown} />
        </div>
      </div>

      <div className="space-y-4">
        <OperationalAuditsTable title="Recent Audits" rows={operationalAudits.recentAudits} />
        <OperationalAuditsTable title="Audits Needing Manual Input" rows={operationalAudits.manualInputAudits} />
        <OperationalAuditsTable title="Stuck / Failed Audits" rows={operationalAudits.stuckOrFailedAudits} />
      </div>

      <AuditorDashboardClient
        cases={casesForClient}
        reportByCase={Object.fromEntries(reportByCase.entries())}
        evidenceByCase={Object.fromEntries(evidenceByCase.entries())}
        giiByCase={Object.fromEntries(giiLatestByCase.entries())}
        assignedAuditorNameById={Object.fromEntries(assignedAuditorNameById.entries())}
        clinicNameByCaseId={clinicNameByCaseId}
        patientNameByCaseId={patientNameByCaseId}
      />
    </div>
  );
}
