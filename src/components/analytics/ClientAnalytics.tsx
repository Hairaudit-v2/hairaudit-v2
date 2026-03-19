"use client";

import dynamic from "next/dynamic";

/**
 * Vercel Analytics and Speed Insights loaded only on the client after mount.
 * Does not run during SSR and does not block LCP or initial render.
 */
const Analytics = dynamic(
  () => import("@vercel/analytics/next").then((m) => m.Analytics),
  { ssr: false }
);

const SpeedInsights = dynamic(
  () => import("@vercel/speed-insights/next").then((m) => m.SpeedInsights),
  { ssr: false }
);

export default function ClientAnalytics() {
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
