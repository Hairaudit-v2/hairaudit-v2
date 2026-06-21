import Link from "next/link";
import { Suspense } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import HairAuditFiMarketingShell from "@/components/marketing/fi-network/HairAuditFiMarketingShell";
import PublicMarketingHero from "@/components/marketing/PublicMarketingHero";
import ClinicDirectoryCard from "@/components/clinics/ClinicDirectoryCard";
import ClinicDirectoryFilters from "@/components/clinics/ClinicDirectoryFilters";
import TopCertifiedClinicsSection from "@/components/clinics/TopCertifiedClinicsSection";
import type { ClinicDirectoryItem } from "@/components/clinics/ClinicDirectoryCard";
import { filterAndSortDirectory } from "@/lib/clinics/directoryFilters";
import type { DirectoryClinicRow } from "@/lib/clinics/directoryFilters";
import { computeClinicCertificationRanking } from "@/lib/ranking";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import BreadcrumbListSchema from "@/components/seo/BreadcrumbListSchema";
import { PUBLIC_CTAS } from "@/lib/marketing/publicMarketingCopy";
import { PATHWAY_CHOOSER_HREF } from "@/lib/patient/patientReviewPathway";
import { fiHairauditPrimaryButtonClass } from "@/lib/fi-ui/hairauditPrimaryButton";
import { Badge, Section, networkButtonVariants } from "@/packages/ui";
import { cn } from "@/lib/utils";

const CLINIC_SELECT =
  "id, clinic_slug, clinic_name, country, city, participation_status, current_award_tier, transparency_score, audited_case_count, contributed_case_count, benchmark_eligible_count, benchmark_eligible_validated_count, average_forensic_score, documentation_integrity_average, award_progression_paused, linked_user_id";

export const metadata = createPageMetadata({
  title: "For Clinics | Hair Transplant Quality Assurance & Transparency | HairAudit",
  description:
    "Directory of clinics in the HairAudit transparency ecosystem: independent, evidence-based benchmarking and profiles that reflect validated participation—useful for patients comparing options and for clinics demonstrating QA commitment.",
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
    <HairAuditFiMarketingShell>
      <BreadcrumbListSchema
        items={[
          { name: "Home", pathname: "/" },
          { name: "Verified clinic directory", pathname: "/clinics" },
        ]}
      />
      <main id="main-content" className="relative flex-1">
        <PublicMarketingHero
          badge="Verified clinic intelligence"
          title="Clinic transparency directory"
          description="Independent, evidence-based profiles that reflect validated participation, documented case contribution, and recognised transparency standards—not a basic listing page."
          centered
        >
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/verified-surgeon-program"
              className={cn(networkButtonVariants({ variant: "secondary", size: "md" }))}
            >
              Verified Surgeon Program
            </Link>
            <Link href={PATHWAY_CHOOSER_HREF} className={fiHairauditPrimaryButtonClass("md")}>
              {PUBLIC_CTAS.startFreeHairAudit}
            </Link>
          </div>
        </PublicMarketingHero>

        <Section className="border-t border-border/30 pb-8">
          <div className="mx-auto max-w-5xl">
            <Suspense fallback={<div className="h-24 animate-pulse rounded-2xl border border-border/50 bg-card/60" />}>
              <ClinicDirectoryFilters countries={countries} foundingSlugs={FOUNDING_SLUGS} />
            </Suspense>
          </div>
        </Section>

        {topCertified.length > 0 && (
          <TopCertifiedClinicsSection topClinics={topCertified} />
        )}

        {featuredStrip.length > 0 && (
          <Section className="border-t border-border/30 py-8">
            <div className="mx-auto max-w-5xl">
              <Badge tone="neutral">Featured recognition</Badge>
              <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
                {featuredStrip.map((clinic) => (
                  <div key={clinic.clinic_slug} className="w-[280px] shrink-0">
                    <ClinicDirectoryCard clinic={clinic} />
                  </div>
                ))}
              </div>
            </div>
          </Section>
        )}

        <Section className="border-t border-border/30">
          <div className="mx-auto max-w-5xl">
            <nav className="mb-6" aria-label="Breadcrumb">
              <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
                Home
              </Link>
              <span className="mx-2 text-muted-foreground">/</span>
              <Link href="/verified-surgeon-program" className="text-sm text-muted-foreground hover:text-foreground">
                Verified Program
              </Link>
              <span className="mx-2 text-muted-foreground">/</span>
              <span className="text-sm text-foreground">Clinics</span>
            </nav>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-sky-300">
              {clinics.length === 0 ? "No clinics match" : "All participating clinics"}
            </h2>
            {clinics.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-border/50 bg-card/70 p-12 text-center shadow-fi-panel">
                <p className="text-muted-foreground">
                  No clinics match your filters. Try adjusting search or filters to see more profiles.
                </p>
                <p className="mt-2 text-sm text-muted-foreground/80">
                  Only clinics with a public profile and valid slug are listed.
                </p>
              </div>
            ) : (
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {clinics.map((clinic) => (
                  <ClinicDirectoryCard key={clinic.clinic_slug} clinic={clinic} />
                ))}
              </div>
            )}
          </div>
        </Section>
      </main>
    </HairAuditFiMarketingShell>
  );
}
