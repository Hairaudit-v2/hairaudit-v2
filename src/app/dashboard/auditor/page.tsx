import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";
import { isMissingFeatureError } from "@/lib/db/isMissingFeatureError";
import GraftIntegrityReviewPanel from "./GraftIntegrityReviewPanel";

export default async function AuditorDashboardPage() {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createSupabaseAdminClient();

  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!isAuditor({ profileRole: profile?.role, userEmail: user.email })) redirect("/login/auditor");

  const { data: cases } = await admin
    .from("cases")
    .select("id, title, status, created_at")
    .order("created_at", { ascending: false });

  // Load latest report per case for status chips (PDF Ready, Processing)
  const caseIds = (cases ?? []).map((x) => x.id);
  const { data: allReports } = await admin
    .from("reports")
    .select("case_id, pdf_path, status, created_at")
    .in("case_id", caseIds.length ? caseIds : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at", { ascending: false });
  const reportByCase = new Map<string, { pdf_path: string | null; status?: string }>();
  for (const r of (allReports ?? []) as any[]) {
    const cid = String(r.case_id);
    if (!reportByCase.has(cid)) reportByCase.set(cid, { pdf_path: r.pdf_path, status: r.status });
  }

  const evidenceByCase = new Map<
    string,
    {
      quality_score: number | null;
      missing_categories: string[] | null;
      prepared_images: Array<{ category?: string }> | null;
      status?: string | null;
    }
  >();
  try {
    const evidenceRes = await admin
      .from("case_evidence_manifests")
      .select("case_id, quality_score, missing_categories, prepared_images, status, created_at")
      .in("case_id", caseIds.length ? caseIds : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false });
    if (evidenceRes.error && !isMissingFeatureError(evidenceRes.error)) {
      throw evidenceRes.error;
    }
    for (const row of (evidenceRes.data ?? []) as any[]) {
      const cid = String(row.case_id);
      if (!evidenceByCase.has(cid)) {
        evidenceByCase.set(cid, {
          quality_score: row.quality_score ?? null,
          missing_categories: Array.isArray(row.missing_categories) ? row.missing_categories : [],
          prepared_images: Array.isArray(row.prepared_images) ? row.prepared_images : [],
          status: row.status ?? null,
        });
      }
    }
  } catch {
    // Evidence manifest table may not be deployed yet in every environment.
  }

  // Optional feature: must never crash the dashboard if table is missing or query errors
  let giiLatestByCase = new Map<string, any>();
  let giiUnavailable = false;
  const giiSelectWithEvidence =
    "id, case_id, claimed_grafts, estimated_extracted_min, estimated_extracted_max, estimated_implanted_min, estimated_implanted_max, variance_claimed_vs_implanted_min_pct, variance_claimed_vs_implanted_max_pct, variance_claimed_vs_extracted_min_pct, variance_claimed_vs_extracted_max_pct, confidence, confidence_label, evidence_sufficiency_score, inputs_used, limitations, flags, ai_notes, auditor_status, auditor_notes, auditor_adjustments, audited_by, audited_at, created_at, updated_at";
  const giiSelectFallback =
    "id, case_id, claimed_grafts, estimated_extracted_min, estimated_extracted_max, estimated_implanted_min, estimated_implanted_max, variance_claimed_vs_implanted_min_pct, variance_claimed_vs_implanted_max_pct, variance_claimed_vs_extracted_min_pct, variance_claimed_vs_extracted_max_pct, confidence, confidence_label, inputs_used, limitations, flags, ai_notes, auditor_status, auditor_notes, auditor_adjustments, audited_by, audited_at, created_at, updated_at";
  try {
    let giiRes = await admin
      .from("graft_integrity_estimates")
      .select(giiSelectWithEvidence)
      .order("created_at", { ascending: false })
      .limit(200);

    // Backward compatibility: if evidence_sufficiency_score column is not deployed, retry without it.
    if (giiRes.error && isMissingFeatureError(giiRes.error)) {
      giiRes = await admin
        .from("graft_integrity_estimates")
        .select(giiSelectFallback)
        .order("created_at", { ascending: false })
        .limit(200);
    }

    if (giiRes.error && isMissingFeatureError(giiRes.error)) {
      giiUnavailable = true;
    } else if (!giiRes.error) {
      for (const r of (giiRes.data ?? []) as any[]) {
        const cid = String(r.case_id);
        if (!giiLatestByCase.has(cid)) giiLatestByCase.set(cid, r);
      }
    }
  } catch {
    giiUnavailable = true;
  }
  const giiLatest = Array.from(giiLatestByCase.values());

  const failedCases = (cases ?? []).filter((c) => c.status === "audit_failed");
  const otherCases = (cases ?? []).filter((c) => c.status !== "audit_failed");

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Auditor Dashboard</h1>
          <p className="text-slate-600 text-sm mt-1">Full access to all submitted audit cases</p>
        </div>
        <Link
          href="/admin/contribution-requests"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Contribution Requests →
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 mb-6">
        <p className="text-sm text-slate-800">
          View and review all patient, doctor, and clinic submissions. Access reports and audit details.
        </p>
      </div>

      <div className="mb-8">
        {giiUnavailable ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="text-sm font-semibold text-slate-900">Graft Integrity</div>
            <div className="mt-1 text-sm text-slate-600">
              Graft Integrity feature unavailable or not yet deployed.
            </div>
          </div>
        ) : (
          <GraftIntegrityReviewPanel
            cases={(cases ?? []) as any}
            initialEstimates={giiLatest as any}
          />
        )}
      </div>

      {failedCases.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Needs manual audit</h2>
          <ul className="space-y-3 mb-8">
            {failedCases.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/cases/${c.id}/audit`}
                  className="block rounded-xl border-2 border-amber-300 bg-amber-50 p-4 hover:border-amber-400 hover:shadow-sm transition-all"
                >
                  <span className="font-medium text-slate-900">{c.title ?? "Untitled case"}</span>
                  <span className="ml-2 text-amber-700 text-sm font-medium">— audit failed, complete manually</span>
                  <div className="text-xs text-slate-500 mt-2">Created: {new Date(c.created_at).toLocaleString()}</div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="text-lg font-semibold text-slate-900 mb-3">All audit cases</h2>
      {(!cases || cases.length === 0) ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-600">No cases submitted yet.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {cases.map((c) => {
            const rep = reportByCase.get(c.id);
            const gii = (giiLatestByCase as Map<string, any>).get(c.id);
            const evidence = evidenceByCase.get(c.id);
            const hasPdf = !!rep?.pdf_path;
            const isProcessing = rep?.status === "processing" || (!rep?.pdf_path && rep?.status !== "failed");
            const giiStatus = gii?.auditor_status ?? (gii ? "pending" : null);
            const categoryCounts = Object.entries(
              ((evidence?.prepared_images ?? []) as Array<{ category?: string }>).reduce(
                (acc, item) => {
                  const key = String(item.category ?? "uncategorized");
                  acc[key] = (acc[key] ?? 0) + 1;
                  return acc;
                },
                {} as Record<string, number>
              )
            );
            return (
              <li key={c.id}>
                <Link
                  href={`/cases/${c.id}`}
                  className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-amber-300 hover:shadow-sm transition-all"
                >
                  <span className="font-medium text-slate-900">{c.title ?? "Untitled case"}</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{c.status}</span>
                    {hasPdf && <span className="inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">PDF Ready</span>}
                    {isProcessing && !hasPdf && <span className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Processing</span>}
                    {giiStatus === "approved" && <span className="inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Graft Integrity Approved</span>}
                    {giiStatus === "pending" && gii && <span className="inline-flex rounded-md bg-cyan-50 px-2 py-0.5 text-xs font-medium text-cyan-700">Graft Integrity Pending</span>}
                    {giiStatus === "needs_more_evidence" && <span className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Needs More Evidence</span>}
                    {evidence && (
                      <span className="inline-flex rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        Evidence score {Math.round(Number(evidence.quality_score ?? 0))}
                      </span>
                    )}
                  </div>
                  {evidence && (
                    <div className="text-xs text-slate-500 mt-2 space-y-1">
                      <div>
                        Missing categories:{" "}
                        {(evidence.missing_categories ?? []).length
                          ? (evidence.missing_categories ?? []).slice(0, 4).join(", ")
                          : "none"}
                      </div>
                      <div>
                        Prepared category counts:{" "}
                        {categoryCounts.length
                          ? categoryCounts
                              .slice(0, 5)
                              .map(([k, v]) => `${k}:${v}`)
                              .join(" | ")
                          : "none"}
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-slate-400 mt-2">
                    Created: {new Date(c.created_at).toLocaleString()}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
