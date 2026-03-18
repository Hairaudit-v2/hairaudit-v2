"use client";

import { useState } from "react";

type Props = {
  /** When set, copies the case page URL to clipboard. When unset, shows "Coming soon". */
  caseId?: string | null;
  /** Compact styling for dashboard/card contexts. */
  variant?: "default" | "compact";
};

export default function ReportShareButton({ caseId, variant = "default" }: Props) {
  const [copied, setCopied] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);

  async function handleClick() {
    if (caseId && typeof window !== "undefined") {
      try {
        const url = `${window.location.origin}/cases/${caseId}`;
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setShowComingSoon(true);
        setTimeout(() => setShowComingSoon(false), 2000);
      }
      return;
    }
    setShowComingSoon(true);
    setTimeout(() => setShowComingSoon(false), 2000);
  }

  const label = copied ? "Link copied" : showComingSoon ? "Coming soon" : "Share report";
  const baseClass =
    variant === "compact"
      ? "rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-slate-100 hover:bg-white/15"
      : "rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-white/15";

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`${baseClass} transition-colors disabled:opacity-70`}
      aria-label={label}
    >
      {label}
    </button>
  );
}
