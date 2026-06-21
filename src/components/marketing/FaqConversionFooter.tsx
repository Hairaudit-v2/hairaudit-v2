"use client";

import Link from "next/link";

import TrackedLink from "@/components/analytics/TrackedLink";
import { fiHairauditPrimaryButtonClass } from "@/lib/fi-ui/hairauditPrimaryButton";
import { PUBLIC_CTAS } from "@/lib/marketing/publicMarketingCopy";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n/I18nProvider";
import { networkButtonVariants } from "@/packages/ui";

export default function FaqConversionFooter() {
  const { t } = useI18n();

  return (
    <div className="mt-12 flex flex-col flex-wrap gap-3 sm:mt-14 sm:flex-row">
      <TrackedLink
        href="/request-review"
        eventName="cta_start_free_audit_faq_footer"
        className={fiHairauditPrimaryButtonClass("md")}
      >
        {t("marketing.faqFooter.ctaStartAudit")}
      </TrackedLink>
      <TrackedLink
        href="/demo-report"
        eventName="cta_interactive_demo_faq_footer"
        className={cn(networkButtonVariants({ variant: "secondary", size: "md" }))}
      >
        {t("marketing.faqFooter.ctaInteractiveDemo")}
      </TrackedLink>
      <Link
        href="/methodology"
        className={cn(networkButtonVariants({ variant: "secondary", size: "md" }))}
      >
        {t("marketing.faqFooter.ctaMethodology")}
      </Link>
      <TrackedLink
        href="/professionals"
        eventName="cta_professional_standards_faq_footer"
        className={cn(networkButtonVariants({ variant: "secondary", size: "md" }))}
      >
        {t("marketing.faqFooter.ctaProfessionals")}
      </TrackedLink>
    </div>
  );
}
