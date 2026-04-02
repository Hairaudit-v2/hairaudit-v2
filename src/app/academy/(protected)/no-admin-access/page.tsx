import Link from "next/link";
import { redirect } from "next/navigation";
import { getAcademyAccess, isAcademyAdminRole } from "@/lib/academy/auth";

export const dynamic = "force-dynamic";

/**
 * Shown when a signed-in academy user opens /academy/admin (or sub-routes) without academy_admin role.
 * Deliberately distinct from the staff dashboard so trainers/trainees are not dropped on a page that looks like the admin console.
 */
export default async function AcademyNoAdminAccessPage() {
  const access = await getAcademyAccess();
  if (!access.ok) {
    if (access.reason === "no_membership") redirect("/academy/no-access");
    redirect("/academy/login");
  }
  if (isAcademyAdminRole(access.role)) redirect("/academy/admin");

  return (
    <main className="max-w-lg mx-auto px-4 py-12">
      <h1 className="text-xl font-semibold text-slate-900">Academy admin console</h1>
      <p className="mt-3 text-slate-600">
        This area is only for users with the <span className="font-medium">academy admin</span> role in{" "}
        <code className="text-sm bg-slate-100 px-1 rounded">academy_users</code>. Your current academy role is{" "}
        <span className="font-medium capitalize">{access.role.replace(/_/g, " ")}</span>.
      </p>
      <ul className="mt-6 space-y-2 text-sm text-slate-700">
        <li>
          <Link href="/academy/dashboard" className="font-medium text-amber-800 underline hover:no-underline">
            Open academy dashboard
          </Link>
        </li>
        <li>
          <Link href="/academy/training-modules" className="font-medium text-amber-800 underline hover:no-underline">
            Training library
          </Link>
        </li>
        {access.isStaff ? (
          <li>
            <Link href="/academy/trainees" className="font-medium text-amber-800 underline hover:no-underline">
              Trainees
            </Link>
          </li>
        ) : null}
      </ul>
    </main>
  );
}
