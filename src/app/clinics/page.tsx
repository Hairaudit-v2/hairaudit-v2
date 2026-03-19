import Link from "next/link";
import { Suspense } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ClinicDirectoryCard from "@/components/clinics/ClinicDirectoryCard";
import ClinicDirectoryFilters from "@/components/clinics/ClinicDirectoryFilters";
import TopCertifiedClinicsSection from "@/components/clinics/TopCertifiedClinicsSection";
import type { ClinicDirectoryItem } from "@/components/clinics/ClinicDirectoryCard";
import { filterAndSortDirectory } from "@/lib/clinics/directoryFilters";
import type { DirectoryClinicRow } from "@/lib/clinics/directoryFilters";
import { computeClinicCertificationRanking } from "@/lib/ranking";
import { createPageMetadata } from "@/lib/seo/pageMetadata";

const CLINIC_SELECT =
  "id, clinic_slug, clinic_name, country, city, participation_status, current_award_tier, transparency_score, audited_case_count, contributed_case_count, benchmark_eligible_count, benchmark_eligible_validated_count, average_forensic_score, documentation_integrity_average, award_progression_paused, linked_user_id";

export const metadata = createPageMetadata({
  title: "Clinic directory | HairAudit",
  description:
    "Explore clinics in the HairAudit transparency ecosystem. Independent, evidence-based benchmarking; clinic profiles reflect validated participation and recognised transparency standards.",
  pathname: "/clinics",
});

const FOUNDING_SLUGS = (process.env.NEXT_PUBLIC_FOUNDING_CLINIC_SLUGS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export default async function ClinicDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; tier?: string; country?: string; status?: string; benchmark?: string; sort?: string; has_public_cases?: string; founding?: string }>;
}) {
  const params = await searchParams;
  const admin = createSupabaseAdminClient();

  const [{ data: rows }, { data: publicCaseRows }] = await Promise.all([
    admin
      .from("clinic_profiles")
      .select(CLINIC_SELECT)
      .eq("profile_visible", true)
      .not("clinic_slug", "is", null),
    admin
      .from("cases")
      .select("clinic_id")
      .eq("audit_mode", "public")
      .not("clinic_id", "is", null),
  ]);

  const publicCaseCountByClinicUserId = new Map<string, number>();
  for (const c of publicCaseRows ?? []) {
    const uid = String((c as { clinic_id?: string }).clinic_id ?? "");
    if (uid) publicCaseCountByClinicUserId.set(uid, (publicCaseCountByClinicUserId.get(uid) ?? 0) + 1);
  }

  const allRows = (rows ?? []) as DirectoryClinicRow[];
  const rowsWithPublicCount: DirectoryClinicRow[] = allRows.map((r) => ({
    ...r,
    public_case_count: r.linked_user_id ? publicCaseCountByClinicUserId.get(r.linked_user_id) ?? 0 : 0,
  }));

  const filterParams = {
    search: params.search,
    tier: params.tier,
    country: params.country,
    status: params.status,
    benchmark: params.benchmark,
    sort: params.sort,
    has_public_cases: params.has_public_cases,
    founding: params.founding,
    founding_slugs: params.founding === "1" ? FOUNDING_SLUGS : undefined,
  };
  const filtered = filterAndSortDirectory(rowsWithPublicCount, filterParams);
  const clinics: ClinicDirectoryItem[] = filtered.map((r) => {
    const publicCaseCount = r.linked_user_id ? publicCaseCountByClinicUserId.get(r.linked_user_id) ?? null : null;
    return {
      clinic_slug: r.clinic_slug!,
      clinic_name: r.clinic_name,
      city: r.city,
      country: r.country,
      participation_status: r.participation_status,
      current_award_tier: r.current_award_tier,
      transparency_score: r.transparency_score,
      audited_case_count: publicCaseCount ?? r.audited_case_count,
      contributed_case_count: r.contributed_case_count,
      benchmark_eligible_count: r.benchmark_eligible_count,
      benchmark_eligible_validated_count: r.benchmark_eligible_validated_count,
      average_forensic_score: r.average_forensic_score,
      documentation_integrity_average: r.documentation_integrity_average,
    };
  });

  const countries = [...new Set(allRows.map((r) => r.country).filter(Boolean))] as string[];
  countries.sort((a, b) => (a ?? "").localeCompare(b ?? ""));

  const rankingInput = (allRows as Array<DirectoryClinicRow & { id?: string }>)
    .filter((r) => r.id != null && r.clinic_slug != null)
    .map((r) => ({
      id: r.id!,
      clinic_slug: r.clinic_slug,
      clinic_name: r.clinic_name,
      linked_user_id: r.linked_user_id ?? null,
    }));
  const fullRanking = await computeClinicCertificationRanking({
    admin,
    clinics: rankingInput,
    maxClinics: 50,
  });
  const topCertified = fullRanking.slice(0, 5);

  const featured = clinics.filter(
    (c) => c.current_award_tier === "PLATINUM" || c.current_award_tier === "GOLD"
  );
  const featuredStrip = featured.slice(0, 6);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-slate-100">
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(56,189,248,0.08),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_60%,rgba(139,92,246,0.06),transparent)]" />
      </div>

      <SiteHeader />
      <main className="relative flex-1">
        <section className="relative px-4 sm:px-6 py-16 sm:py-24">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
              Explore clinics participating in the HairAudit transparency ecosystem
            </h1>
            <p className="mt-6 text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Independent, evidence-based benchmarking. These profiles reflect validated participation,
              documented case contribution, and recognised transparency standards.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/verified-surgeon-program"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-cyan-500/30 text-cyan-300 text-sm font-medium hover:bg-cyan-500/10 transition-colors"
              >
                Learn About the Verified Program
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-slate-400 text-sm font-medium hover:text-slate-200 transition-colors"
              >
                How It Works
              </Link>
            </div>
            <p className="mt-6 text-sm text-slate-500 max-w-2xl mx-auto">
              Want to understand what these recognition tiers mean?{" "}
              <Link href="/verified-surgeon-program" className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
                View the Verified Surgeon Transparency Program
              </Link>
              .
            </p>
          </div>
        </section>

        <section className="relative px-4 sm:px-6 pb-8">
          <div className="max-w-5xl mx-auto">
            <Suspense fallback={<div className="rounded-2xl border border-white/10 bg-white/5 h-24 animate-pulse" />}>
              <ClinicDirectoryFilters countries={countries} foundingSlugs={FOUNDING_SLUGS} />
            </Suspense>
          </div>
        </section>

        {topCertified.length > 0 && (
          <TopCertifiedClinicsSection topClinics={topCertified} />
        )}

        {featuredStrip.length > 0 && (
          <section className="relative px-4 sm:px-6 py-8">
            <div className="max-w-5xl mx-auto">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-4">
                Featured recognition
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
                {featuredStrip.map((clinic) => (
                  <div key={clinic.clinic_slug} className="flex-shrink-0 w-[280px]">
                    <ClinicDirectoryCard clinic={clinic} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="relative px-4 sm:px-6 py-12 sm:py-16">
          <div className="max-w-5xl mx-auto">
            <nav className="mb-6" aria-label="Breadcrumb">
              <Link href="/" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Home</Link>
              <span className="text-slate-600 mx-2">/</span>
              <Link href="/verified-surgeon-program" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Verified Program</Link>
              <span className="text-slate-600 mx-2">/</span>
              <span className="text-slate-400 text-sm">Clinics</span>
            </nav>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-6">
              {clinics.length === 0 ? "No clinics match" : "All participating clinics"}
            </h2>
            {clinics.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-12 text-center">
                <p className="text-slate-400">
                  No clinics match your filters. Try adjusting search or filters to see more profiles.
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Only clinics with a public profile and valid slug are listed.
                </p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {clinics.map((clinic) => (
                  <ClinicDirectoryCard key={clinic.clinic_slug} clinic={clinic} />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
