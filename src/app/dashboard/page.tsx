import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseRole } from "@/lib/roles";

export default async function DashboardPage() {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let role = parseRole((user.user_metadata as Record<string, unknown>)?.role);
  try {
    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role) role = parseRole(profile.role);
  } catch {
    // profiles table may not exist
  }

  if (role === "doctor") redirect("/dashboard/doctor");
  if (role === "clinic") redirect("/dashboard/clinic");
  if (role === "auditor") redirect("/dashboard/auditor");
  redirect("/dashboard/patient");
}
