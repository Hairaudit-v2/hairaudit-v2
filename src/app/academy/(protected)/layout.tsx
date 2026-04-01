import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { isBetaAllowedUser } from "@/lib/auth/betaAccess";
import { getAcademyAccess } from "@/lib/academy/auth";
import AcademyHeader from "@/components/academy/AcademyHeader";

export const dynamic = "force-dynamic";

export default async function AcademyProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/academy/login");
  if (!(await isBetaAllowedUser(user))) redirect("/beta-access-message");

  const access = await getAcademyAccess();
  if (!access.ok) {
    if (access.reason === "no_membership") redirect("/academy/no-access");
    redirect("/academy/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <AcademyHeader isStaff={access.isStaff} role={access.role} isAcademyAdmin={access.role === "academy_admin"} />
      <main className="flex-1 py-6 sm:py-8">{children}</main>
    </div>
  );
}
