import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AcademyAdminOverviewPage() {
  const cards = [
    {
      title: "Sites",
      desc: "Locations, ops inbox emails, and contact details.",
      href: "/academy/sites",
    },
    {
      title: "Programs",
      desc: "Create programs, link them to sites, activate or retire.",
      href: "/academy/admin/programs",
    },
    {
      title: "People",
      desc: "Invite users, roles, trainee links, clinic coordinators.",
      href: "/academy/admin/people",
    },
    {
      title: "Cohorts",
      desc: "Intakes: site, program, trainers, and trainees together.",
      href: "/academy/admin/cohorts",
    },
    {
      title: "Training library",
      desc: "Publish modules, weeks, assignments to people or cohorts.",
      href: "/academy/admin/library",
    },
    {
      title: "Academy roster",
      desc: "Email IIOHR for official roster, then bulk invite.",
      href: "/academy/ops/onboarding",
    },
    {
      title: "Notifications & routing",
      desc: "How roster emails pick an inbox (site vs env).",
      href: "/academy/admin/routing",
    },
    {
      title: "Trainees & cases",
      desc: "Day-to-day trainee list and training cases (staff tools).",
      href: "/academy/trainees",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Academy setup</h1>
        <p className="mt-1 text-sm text-slate-600">
          Run academy onboarding from here: programs, people, cohorts, and published training modules. Existing flows (Sites,
          Roster, Trainees) stay in place.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <li key={c.href}>
            <Link
              href={c.href}
              className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-amber-300 hover:ring-1 hover:ring-amber-200"
            >
              <span className="font-semibold text-slate-900">{c.title}</span>
              <p className="mt-1 text-sm text-slate-600">{c.desc}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
