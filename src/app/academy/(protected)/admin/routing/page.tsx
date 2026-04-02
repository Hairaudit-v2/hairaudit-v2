import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AdminRoutingPage() {
  return (
    <div className="max-w-2xl space-y-6 text-sm text-slate-700">
      <h1 className="text-2xl font-semibold text-slate-900">Notifications & routing</h1>
      <p>
        Roster request emails (from{" "}
        <Link href="/academy/ops/onboarding" className="text-amber-800 font-medium hover:underline">
          Academy roster
        </Link>
        ) pick the recipient inbox in this order:
      </p>
      <ol className="list-decimal list-inside space-y-2">
        <li>
          <strong>By trainee</strong> — optional <code className="text-xs bg-slate-100 px-1 rounded">training_doctors.academy_site_id</code>
          , else the trainee&apos;s program&apos;s linked site, then global env.
        </li>
        <li>
          <strong>By program</strong> — <code className="text-xs bg-slate-100 px-1 rounded">training_programs.academy_site_id</code> →
          that site&apos;s <strong>Ops notification email</strong>.
        </li>
        <li>
          <strong>By site</strong> — the site&apos;s <strong>Ops notification email</strong>.
        </li>
        <li>
          <strong>Env only</strong> — server variable <code className="text-xs bg-slate-100 px-1 rounded">ACADEMY_OPS_NOTIFICATION_EMAIL</code>.
        </li>
      </ol>
      <p>
        Configure per-site inboxes under{" "}
        <Link href="/academy/sites" className="text-amber-800 font-medium hover:underline">
          Sites
        </Link>{" "}
        (field: <strong>Ops notification email (roster requests)</strong>). Link programs to sites under{" "}
        <Link href="/academy/admin/programs" className="text-amber-800 font-medium hover:underline">
          Programs
        </Link>
        .
      </p>
      <p className="text-xs text-slate-500">
        Optional: <code className="bg-slate-100 px-1 rounded">ACADEMY_ONBOARDING_CC_REQUESTER</code> CCs the HairAudit sender on outbound
        roster requests when enabled.
      </p>
    </div>
  );
}
