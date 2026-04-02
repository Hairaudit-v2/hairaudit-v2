import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AcademyAdminOverviewPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Academy admin hub</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Start here for setup and day-two operations: sites and programs, people and cohorts, training library, notifications, and
          trainee roster hygiene (withdrawn/archived profiles and duplicate checks).
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Structure</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          <li>
            <Link
              href="/academy/sites"
              className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-amber-300 hover:ring-1 hover:ring-amber-200"
            >
              <span className="font-semibold text-slate-900">Create / manage site</span>
              <p className="mt-1 text-sm text-slate-600">Locations, ops inbox emails, contact details.</p>
            </Link>
          </li>
          <li>
            <Link
              href="/academy/admin/programs"
              className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-amber-300 hover:ring-1 hover:ring-amber-200"
            >
              <span className="font-semibold text-slate-900">Create program</span>
              <p className="mt-1 text-sm text-slate-600">Programs, site links, activate or retire.</p>
            </Link>
          </li>
          <li>
            <Link
              href="/academy/admin/cohorts"
              className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-amber-300 hover:ring-1 hover:ring-amber-200"
            >
              <span className="font-semibold text-slate-900">Create cohort</span>
              <p className="mt-1 text-sm text-slate-600">Intakes: site, program, trainers, trainees together.</p>
            </Link>
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">People</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          <li>
            <Link
              href="/academy/admin/people"
              className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-amber-300 hover:ring-1 hover:ring-amber-200"
            >
              <span className="font-semibold text-slate-900">Invite trainer, trainee, or coordinator</span>
              <p className="mt-1 text-sm text-slate-600">
                Email invites and role updates. Clinic coordinators / nurses use the <code className="text-xs">clinic_staff</code>{" "}
                academy role.
              </p>
            </Link>
          </li>
          <li>
            <Link
              href="/academy/trainees/new"
              className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-amber-300 hover:ring-1 hover:ring-amber-200"
            >
              <span className="font-semibold text-slate-900">New trainee profile</span>
              <p className="mt-1 text-sm text-slate-600">Create a training doctor row before or after login is linked.</p>
            </Link>
          </li>
          <li>
            <Link
              href="/academy/admin/trainees"
              className="block rounded-xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm hover:border-amber-400 hover:ring-1 hover:ring-amber-300"
            >
              <span className="font-semibold text-amber-950">Trainee roster & cleanup</span>
              <p className="mt-1 text-sm text-amber-900/90">
                View archived / withdrawn, spot duplicate emails or logins, open edits for corrections.
              </p>
            </Link>
          </li>
          <li>
            <Link
              href="/academy/ops/onboarding"
              className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-amber-300 hover:ring-1 hover:ring-amber-200"
            >
              <span className="font-semibold text-slate-900">Academy roster (IIOHR)</span>
              <p className="mt-1 text-sm text-slate-600">Email the training academy for official roster, then bulk invite.</p>
            </Link>
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Content & routing</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          <li>
            <Link
              href="/academy/admin/library"
              className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-amber-300 hover:ring-1 hover:ring-amber-200"
            >
              <span className="font-semibold text-slate-900">Training library admin</span>
              <p className="mt-1 text-sm text-slate-600">Publish modules, weeks, assignments to people or cohorts.</p>
            </Link>
          </li>
          <li>
            <Link
              href="/academy/admin/routing"
              className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-amber-300 hover:ring-1 hover:ring-amber-200"
            >
              <span className="font-semibold text-slate-900">Notifications & routing</span>
              <p className="mt-1 text-sm text-slate-600">How roster emails pick an inbox (site vs environment).</p>
            </Link>
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Staff tools</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          <li>
            <Link
              href="/academy/trainees"
              className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-amber-300 hover:ring-1 hover:ring-amber-200"
            >
              <span className="font-semibold text-slate-900">Trainees & cases (default roster)</span>
              <p className="mt-1 text-sm text-slate-600">Day-to-day list; filter to withdrawn or archived when needed.</p>
            </Link>
          </li>
          <li>
            <Link
              href="/academy/dashboard"
              className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-amber-300 hover:ring-1 hover:ring-amber-200"
            >
              <span className="font-semibold text-slate-900">Academy dashboard</span>
              <p className="mt-1 text-sm text-slate-600">Summary counts and review workload.</p>
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
