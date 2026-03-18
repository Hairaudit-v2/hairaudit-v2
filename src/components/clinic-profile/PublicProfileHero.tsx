import Link from "next/link";
import CertificationBadge from "./CertificationBadge";
import TransparencyStatusBadge from "./TransparencyStatusBadge";
import type { AwardTier } from "@/lib/transparency/awardRules";

type PublicProfileHeroProps = {
  clinicName: string;
  city?: string | null;
  country?: string | null;
  currentAwardTier: AwardTier | string | null;
  participationStatus: string | null | undefined;
};

export default function PublicProfileHero({
  clinicName,
  city,
  country,
  currentAwardTier,
  participationStatus,
}: PublicProfileHeroProps) {
  const location = [city, country].filter(Boolean).join(", ") || null;

  return (
    <header className="relative px-4 sm:px-6 py-16 sm:py-24">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <CertificationBadge tier={(currentAwardTier ?? "VERIFIED") as AwardTier} variant="full" />
          <TransparencyStatusBadge participationStatus={participationStatus} />
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
          {clinicName}
        </h1>
        {location && (
          <p className="mt-3 text-lg text-slate-400">{location}</p>
        )}
        <p className="mt-4 text-cyan-300/90 text-sm font-medium">
          Evidence-backed transparency profile
        </p>
        <p className="mt-6 text-slate-400 max-w-2xl leading-relaxed">
          This clinic participates in HairAudit&apos;s transparency and forensic review ecosystem.
          Recognition is based on documented case contribution, validated audit outcomes, and
          consistency — not marketing claims.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/verified-surgeon-program"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-slate-600 text-slate-200 text-sm font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
          >
            What this recognition means
          </Link>
          <Link
            href="/clinics"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-slate-600 text-slate-200 text-sm font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
          >
            Explore More Clinics
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-slate-400 text-sm font-medium hover:text-slate-200 transition-colors"
          >
            ← HairAudit
          </Link>
        </div>
      </div>
    </header>
  );
}
