"use client";

import Image from "next/image";
import Link from "next/link";

import TrackedLink from "@/components/analytics/TrackedLink";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { fiHairauditPrimaryButtonClass } from "@/lib/fi-ui/hairauditPrimaryButton";
import { PlatformNav } from "@/packages/ui";
import { resolveProductHref } from "@/lib/network/resolveProductHref";

export default function HairAuditFiNavBar() {
  const brand = (
    <span className="flex items-center gap-2">
      <Image
        src="/hair-audit-logo-white.png"
        alt="HairAudit"
        width={200}
        height={44}
        className="h-8 w-auto object-contain sm:h-9"
        priority
      />
    </span>
  );

  const cta = (
    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
      <LanguageSwitcher variant="default" />
      <Link
        href="/login"
        className="hidden rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground sm:inline-flex"
      >
        Sign in
      </Link>
      <TrackedLink
        href="/request-review"
        eventName="cta_request_review_fi_nav"
        className={fiHairauditPrimaryButtonClass("sm")}
      >
        Request review
      </TrackedLink>
    </div>
  );

  return (
    <PlatformNav
      currentPlatform="hairaudit"
      resolveProductHref={resolveProductHref}
      brand={brand}
      cta={cta}
      className="border-b border-white/10 bg-[rgb(6_12_28_/0.92)] backdrop-blur-md"
    />
  );
}
