"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { recordPublicPathForAuth } from "@/lib/analytics/authAttribution";

/**
 * Tracks the last non-auth URL in sessionStorage so auth funnel events can attach prior_page.
 */
export default function AuthAttributionRecorder() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const search = searchParams.toString();
    const qs = search ? `?${search}` : "";
    recordPublicPathForAuth(pathname, qs);
  }, [pathname, searchParams]);

  return null;
}
