"use client";

import Link from "next/link";
import type { AwardTier } from "@/lib/transparency/awardRules";

const TIER_LABELS: Record<string, string> = {
  VERIFIED: "Verified",
  SILVER: "Silver",
  GOLD: "Gold",
  PLATINUM: "Platinum",
};

const STATUS_LABELS: Record<string, string> = {
  high_transparency: "High transparency",
  active: "Active participant",
  invited: "Invited",
  not_started: "Not started",
};

type BadgeWidgetProps = {
  clinicName: string;
  clinicSlug: string;
  currentAwardTier: string | null;
  participationStatus: string | null;
  variant: "compact" | "full";
  style?: "dark" | "light";
  /** If true, wrap in link to profile; if false, render static (e.g. iframe). */
  linkToProfile?: boolean;
  /** Base URL for profile link (e.g. https://www.hairaudit.com). Omit when linkToProfile is false and same-origin. */
  baseUrl?: string;
};

function tierAccentClass(tier: string, isLight: boolean): string {
  const t = (tier ?? "VERIFIED").toUpperCase();
  if (isLight) {
    return t === "PLATINUM"
      ? "border-amber-400 text-amber-800 bg-amber-50"
      : t === "GOLD"
        ? "border-amber-500/60 text-amber-900 bg-amber-50/80"
        : t === "SILVER"
          ? "border-slate-400 text-slate-700 bg-slate-100"
          : "border-cyan-500/60 text-cyan-800 bg-cyan-50/80";
  }
  return t === "PLATINUM"
    ? "border-amber-500/40 text-amber-300 bg-amber-500/20"
    : t === "GOLD"
      ? "border-amber-500/30 text-amber-200 bg-amber-500/15"
      : t === "SILVER"
        ? "border-slate-500/30 text-slate-200 bg-slate-500/20"
        : "border-cyan-500/30 text-cyan-200 bg-cyan-500/15";
}

export default function BadgeWidget({
  clinicName,
  clinicSlug,
  currentAwardTier,
  participationStatus,
  variant,
  style = "dark",
  linkToProfile = true,
  baseUrl = "",
}: BadgeWidgetProps) {
  const isLight = style === "light";
  const tier = (currentAwardTier ?? "VERIFIED") as AwardTier;
  const tierLabel = TIER_LABELS[tier] ?? tier;
  const statusLabel = STATUS_LABELS[String(participationStatus ?? "not_started")] ?? "Participant";
  const isActive =
    participationStatus === "high_transparency" || participationStatus === "active";

  const profileHref = baseUrl ? `${baseUrl.replace(/\/+$/, "")}/clinics/${clinicSlug}` : `/clinics/${clinicSlug}`;

  const wrapperClass = isLight
    ? "bg-white border-slate-200 text-slate-900"
    : "bg-[#0a0a0f] border-white/10 text-slate-100";

  const content = (
    <>
      {variant === "compact" ? (
        <div
          className={`inline-flex flex-wrap items-center gap-2 rounded-xl border px-4 py-2.5 ${wrapperClass}`}
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            HairAudit
          </span>
          <span className="h-3 w-px bg-current opacity-30" aria-hidden />
          <span
            className={`rounded-lg border px-2.5 py-0.5 text-xs font-bold ${tierAccentClass(tier, isLight)}`}
          >
            {tierLabel}
          </span>
          <span className="text-xs text-slate-500">
            {isLight ? "Verified profile" : "Verified on HairAudit"}
          </span>
        </div>
      ) : (
        <div
          className={`inline-flex flex-col gap-3 rounded-2xl border p-5 shadow-sm min-w-[240px] ${wrapperClass}`}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              HairAudit
            </span>
            <span
              className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${tierAccentClass(tier, isLight)}`}
            >
              {tierLabel}
            </span>
          </div>
          <p className="font-semibold text-sm leading-tight">{clinicName}</p>
          {isActive && (
            <span
              className={`text-xs font-medium ${
                isLight ? "text-cyan-700 bg-cyan-50 border-cyan-200" : "text-cyan-300 bg-cyan-500/15 border-cyan-500/25"
              } rounded-lg border px-2.5 py-1 w-fit`}
            >
              {statusLabel}
            </span>
          )}
          <p className="text-xs text-slate-500">
            Verified on HairAudit · Evidence-backed transparency profile
          </p>
          <span className="text-xs font-medium text-cyan-600">
            View profile →
          </span>
        </div>
      )}
    </>
  );

  if (linkToProfile) {
    return (
      <Link href={profileHref} className="inline-block hover:opacity-90 transition-opacity">
        {content}
      </Link>
    );
  }
  return content;
}
