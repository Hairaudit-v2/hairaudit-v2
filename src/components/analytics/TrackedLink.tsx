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
};

export default function TrackedLink({
  href,
  eventName,
  className,
  children,
  prefetch,
}: TrackedLinkProps) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={className}
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
