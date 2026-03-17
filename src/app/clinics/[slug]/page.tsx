import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import {
  PublicProfileHero,
  ClinicMetricCard,
  RecognitionPanel,
} from "@/components/clinic-profile";
import { getNextMilestoneFromProfile } from "@/lib/transparency/awardRules";
import type { AwardTier } from "@/lib/transparency/awardRules";

type ClinicProfileRow = {
  id: string;
  clinic_name: string;
  clinic_slug: string | null;
  country: string | null;
  city: string | null;
  participation_status: string | null;
  transparency_score: number | null;
  performance_score: number | null;
  volume_confidence_score: number | null;
  current_award_tier: string | null;
  audited_case_count: number | null;
  contributed_case_count: number | null;
  benchmark_eligible_count: number | null;
  validated_case_count?: number | null;
  benchmark_eligible_validated_count?: number | null;
  average_forensic_score: number | null;
  documentation_integrity_average: number | null;
  profile_visible: boolean | null;
  award_progression_paused?: boolean | null;
};

type DoctorRow = {
  doctor_name: string;
  current_award_tier: string | null;
};

const CLINIC_SELECT =
  "id, clinic_name, clinic_slug, country, city, participation_status, transparency_score, performance_score, volume_confidence_score, current_award_tier, audited_case_count, contributed_case_count, benchmark_eligible_count, average_forensic_score, documentation_integrity_average, profile_visible, validated_case_count, benchmark_eligible_validated_count, award_progression_paused";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pathname = `/clinics/${slug}`;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("clinic_profiles")
    .select("clinic_name, current_award_tier, city, country")
    .eq("clinic_slug", slug)
    .eq("profile_visible", true)
    .maybeSingle();

  if (!data) {
    return createPageMetadata({
      title: "Clinic not found | HairAudit",
      description: "This clinic profile could not be found.",
      pathname,
    });
  }

  const row = data as { clinic_name?: string; current_award_tier?: string; city?: string; country?: string };
  const clinicName = row.clinic_name ?? "Clinic";
  const title = [row.clinic_name, "HairAudit profile"].filter(Boolean).join(" — ");
  const location = [row.city, row.country].filter(Boolean).join(", ");
  const description = location
    ? `${clinicName} — ${row.current_award_tier ?? "Verified"} recognition. Evidence-backed transparency profile. ${location}.`
    : `${clinicName} — HairAudit evidence-backed transparency profile.`;

  return createPageMetadata({
    title,
    description,
    pathname,
  });
}

export default async function PublicClinicProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = createSupabaseAdminClient();

  const { data: clinic, error } = await admin
    .from("clinic_profiles")
    .select(CLINIC_SELECT)
    .eq("clinic_slug", slug)
    .eq("profile_visible", true)
    .maybeSingle();

  if (error || !clinic) notFound();

  const row = clinic as ClinicProfileRow;
  const validatedCount =
    row.validated_case_count ?? row.contributed_case_count ?? 0;
  const benchmarkValidated =
    row.benchmark_eligible_validated_count ?? row.benchmark_eligible_count ?? 0;

  const nextMilestone = getNextMilestoneFromProfile({
    current_award_tier: row.current_award_tier ?? undefined,
    validated_case_count: validatedCount,
    average_forensic_score: row.average_forensic_score ?? undefined,
    benchmark_eligible_validated_count: benchmarkValidated,
    transparency_score: row.transparency_score ?? undefined,
    documentation_integrity_average: row.documentation_integrity_average ?? undefined,
    award_progression_paused: row.award_progression_paused ?? undefined,
    volume_confidence_score: row.volume_confidence_score ?? undefined,
  });

  const { data: doctors } = await admin
    .from("doctor_profiles")
    .select("doctor_name, current_award_tier")
    .eq("clinic_profile_id", row.id)
    .not("doctor_name", "is", null);

  const doctorList = (doctors ?? []) as DoctorRow[];

  const tier = (row.current_award_tier ?? "VERIFIED") as AwardTier;
  const transparencyRate = Number(row.transparency_score ?? 0);
  const audited = Number(row.audited_case_count ?? 0);
  const contributed = Number(row.contributed_case_count ?? 0);
  const avgScore = Number(row.average_forensic_score ?? 0);
  const docIntegrity = Number(row.documentation_integrity_average ?? 0);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-slate-100">
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(56,189,248,0.08),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_60%,rgba(139,92,246,0.06),transparent)]" />
      </div>

      <SiteHeader />
      <main className="relative flex-1">
        <nav className="relative px-4 sm:px-6 pt-6 pb-0 max-w-4xl mx-auto" aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
            <li><Link href="/" className="hover:text-slate-300 transition-colors">Home</Link></li>
            <li aria-hidden>/</li>
            <li><Link href="/clinics" className="hover:text-slate-300 transition-colors">Clinics</Link></li>
            <li aria-hidden>/</li>
            <li className="text-slate-400 truncate max-w-[200px] sm:max-w-none" aria-current="page">{row.clinic_name}</li>
          </ol>
        </nav>
        <PublicProfileHero
          clinicName={row.clinic_name}
          city={row.city}
          country={row.country}
          currentAwardTier={tier}
          participationStatus={row.participation_status}
        />

        <section className="relative px-4 sm:px-6 py-12 sm:py-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-6">
              Key metrics
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <ClinicMetricCard
                label="Transparency participation"
                value={audited > 0 ? `${transparencyRate.toFixed(0)}%` : "—"}
                placeholder={audited === 0}
              />
              <ClinicMetricCard
                label="Audited cases"
                value={audited}
                placeholder={false}
              />
              <ClinicMetricCard
                label="Doctor-contributed cases"
                value={contributed}
                placeholder={false}
              />
              <ClinicMetricCard
                label="Benchmark-eligible"
                value={benchmarkValidated}
                placeholder={false}
              />
              <ClinicMetricCard
                label="Avg validated score"
                value={avgScore > 0 ? avgScore.toFixed(1) : "—"}
                placeholder={avgScore === 0}
              />
              <ClinicMetricCard
                label="Documentation integrity"
                value={docIntegrity > 0 ? docIntegrity.toFixed(1) : "—"}
                placeholder={docIntegrity === 0}
              />
            </div>
          </div>
        </section>

        <section className="relative px-4 sm:px-6 py-12 sm:py-16">
          <div className="max-w-4xl mx-auto">
            <RecognitionPanel
              currentAwardTier={tier}
              nextMilestone={nextMilestone}
              participationStatus={row.participation_status}
            />
          </div>
        </section>

        <section className="relative px-4 sm:px-6 py-12 sm:py-16">
          <div className="max-w-4xl mx-auto rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 sm:p-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-400">
              Why this profile matters
            </h2>
            <p className="mt-4 text-slate-400 leading-relaxed">
              HairAudit provides independent, evidence-based benchmarking. Profiles are based on
              evidence contribution and validated case metrics. Recognition is not purchased — it is
              earned through transparency participation, documentation quality, and consistent
              performance. Clinics that contribute documentation are reviewed more fairly and
              completely within that framework.
            </p>
          </div>
        </section>

        {doctorList.length > 0 && (
          <section className="relative px-4 sm:px-6 py-12 sm:py-16">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-400 mb-4">
                Participating doctors
              </h2>
              <ul className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm divide-y divide-white/10 overflow-hidden">
                {doctorList.map((d, i) => (
                  <li
                    key={i}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                  >
                    <span className="font-medium text-white">{d.doctor_name}</span>
                    {d.current_award_tier && (
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        {d.current_award_tier}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section className="relative px-4 sm:px-6 py-12 sm:py-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-400 mb-6">
              Profile highlights
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {benchmarkValidated > 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Benchmark readiness
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    {benchmarkValidated} validated benchmark-eligible case
                    {benchmarkValidated !== 1 ? "s" : ""} contributing to recognition.
                  </p>
                </div>
              )}
              {contributed > 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Documentation-led contribution
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    Case documentation contributed to support fair forensic review.
                  </p>
                </div>
              )}
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Recognition band
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  {tier} — evidence-based recognition tier based on validated participation and
                  consistency.
                </p>
              </div>
              {(row.participation_status === "active" ||
                row.participation_status === "high_transparency") && (
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Transparency engagement
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    Active transparency participant in the HairAudit ecosystem.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="relative px-4 sm:px-6 py-16 sm:py-20">
          <div className="max-w-4xl mx-auto rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-cyan-500/10 to-violet-500/5 p-8 sm:p-10 text-center backdrop-blur-sm">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Get involved
            </h2>
            <p className="mt-3 text-slate-400 text-sm max-w-xl mx-auto">
              Choose your next step based on your pathway: patient review or professional participation.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-4">
              <Link
                href="/request-review"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-semibold text-sm hover:bg-cyan-400 transition-colors"
              >
                Request Review
              </Link>
              <Link
                href="/professionals/apply"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-slate-600 text-slate-200 text-sm font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
              >
                Apply for Participation
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
