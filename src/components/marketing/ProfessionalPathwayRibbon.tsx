import Link from "next/link";

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
  const shell =
    variant === "slate"
      ? "border-cyan-400/25 bg-cyan-500/10"
      : "border-white/10 bg-white/[0.04] backdrop-blur-sm";

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-4 sm:px-6 sm:py-5",
        shell,
        className
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/90">
        Professional & clinic pathway
      </p>
      <p className="mt-2 text-sm text-slate-200 leading-relaxed">
        This area is for clinics, doctors, and teams building verified profiles, internal audits, and transparency
        records. It is separate from the patient free audit, which starts on{" "}
        <Link href="/request-review" className="font-medium text-amber-300 hover:text-amber-200">
          Start Free Audit
        </Link>
        .
      </p>
      <p className="mt-2 text-xs text-slate-400 leading-relaxed">
        Verification and public case display follow HairAudit contribution rules — earned through documented participation,
        not purchased placements.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/for-clinics"
          className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
        >
          For Clinics
        </Link>
        <Link
          href="/professionals"
          className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
        >
          For Professionals
        </Link>
        <Link
          href="/signup?role=clinic"
          className="inline-flex items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-400/15 transition-colors"
        >
          Create clinic account
        </Link>
        <Link
          href="/signup?role=doctor"
          className="inline-flex items-center justify-center rounded-xl border border-violet-400/25 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 hover:bg-violet-500/15 transition-colors"
        >
          Create doctor account
        </Link>
      </div>
    </div>
  );
}
