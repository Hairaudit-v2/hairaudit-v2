/**
 * Clinic certificate view: printable certificate derived from profile + engine output.
 * Static v1: no persistence. Uses same tier/score/case data as profile.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import CertificateView from "@/components/certificates/CertificateView";
import {
  evaluateCertification,
  type CaseWithReportForCert,
  type CaseRowForCert,
  type ReportSummaryForCert,
} from "@/lib/certification";
import type { AwardTier } from "@/lib/transparency/awardRules";
import { toCertificateTier } from "@/lib/certificates/types";

const CLINIC_SELECT =
  "id, clinic_name, clinic_slug, current_award_tier, linked_user_id";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("clinic_profiles")
    .select("clinic_name")
    .eq("clinic_slug", slug)
    .eq("profile_visible", true)
    .maybeSingle();
  if (!data) {
    return createPageMetadata({
      title: "Certificate not found | HairAudit",
      description: "This certificate could not be found.",
      pathname: `/clinics/${slug}/certificate`,
    });
  }
  const name = (data as { clinic_name?: string }).clinic_name ?? "Clinic";
  return createPageMetadata({
    title: `Certification certificate — ${name} | HairAudit`,
    description: `HairAudit certification certificate for ${name}.`,
    pathname: `/clinics/${slug}/certificate`,
  });
}

export default async function ClinicCertificatePage({
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

  const row = clinic as {
    id: string;
    clinic_name: string;
    clinic_slug: string | null;
    current_award_tier: string | null;
    linked_user_id: string | null;
  };
  const linkedUserId = row.linked_user_id ?? null;

  let tier: AwardTier = (row.current_award_tier as AwardTier) ?? "VERIFIED";
  let certificationScore: number | null = null;
  let eligiblePublicCases: number | null = null;

  if (linkedUserId) {
    const { data: publicCompletedCases } = await admin
      .from("cases")
      .select("id, status, audit_mode, visibility_scope, is_test")
      .eq("clinic_id", linkedUserId)
      .eq("status", "complete")
      .or("audit_mode.eq.public,visibility_scope.eq.public")
      .eq("is_test", false);

    const caseList = (publicCompletedCases ?? []) as Array<CaseRowForCert & { is_test?: boolean | null }>;
    const caseIds = caseList.map((c) => c.id).filter(Boolean);

    if (caseIds.length > 0) {
      const { data: reportRows } = await admin
        .from("reports")
        .select("case_id, version, summary")
        .in("case_id", caseIds)
        .order("version", { ascending: false })
        .limit(3000);

      const latestByCaseId = new Map<string, ReportSummaryForCert>();
      for (const r of reportRows ?? []) {
        const cid = String(r.case_id ?? "");
        if (!cid || latestByCaseId.has(cid)) continue;
        const summary = (r as { summary?: unknown }).summary;
        if (!summary) continue;
        latestByCaseId.set(cid, summary as ReportSummaryForCert);
      }

      const casesWithReports: CaseWithReportForCert[] = caseList.map((c) => ({
        case: {
          id: c.id,
          status: c.status,
          audit_mode: c.audit_mode,
          visibility_scope: c.visibility_scope,
        },
        latestReportSummary: latestByCaseId.get(c.id) ?? null,
      }));

      const result = evaluateCertification(casesWithReports);
      tier = (result.tier as AwardTier) ?? tier;
      certificationScore = result.score;
      eligiblePublicCases = result.metrics.eligiblePublicCaseCount;
    }
  }

  // Use profile tier when engine did not run (no linked user or no cases)
  const displayTier = tier;
  const certificateId = `HA-${slug}-${displayTier}`.toUpperCase().replace(/\s+/g, "-");
  const issuedAt = new Date().toISOString();

  const certificateData = {
    clinicName: row.clinic_name,
    tier: toCertificateTier(displayTier),
    score: certificationScore,
    caseCount: eligiblePublicCases,
    issuedAt,
    certificateId,
    isSample: false,
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100">
      <SiteHeader />
      <main className="relative flex-1">
        <nav className="relative px-4 sm:px-6 pt-6 pb-2 max-w-4xl mx-auto" aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
            <li><Link href="/" className="hover:text-slate-300 transition-colors">Home</Link></li>
            <li aria-hidden>/</li>
            <li><Link href="/clinics" className="hover:text-slate-300 transition-colors">Clinics</Link></li>
            <li aria-hidden>/</li>
            <li><Link href={`/clinics/${slug}`} className="hover:text-slate-300 transition-colors">{row.clinic_name}</Link></li>
            <li aria-hidden>/</li>
            <li className="text-slate-400" aria-current="page">Certificate</li>
          </ol>
        </nav>
        <CertificateView data={certificateData} variant="fullPage" showDownloadPlaceholder />
      </main>
      <SiteFooter />
    </div>
  );
}
