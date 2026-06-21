"use client";

import TrackedLink from "@/components/analytics/TrackedLink";
import { PATHWAY_CHOOSER_HREF } from "@/lib/patient/patientReviewPathway";
import { useI18n } from "@/components/i18n/I18nProvider";
import { cn } from "@/lib/utils";

type ProfessionalPathwayRibbonProps = {
  className?: string;
  /** When true, uses higher-contrast borders for slate-dominant pages. */
  variant?: "fi" | "slate";
};

/**
 * Shared banner for clinic/professional routes: clearly separated from the patient audit path.
 */
export default function ProfessionalPathwayRibbon({
  className,
  variant = "fi",
}: ProfessionalPathwayRibbonProps) {
  const { t } = useI18n();

  const shell =
    variant === "slate"
      ? "border-cyan-400/25 bg-cyan-500/10"
      : "border-white/10 bg-white/[0.04] backdrop-blur-sm";

  const btnNeutral =
    "inline-flex min-w-0 max-w-full shrink items-center justify-center break-words rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-white/10 transition-colors sm:px-4";

  return (
    <div className={cn("max-w-full rounded-2xl border px-4 py-4 sm:px-6 sm:py-5", shell, className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/90">
        {t("marketing.professionalRibbon.eyebrow")}
      </p>
      <p className="mt-2 text-sm text-slate-200 leading-relaxed break-words">
        {t("marketing.professionalRibbon.bodyBefore")}{" "}
        <TrackedLink
          href={PATHWAY_CHOOSER_HREF}
          eventName="cta_professional_ribbon_start_free_audit"
          className="font-medium text-amber-300 hover:text-amber-200 whitespace-normal"
        >
          {t("marketing.professionalRibbon.auditLink")}
        </TrackedLink>
        {t("marketing.professionalRibbon.bodyAfter")}
      </p>
      <p className="mt-2 text-xs text-slate-400 leading-relaxed break-words">
        {t("marketing.professionalRibbon.verification")}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <TrackedLink
          href="/for-clinics"
          eventName="cta_professional_ribbon_for_clinics"
          className={btnNeutral}
        >
          {t("marketing.professionalRibbon.forClinics")}
        </TrackedLink>
        <TrackedLink
          href="/professionals"
          eventName="cta_professional_ribbon_professionals"
          className={btnNeutral}
        >
          {t("marketing.professionalRibbon.forProfessionals")}
        </TrackedLink>
        <TrackedLink
          href="/signup?role=clinic"
          eventName="cta_professional_ribbon_signup_clinic"
          className="inline-flex min-w-0 max-w-full shrink items-center justify-center break-words rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-center text-sm font-semibold text-amber-100 hover:bg-amber-400/15 transition-colors sm:px-4"
        >
          {t("marketing.professionalRibbon.createClinic")}
        </TrackedLink>
        <TrackedLink
          href="/signup?role=doctor"
          eventName="cta_professional_ribbon_signup_doctor"
          className="inline-flex min-w-0 max-w-full shrink items-center justify-center break-words rounded-xl border border-violet-400/25 bg-violet-500/10 px-3 py-2 text-center text-sm font-semibold text-violet-100 hover:bg-violet-500/15 transition-colors sm:px-4"
        >
          {t("marketing.professionalRibbon.createDoctor")}
        </TrackedLink>
      </div>
    </div>
  );
}
