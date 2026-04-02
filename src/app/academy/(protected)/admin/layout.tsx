import Link from "next/link";
import { redirect } from "next/navigation";
import { getAcademyAccess } from "@/lib/academy/auth";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/academy/admin", label: "Overview" },
  { href: "/academy/admin/programs", label: "Programs" },
  { href: "/academy/admin/people", label: "People" },
  { href: "/academy/admin/cohorts", label: "Cohorts" },
  { href: "/academy/admin/library", label: "Training library" },
  { href: "/academy/admin/routing", label: "Notifications" },
] as const;

export default async function AcademyAdminLayout({ children }: { children: React.ReactNode }) {
  const access = await getAcademyAccess();
  if (!access.ok) redirect("/academy/login");
  if (access.role !== "academy_admin") redirect("/academy/dashboard");

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-12">
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Academy admin console</p>
        <nav className="mt-2 flex flex-wrap gap-2 text-sm">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md bg-white px-2.5 py-1 font-medium text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/academy/sites"
            className="rounded-md bg-white px-2.5 py-1 font-medium text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Sites (existing)
          </Link>
          <Link
            href="/academy/ops/onboarding"
            className="rounded-md bg-white px-2.5 py-1 font-medium text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Academy roster
          </Link>
        </nav>
      </div>
      {children}
    </div>
  );
}
