import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";

const doctorNav = [
  { href: "/dashboard/doctor", label: "Overview" },
  { href: "/dashboard/doctor/upload", label: "Upload" },
  { href: "/dashboard/doctor/defaults", label: "Defaults" },
  { href: "/dashboard/doctor/reports", label: "Reports" },
  { href: "/dashboard/doctor/training", label: "Training" },
  { href: "/dashboard/doctor/public-profile", label: "Public Profile" },
];

export default async function DoctorDashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="px-4 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            {doctorNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-cyan-300 hover:text-cyan-700"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </section>
        {children}
      </div>
    </div>
  );
}
