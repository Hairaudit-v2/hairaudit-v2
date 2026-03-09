import Link from "next/link";
import { AwardTierBadge, TransparencyStatusBadge } from "@/components/clinic-profile";
import type { AwardTier } from "@/lib/transparency/awardRules";

export type ClinicDirectoryItem = {
  clinic_slug: string;
  clinic_name: string;
  city: string | null;
  country: string | null;
  participation_status: string | null;
  current_award_tier: string | null;
  transparency_score: number | null;
  audited_case_count: number | null;
  contributed_case_count: number | null;
  benchmark_eligible_count: number | null;
  benchmark_eligible_validated_count: number | null;
  average_forensic_score: number | null;
  documentation_integrity_average: number | null;
};

export default function ClinicDirectoryCard({ clinic }: { clinic: ClinicDirectoryItem }) {
  const tier = (clinic.current_award_tier ?? "VERIFIED") as AwardTier;
  const location = [clinic.city, clinic.country].filter(Boolean).join(", ") || null;
  const transparencyRate = Number(clinic.transparency_score ?? 0);
  const audited = Number(clinic.audited_case_count ?? 0);
  const benchmarkValidated = Number(clinic.benchmark_eligible_validated_count ?? clinic.benchmark_eligible_count ?? 0);
  const avgScore = Number(clinic.average_forensic_score ?? 0);

  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden hover:border-white/15 transition-colors">
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <AwardTierBadge tier={tier} />
          <TransparencyStatusBadge participationStatus={clinic.participation_status} />
        </div>
        <h2 className="text-xl font-semibold text-white tracking-tight">
          {clinic.clinic_name}
        </h2>
        {location && <p className="mt-1 text-sm text-slate-400">{location}</p>}
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Participation</dt>
            <dd className="mt-0.5 font-medium text-slate-200">{audited > 0 ? `${transparencyRate}%` : "—"}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Audited cases</dt>
            <dd className="mt-0.5 font-medium text-slate-200">{audited}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Benchmark-eligible</dt>
            <dd className="mt-0.5 font-medium text-slate-200">{benchmarkValidated}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Avg validated score</dt>
            <dd className="mt-0.5 font-medium text-slate-200">{avgScore > 0 ? avgScore.toFixed(1) : "—"}</dd>
          </div>
        </dl>
        <Link
          href={`/clinics/${clinic.clinic_slug}`}
          className="mt-5 inline-flex items-center justify-center w-full sm:w-auto px-4 py-2.5 rounded-xl border border-cyan-500/30 text-cyan-300 text-sm font-medium hover:bg-cyan-500/10 transition-colors"
        >
          View Clinic Profile
        </Link>
      </div>
    </article>
  );
}
