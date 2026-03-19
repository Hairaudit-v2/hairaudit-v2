import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type DomainScoreV1 = {
  domain_id?: string;
  weighted_score?: number;
};

type OverallScoresV1 = {
  benchmark_score?: number;
  confidence_grade?: string;
  confidence_multiplier?: number;
};

function shortId(id: string) {
  return id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

function clamp01(n: unknown) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function avg(xs: number[]) {
  const ys = xs.filter((n) => Number.isFinite(n));
  if (ys.length === 0) return null;
  return ys.reduce((a, b) => a + b, 0) / ys.length;
}

export default async function ClinicsLeaderboardPage() {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createSupabaseAdminClient();

  const { data: cases } = await admin
    .from("cases")
    .select("id, doctor_id, clinic_id, status, created_at")
    .eq("status", "complete")
    .eq("audit_mode", "public")
    .not("clinic_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1500);

  const caseRows = (cases ?? []).filter((c) => c?.id && c?.clinic_id);
  const caseIds = caseRows.map((c) => c.id);

  const { data: reports } = caseIds.length
    ? await admin
        .from("reports")
        .select("case_id, version, summary, created_at, counts_for_awards, award_contribution_weight")
        .in("case_id", caseIds)
        .order("version", { ascending: false })
        .limit(6000)
    : { data: [] as any[] };

  const latestByCase = new Map<string, any>();
  for (const r of reports ?? []) {
    const cid = String(r.case_id ?? "");
    if (!cid || latestByCase.has(cid)) continue;
    latestByCase.set(cid, r);
  }

  const DOMAIN_ORDER = ["SP", "DP", "GV", "IC", "DI"] as const;

  type Agg = {
    clinic_id: string;
    eligible_cases: number;
    benchmark_score_sum: number;
    domain_weighted_sum: Record<string, number>;
    confidence_mult_sum: number;
    grade_counts: Record<string, number>;
    /** Foundation: sum of award_contribution_weight for benchmark-eligible cases (future weighting). */
    weighted_benchmark_sum: number;
  };

  const aggByClinic = new Map<string, Agg>();

  for (const c of caseRows as any[]) {
    const clinicId = String(c.clinic_id ?? "");
    if (!clinicId) continue;
    const rep = latestByCase.get(String(c.id));
    const summary = (rep?.summary ?? {}) as any;
    const forensic = summary?.forensic_audit ?? null;
    const v1 = forensic?.domain_scores_v1?.domains as DomainScoreV1[] | undefined;
    const bench = forensic?.benchmark as any;
    const overall = forensic?.overall_scores_v1 as OverallScoresV1 | undefined;
    const eligible = Boolean(bench?.eligible);
    if (!eligible || !Array.isArray(v1) || v1.length === 0) continue;

    const benchmarkScore = Number(overall?.benchmark_score);
    if (!Number.isFinite(benchmarkScore)) continue;

    const cur = aggByClinic.get(clinicId) ?? {
      clinic_id: clinicId,
      eligible_cases: 0,
      benchmark_score_sum: 0,
      domain_weighted_sum: {},
      confidence_mult_sum: 0,
      grade_counts: {},
      weighted_benchmark_sum: 0,
    };

    cur.eligible_cases += 1;
    cur.benchmark_score_sum += benchmarkScore;
    const contribWeight = Number((rep as { award_contribution_weight?: number | null })?.award_contribution_weight);
    if (Number.isFinite(contribWeight)) cur.weighted_benchmark_sum += contribWeight;
    const confMult = Number(bench?.overall_confidence ?? overall?.confidence_multiplier);
    if (Number.isFinite(confMult)) cur.confidence_mult_sum += clamp01(confMult);
    const grade = String(bench?.confidence_grade ?? overall?.confidence_grade ?? "").trim();
    if (grade) cur.grade_counts[grade] = (cur.grade_counts[grade] ?? 0) + 1;

    for (const id of DOMAIN_ORDER) {
      const d = v1.find((x) => String(x?.domain_id ?? "") === id);
      const w = Number(d?.weighted_score);
      if (Number.isFinite(w)) cur.domain_weighted_sum[id] = (cur.domain_weighted_sum[id] ?? 0) + w;
    }

    aggByClinic.set(clinicId, cur);
  }

  const rows = Array.from(aggByClinic.values())
    .map((a) => {
      const n = a.eligible_cases || 1;
      const benchAvg = a.benchmark_score_sum / n;
      const confAvg = a.confidence_mult_sum / n;
      const grade = Object.entries(a.grade_counts).sort((x, y) => (y[1] ?? 0) - (x[1] ?? 0))[0]?.[0] ?? "—";
      const domainWeightedAvg: Record<string, number> = {};
      for (const id of DOMAIN_ORDER) domainWeightedAvg[id] = (a.domain_weighted_sum[id] ?? 0) / n;
      return {
        ...a,
        benchmark_score_avg: benchAvg,
        confidence_mult_avg: confAvg,
        confidence_grade_mode: grade,
        domainWeightedAvg,
        weighted_benchmark_total: a.weighted_benchmark_sum,
        contribution_score: n > 0 ? a.weighted_benchmark_sum / n : 0,
      };
    })
    .sort((a, b) => b.benchmark_score_avg - a.benchmark_score_avg);

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clinic Leaderboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            Confidence-gated rankings based on benchmark-eligible cases only.
          </p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-slate-600 hover:text-slate-900">
          ← Dashboard
        </Link>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <div className="font-semibold">Benchmark eligibility (balanced_v1)</div>
        <ul className="mt-1 list-disc pl-5 space-y-0.5">
          <li>Completeness ≥ 85</li>
          <li>Evidence grade A or B</li>
          <li>Required doctor photo set complete (all required categories meet min)</li>
          <li>graftCountImplanted present</li>
        </ul>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">
          No benchmark-eligible cases yet.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3 text-left">Rank</th>
                <th className="px-4 py-3 text-left">Clinic</th>
                <th className="px-4 py-3 text-right">Eligible cases</th>
                <th className="px-4 py-3 text-right">Benchmark Score</th>
                <th className="px-4 py-3 text-right">Confidence</th>
                <th className="px-4 py-3 text-right">SP</th>
                <th className="px-4 py-3 text-right">DP</th>
                <th className="px-4 py-3 text-right">GV</th>
                <th className="px-4 py-3 text-right">IC</th>
                <th className="px-4 py-3 text-right">DI</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 50).map((r, idx) => (
                <tr key={r.clinic_id} className={idx % 2 ? "bg-white" : "bg-slate-50/40"}>
                  <td className="px-4 py-3">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-900" title={r.clinic_id}>
                    {shortId(r.clinic_id)}
                  </td>
                  <td className="px-4 py-3 text-right">{r.eligible_cases}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{Math.round(r.benchmark_score_avg)}</td>
                  <td className="px-4 py-3 text-right">
                    {r.confidence_grade_mode} ({Number.isFinite(r.confidence_mult_avg) ? r.confidence_mult_avg.toFixed(2) : "—"})
                  </td>
                  <td className="px-4 py-3 text-right">{Math.round(r.domainWeightedAvg.SP ?? 0)}</td>
                  <td className="px-4 py-3 text-right">{Math.round(r.domainWeightedAvg.DP ?? 0)}</td>
                  <td className="px-4 py-3 text-right">{Math.round(r.domainWeightedAvg.GV ?? 0)}</td>
                  <td className="px-4 py-3 text-right">{Math.round(r.domainWeightedAvg.IC ?? 0)}</td>
                  <td className="px-4 py-3 text-right">{Math.round(r.domainWeightedAvg.DI ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

