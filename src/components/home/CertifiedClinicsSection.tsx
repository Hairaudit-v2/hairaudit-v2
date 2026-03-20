/**
 * Homepage section: demo certification certificates (one per tier).
 * Clickable cards linking to certificate placeholder view.
 */

"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { DEMO_CERTIFICATES } from "@/lib/certificates/demoCertificates";
import { getCertificationLabel } from "@/lib/clinics/certificationCopy";

const TIER_BADGE_CLASS: Record<string, string> = {
  platinum: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  gold: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  silver: "bg-slate-500/20 text-slate-200 border-slate-500/30",
  verified: "bg-cyan-500/15 text-cyan-200 border-cyan-500/30",
};

function tierToLabel(tier: string): string {
  const map: Record<string, string> = {
    platinum: "PLATINUM",
    gold: "GOLD",
    silver: "SILVER",
    verified: "VERIFIED",
  };
  return getCertificationLabel(map[tier] ?? "VERIFIED");
}

export default function CertifiedClinicsSection() {
  const { t } = useI18n();

  return (
    <section
      className="relative px-4 sm:px-6 py-16 sm:py-20 border-t border-slate-700/60"
      aria-labelledby="certified-clinics-heading"
    >
      <div className="max-w-4xl mx-auto">
        <h2
          id="certified-clinics-heading"
          className="text-2xl sm:text-3xl font-bold text-white tracking-tight"
        >
          {t("marketing.home.certifiedTitle")}
        </h2>
        <p className="mt-3 text-slate-400 max-w-xl">{t("marketing.home.certifiedSubtitle")}</p>
        <div className="mt-6">
          <Link
            href="/certificates/demo?tier=platinum"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-stone-200/20 border border-stone-400/40 text-stone-200 text-sm font-medium hover:bg-stone-200/30 hover:border-stone-400/60 transition-colors"
          >
            {t("marketing.home.certifiedCtaPlatinum")}
          </Link>
        </div>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {DEMO_CERTIFICATES.map((cert) => (
            <Link
              key={cert.certificateId}
              href={`/certificates/demo?tier=${cert.tier}`}
              className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 flex flex-col hover:border-cyan-500/30 hover:bg-white/[0.06] transition-colors text-left"
            >
              <span
                className={`inline-flex w-fit rounded-lg border px-2.5 py-0.5 text-xs font-bold ${TIER_BADGE_CLASS[cert.tier] ?? TIER_BADGE_CLASS.verified}`}
              >
                {tierToLabel(cert.tier)}
              </span>
              <h3 className="mt-3 text-lg font-semibold text-white group-hover:text-cyan-200 transition-colors">
                {cert.clinicName}
              </h3>
              {cert.score != null && (
                <p className="mt-2 text-sm text-slate-500">
                  {t("marketing.home.certifiedScoreLabel")} {cert.score.toFixed(1)}/100
                  {cert.caseCount != null &&
                    ` · ${cert.caseCount} ${t("marketing.home.certifiedCasesSuffix")}`}
                </p>
              )}
              <span className="mt-4 text-xs font-medium text-cyan-400 group-hover:text-cyan-300">
                {t("marketing.home.certifiedViewCert")}
              </span>
            </Link>
          ))}
        </div>
        <p className="mt-8 text-center">
          <Link
            href="/clinics"
            className="text-sm text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
          >
            {t("marketing.home.certifiedExplore")}
          </Link>
        </p>
      </div>
    </section>
  );
}
