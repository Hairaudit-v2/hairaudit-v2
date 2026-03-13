import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!isAuditor({ profileRole: profile?.role, userEmail: user.email })) {
    redirect("/login/auditor");
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/auditor"
              className="text-sm font-medium text-slate-400 hover:text-cyan-300 transition-colors"
            >
              ← Auditor
            </Link>
            <span className="text-slate-500">|</span>
            <Link
              href="/admin/contribution-requests"
              className="text-sm font-medium text-cyan-300"
            >
              Contribution Requests
            </Link>
            <Link
              href="/admin/auth-health"
              className="text-sm font-medium text-slate-300 hover:text-cyan-300 transition-colors"
            >
              Auth Health
            </Link>
          </div>
          <span className="text-xs text-slate-500">Admin</span>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
