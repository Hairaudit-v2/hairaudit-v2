import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";

export const dynamic = "force-dynamic";

export default async function AcademyNoAccessPage() {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/academy/login");

  return (
    <main className="max-w-lg mx-auto px-4 py-16">
      <h1 className="text-xl font-semibold text-slate-900">Academy access</h1>
      <p className="mt-3 text-slate-600">
        Your account is signed in, but you are not enrolled in the IIOHR Academy workspace yet. Ask an academy admin to add
        your user to <code className="text-sm bg-slate-100 px-1 rounded">academy_users</code>.
      </p>
      <p className="mt-6 text-sm text-slate-500">
        <Link href="/dashboard" className="text-amber-700 font-medium underline">
          Back to HairAudit dashboard
        </Link>
      </p>
    </main>
  );
}
