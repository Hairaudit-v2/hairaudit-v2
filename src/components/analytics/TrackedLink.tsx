"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { trackCta } from "@/lib/analytics/trackCta";
import { stashPendingAuthCtaContext } from "@/lib/analytics/authAttribution";

type TrackedLinkProps = {
  href: string;
  eventName?: string;
  className?: string;
  children: ReactNode;
  prefetch?: boolean;
  "data-testid"?: string;
};

export default function TrackedLink({
  href,
  eventName,
  className,
  children,
  prefetch,
  "data-testid": dataTestId,
}: TrackedLinkProps) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={className}
      data-testid={dataTestId}
      onClick={() => {
        if (eventName) {
          trackCta(eventName, { href });
          stashPendingAuthCtaContext(eventName, href);
        }
      }}
    >
      {children}
    </Link>
  );
}
