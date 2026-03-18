"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PAGE_META: Record<
  string,
  {
    title: string;
    subtitle: string;
    primaryAction?: { href: string; label: string };
    secondaryAction?: { href: string; label: string };
  }
> = {
  "/dashboard/clinic": {
    title: "Overview",
    subtitle: "Track trust posture, completion momentum, and commercial readiness signals.",
    primaryAction: { href: "/dashboard/clinic/submit-case", label: "Submit Case" },
    secondaryAction: { href: "/leaderboards/clinics", label: "View Benchmarking" },
  },
  "/dashboard/clinic/onboarding": {
    title: "Onboarding",
    subtitle: "Complete identity and operating setup to unlock higher-trust workflows.",
    primaryAction: { href: "/dashboard/clinic/profile", label: "Open Profile Builder" },
  },
  "/dashboard/clinic/profile": {
    title: "Clinic Profile",
    subtitle: "Build a premium profile that improves discoverability and verified credibility.",
    primaryAction: { href: "/dashboard/clinic/workspaces", label: "Go to Invited Contributions" },
    secondaryAction: { href: "/dashboard/clinic/profile#clinical-stack", label: "Methods & Devices" },
  },
  "/dashboard/clinic/public-preview": {
    title: "Public Preview",
    subtitle: "Preview your future public clinic presentation and close trust gaps before publishing.",
    primaryAction: { href: "/dashboard/clinic/profile", label: "Improve Profile" },
    secondaryAction: { href: "/dashboard/clinic/doctors", label: "Update Doctors" },
  },
  "/dashboard/clinic/workspaces": {
    title: "Invited Contributions",
    subtitle: "Cases you were invited to contribute to. Set visibility and respond.",
    primaryAction: { href: "/dashboard/clinic/submit-case", label: "Create New Case" },
  },
  "/dashboard/clinic/submit-case": {
    title: "Submit Case",
    subtitle: "Create Submitted Cases (clinic-owned) for quality control and trust growth.",
    primaryAction: { href: "/dashboard/clinic/workspaces", label: "Invited Contributions" },
  },
  "/dashboard/clinic/clinic-cases": {
    title: "All Clinic Cases",
    subtitle: "Invited Contributions and Submitted Cases in one view.",
  },
  "/dashboard/clinic/doctors": {
    title: "Doctors",
    subtitle: "Doctor roster, profiles, and performance modules.",
  },
  "/dashboard/clinic/benchmarking": {
    title: "Benchmarking",
    subtitle: "Cross-clinic and doctor-level benchmarking intelligence.",
  },
  "/dashboard/clinic/training": {
    title: "Training",
    subtitle: "Internal quality training and protocol reinforcement tools.",
  },
  "/dashboard/clinic/settings": {
    title: "Settings",
    subtitle: "Portal controls, visibility defaults, and operational preferences.",
  },
};

export default function ClinicTopbar({
  clinicName,
  trustStatus,
  avatarLabel,
  pendingResponses,
}: {
  clinicName: string;
  trustStatus: string;
  avatarLabel: string;
  pendingResponses: number;
}) {
  const pathname = usePathname();
  const meta = PAGE_META[pathname] ?? PAGE_META["/dashboard/clinic"];

  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700">Clinic Intelligence Portal</p>
          <h1 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">{meta.title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">{meta.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {meta.secondaryAction ? (
            <Link
              href={meta.secondaryAction.href}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {meta.secondaryAction.label}
            </Link>
          ) : null}
          {meta.primaryAction ? (
            <Link
              href={meta.primaryAction.href}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {meta.primaryAction.label}
            </Link>
          ) : null}
        </div>
      </div>

      <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-600">
          Show clinic status details
        </summary>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 text-sm font-bold text-white">
              {avatarLabel}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{clinicName}</p>
              <p className="text-xs text-slate-500">{trustStatus}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600">
              Pending responses: {pendingResponses}
            </span>
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
              Operational
            </span>
          </div>
        </div>
      </details>
    </div>
  );
}
