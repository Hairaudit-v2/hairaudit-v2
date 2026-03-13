import Link from "next/link";
import { runAuthConfigHealthChecks } from "@/lib/admin/authConfigHealth";
import AdminAuthHealthTester from "@/components/admin/AdminAuthHealthTester";

function cardClasses(level: "pass" | "warn" | "fail") {
  if (level === "pass") return "border-emerald-300/30 bg-emerald-500/10";
  if (level === "fail") return "border-rose-300/30 bg-rose-500/10";
  return "border-amber-300/30 bg-amber-500/10";
}

function badgeClasses(level: "pass" | "warn" | "fail") {
  if (level === "pass") return "bg-emerald-300/20 text-emerald-100";
  if (level === "fail") return "bg-rose-300/20 text-rose-100";
  return "bg-amber-300/20 text-amber-100";
}

export default function AdminAuthHealthPage() {
  const health = runAuthConfigHealthChecks();
  const failCount = health.checks.filter((c) => c.level === "fail").length;
  const warnCount = health.checks.filter((c) => c.level === "warn").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Auth Email Health Check</h1>
          <p className="mt-1 text-sm text-slate-400">
            Validates runtime auth URL/env assumptions and highlights common causes of blank confirmation emails.
          </p>
        </div>
        <Link
          href="/admin/contribution-requests"
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-white/10"
        >
          Back to admin
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Fails</p>
          <p className="mt-1 text-2xl font-bold text-rose-200">{failCount}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Warnings</p>
          <p className="mt-1 text-2xl font-bold text-amber-200">{warnCount}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Base URL</p>
          <p className="mt-1 truncate text-sm font-semibold text-cyan-200">{health.baseUrl}</p>
        </div>
      </div>

      <div className="grid gap-3">
        {health.checks.map((check) => (
          <div key={check.id} className={`rounded-xl border p-4 ${cardClasses(check.level)}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">{check.label}</p>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${badgeClasses(check.level)}`}>
                {check.level}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-200">{check.value}</p>
            <p className="mt-1 text-xs text-slate-300">{check.detail}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-4">
        <p className="text-sm font-semibold text-cyan-100">Supabase dashboard checklist</p>
        <ul className="mt-2 space-y-1 text-xs text-cyan-50">
          {health.templateReminder.map((item) => (
            <li key={item}>- {item}</li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 text-xs text-cyan-100">
          <p>- {health.callbackUrl}</p>
          <p>- {health.magicLinkUrl}</p>
          <p>- {health.recoveryUrl}</p>
        </div>
      </div>

      <AdminAuthHealthTester />
    </div>
  );
}
