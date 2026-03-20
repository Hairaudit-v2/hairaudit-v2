import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import DoctorDashboardSubnav from "./DoctorDashboardSubnav";

export default async function DoctorDashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="px-4 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <DoctorDashboardSubnav />
        {children}
      </div>
    </div>
  );
}
