/**
 * Minimal public "Top Certified Clinics" section.
 * Trust-focused; uses ranking helper output only. No internal metrics or thresholds.
 */

import Link from "next/link";
import CertificationBadge from "@/components/clinic-profile/CertificationBadge";
import { CERTIFICATION_TRUST_LINE } from "@/lib/clinics/certificationCopy";
import type { ClinicCertificationRankingRow } from "@/lib/ranking";

type Props = {
  topClinics: ClinicCertificationRankingRow[];
};

export default function TopCertifiedClinicsSection({ topClinics }: Props) {
  if (topClinics.length === 0) return null;

  return (
    <section className="relative px-4 sm:px-6 py-10 sm:py-12" aria-labelledby="top-certified-heading">
      <div className="max-w-5xl mx-auto">
        <h2
          id="top-certified-heading"
          className="text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-6"
        >
          Top Certified Clinics
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {topClinics.map((row) => (
            <article
              key={row.clinicId}
              className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden hover:border-white/15 transition-colors"
            >
              <div className="p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <CertificationBadge tier={row.currentTier} variant="compact" />
                </div>
                <h3 className="text-lg font-semibold text-white tracking-tight">
                  {row.clinicName}
                </h3>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Certification score
                    </dt>
                    <dd className="mt-0.5 font-medium text-slate-200">
                      {row.certificationScore.toFixed(1)}/100
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Eligible public cases
                    </dt>
                    <dd className="mt-0.5 font-medium text-slate-200">
                      {row.eligiblePublicCases}
                    </dd>
                  </div>
                </dl>
                <p className="mt-4 text-xs text-slate-500 leading-snug">
                  {CERTIFICATION_TRUST_LINE}
                </p>
                {row.clinicSlug && (
                  <Link
                    href={`/clinics/${row.clinicSlug}`}
                    className="mt-4 inline-flex items-center justify-center w-full sm:w-auto px-4 py-2.5 rounded-xl border border-cyan-500/30 text-cyan-300 text-sm font-medium hover:bg-cyan-500/10 transition-colors"
                  >
                    View profile
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
        <p className="mt-6 text-center">
          <Link
            href="/clinics"
            className="text-sm text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
          >
            View all clinics →
          </Link>
        </p>
      </div>
    </section>
  );
}
