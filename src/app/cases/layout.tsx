import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import DashboardHeader from "@/components/DashboardHeader";
import { isBetaAllowedUser } from "@/lib/auth/betaAccess";

export default async function CasesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!(await isBetaAllowedUser(user))) redirect("/beta-access-message");

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <DashboardHeader />
      <main className="flex-1 py-6 sm:py-8">{children}</main>
    </div>
  );
}
