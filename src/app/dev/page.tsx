import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { USER_ROLES, ROLE_LABELS } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function DevRoleSwitcherPage() {
  if (process.env.NODE_ENV !== "development") {
    redirect("/");
  }

  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 px-4">
      <div className="max-w-md w-full rounded-xl border border-amber-300 bg-amber-50 p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900 mb-1">Dev: Switch Role</h1>
        <p className="text-sm text-slate-600 mb-4">
          Logged in as {user.email}. Pick a role to view that dashboard.
        </p>
        <div className="space-y-2">
          {USER_ROLES.map((role) => (
            <Link
              key={role}
              href={`/api/dev/set-role?role=${role}`}
              className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-center font-medium text-slate-900 hover:border-amber-400 hover:bg-amber-50 transition-colors"
            >
              {ROLE_LABELS[role]}
            </Link>
          ))}
        </div>
        <Link
          href="/dashboard"
          className="mt-4 block text-center text-sm text-slate-500 hover:text-slate-700"
        >
          ← Back to dashboard
        </Link>
      </div>
    </div>
  );
}
