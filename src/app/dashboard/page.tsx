import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { getEffectiveUserRole } from "@/lib/auth/betaAccess";

export default async function DashboardPage() {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  const role = await getEffectiveUserRole(user);
  if (role === "auditor") redirect("/dashboard/auditor");
  if (role !== "patient") redirect("/beta-access-message");
  redirect("/dashboard/patient");
}
