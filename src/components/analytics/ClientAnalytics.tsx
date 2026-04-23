"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const ric = win.requestIdleCallback;
    if (typeof ric === "function") {
      const id = ric(() => setReady(true), { timeout: 4000 });
      return () => {
        win.cancelIdleCallback?.(id);
      };
    }
    const t = window.setTimeout(() => setReady(true), 1);
    return () => window.clearTimeout(t);
  }, []);

  if (!ready) return null;

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
