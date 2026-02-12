import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseRole, USER_ROLES } from "@/lib/roles";

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

  // In development, allow dev_role cookie to override (for testing all dashboards with one account)
  if (process.env.NODE_ENV === "development") {
    const cookieStore = await cookies();
    const devRole = cookieStore.get("dev_role")?.value;
    if (devRole && USER_ROLES.includes(devRole as any)) {
      role = devRole as typeof role;
    }
  }

  if (role === "doctor") redirect("/dashboard/doctor");
  if (role === "clinic") redirect("/dashboard/clinic");
  if (role === "auditor") redirect("/dashboard/auditor");
  redirect("/dashboard/patient");
}
