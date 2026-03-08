import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";
import { redirect } from "next/navigation";
import ContributionRequestsClient from "./ContributionRequestsClient";

export const dynamic = "force-dynamic";

export type ContributionRequestWithRelations = {
  id: string;
  case_id: string;
  status: string | null;
  clinic_name_snapshot: string | null;
  doctor_name_snapshot: string | null;
  clinic_email_snapshot: string | null;
  doctor_email_snapshot: string | null;
  recipient_emails: unknown;
  request_snapshot: unknown;
  contribution_payload: unknown;
  created_at: string | null;
  requested_at: string | null;
  viewed_at: string | null;
  contribution_started_at: string | null;
  contribution_received_at: string | null;
  completed_at: string | null;
  reminder_count: number | null;
  reminder_1_sent_at: string | null;
  reminder_2_sent_at: string | null;
  last_email_sent_at: string | null;
  last_opened_at: string | null;
  secure_contribution_path: string | null;
  secure_token_expires_at: string | null;
  clinic_profile_id: string | null;
  doctor_profile_id: string | null;
  clinic_profile: { clinic_name: string; current_award_tier: string | null } | null;
  doctor_profile: { doctor_name: string; current_award_tier: string | null } | null;
  benchmark_eligible: boolean;
};

export default async function AdminContributionRequestsPage() {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!isAuditor({ profileRole: profile?.role, userEmail: user.email })) {
    redirect("/login/auditor");
  }

  const { data: requests } = await admin
    .from("case_contribution_requests")
    .select(`
      id, case_id, status, clinic_name_snapshot, doctor_name_snapshot,
      clinic_email_snapshot, doctor_email_snapshot, recipient_emails, request_snapshot, contribution_payload,
      created_at, requested_at, viewed_at, contribution_started_at, contribution_received_at, completed_at,
      reminder_count, reminder_1_sent_at, reminder_2_sent_at, last_email_sent_at, last_opened_at,
      secure_contribution_path, secure_token_expires_at, clinic_profile_id, doctor_profile_id
    `)
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = (requests ?? []) as ContributionRequestWithRelations[];

  const clinicIds = [...new Set(rows.map((r) => r.clinic_profile_id).filter(Boolean))] as string[];
  const doctorIds = [...new Set(rows.map((r) => r.doctor_profile_id).filter(Boolean))] as string[];
  const caseIds = [...new Set(rows.map((r) => r.case_id))];

  const [clinicProfiles, doctorProfiles, reports] = await Promise.all([
    clinicIds.length
      ? admin
          .from("clinic_profiles")
          .select("id, clinic_name, current_award_tier")
          .in("id", clinicIds)
      : { data: [] },
    doctorIds.length
      ? admin
          .from("doctor_profiles")
          .select("id, doctor_name, current_award_tier")
          .in("id", doctorIds)
      : { data: [] },
    caseIds.length
      ? admin
          .from("reports")
          .select("case_id, version, summary")
          .in("case_id", caseIds)
          .order("version", { ascending: false })
      : { data: [] },
  ]);

  const clinicMap = new Map(
    (clinicProfiles.data ?? []).map((c) => [c.id, { clinic_name: c.clinic_name, current_award_tier: c.current_award_tier }])
  );
  const doctorMap = new Map(
    (doctorProfiles.data ?? []).map((d) => [d.id, { doctor_name: d.doctor_name, current_award_tier: d.current_award_tier }])
  );
  const benchmarkByCase = new Map<string, boolean>();
  for (const r of reports.data ?? []) {
    const cid = String(r.case_id);
    if (benchmarkByCase.has(cid)) continue;
    const bench = (r.summary as Record<string, unknown>)?.forensic_audit as Record<string, unknown> | undefined;
    benchmarkByCase.set(cid, Boolean(bench?.benchmark && (bench.benchmark as Record<string, unknown>)?.eligible));
  }

  const enriched: ContributionRequestWithRelations[] = rows.map((r) => ({
    ...r,
    clinic_profile: r.clinic_profile_id ? clinicMap.get(r.clinic_profile_id) ?? null : null,
    doctor_profile: r.doctor_profile_id ? doctorMap.get(r.doctor_profile_id) ?? null : null,
    benchmark_eligible: benchmarkByCase.get(r.case_id) ?? false,
  }));

  const total = enriched.length;
  const awaitingResponse = enriched.filter(
    (r) =>
      ["clinic_request_pending", "clinic_request_sent"].includes(String(r.status ?? "")) &&
      !r.contribution_received_at
  ).length;
  const viewed = enriched.filter((r) => r.status === "clinic_viewed_request" && !r.contribution_received_at).length;
  const contributionReceived = enriched.filter((r) =>
    ["doctor_contribution_received", "benchmark_recalculated", "benchmark_eligible"].includes(String(r.status ?? ""))
  ).length;
  const benchmarkEligible = enriched.filter((r) => r.benchmark_eligible).length;
  const expiredClosed = enriched.filter((r) =>
    ["request_closed", "request_expired"].includes(String(r.status ?? ""))
  ).length;

  return (
    <ContributionRequestsClient
      requests={enriched}
      metrics={{
        total,
        awaitingResponse,
        viewed,
        contributionReceived,
        benchmarkEligible,
        expiredClosed,
      }}
    />
  );
}
