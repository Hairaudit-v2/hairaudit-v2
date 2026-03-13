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
    subtitle: "Your trust posture, completion trajectory, and clinic intelligence activity.",
    primaryAction: { href: "/dashboard/clinic/submit-case", label: "Submit Case" },
    secondaryAction: { href: "/leaderboards/clinics", label: "View Benchmarking" },
  },
  "/dashboard/clinic/onboarding": {
    title: "Onboarding",
    subtitle: "Complete portal setup for public audits, internal QA, and future modules.",
    primaryAction: { href: "/dashboard/clinic/profile", label: "Open Profile Builder" },
  },
  "/dashboard/clinic/profile": {
    title: "Clinic Profile",
    subtitle: "Maintain your premium clinic profile, methods, devices, and protocol stack.",
    primaryAction: { href: "/dashboard/clinic/workspaces", label: "Go to Workspaces" },
    secondaryAction: { href: "/dashboard/clinic/profile#clinical-stack", label: "Methods & Devices" },
  },
  "/dashboard/clinic/workspaces": {
    title: "Workspaces",
    subtitle: "Respond to patient submissions and control internal/public visibility.",
    primaryAction: { href: "/dashboard/clinic/submit-case", label: "Create New Case" },
  },
  "/dashboard/clinic/submit-case": {
    title: "Submit Case",
    subtitle: "Launch clinic-submitted audit workflows with high-quality evidence trails.",
    primaryAction: { href: "/dashboard/clinic/workspaces", label: "Manage Workspaces" },
  },
  "/dashboard/clinic/clinic-cases": {
    title: "Clinic Cases",
    subtitle: "Dedicated clinic case management space.",
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
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">Clinic Intelligence Portal</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{meta.title}</h1>
          <p className="mt-1 text-sm text-slate-600">{meta.subtitle}</p>
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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
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
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
            Pending responses: {pendingResponses}
          </span>
          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
            Operational
          </span>
        </div>
      </div>
    </div>
  );
}
