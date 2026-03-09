import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";
import { fetchExtremeScoreQueueData } from "@/lib/admin/extremeScoreQueue";
import ExtremeScoreReviewClient from "./ExtremeScoreReviewClient";

export const dynamic = "force-dynamic";

export default async function ExtremeScoreReviewPage() {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!isAuditor({ profileRole: profile?.role, userEmail: user.email })) {
    redirect("/login/auditor");
  }

  const data = await fetchExtremeScoreQueueData(admin);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-4">
          <Link
            href="/admin/contribution-requests"
            className="text-sm text-slate-400 hover:text-cyan-300"
          >
            ← Admin
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-white">Extreme-Score Review Queue</h1>
        <p className="mt-1 text-sm text-slate-400">
          High-score validation (≥90, provisional) and low-score optional review (&lt;60).
        </p>
        <div className="mt-6">
          <ExtremeScoreReviewClient data={data} />
        </div>
      </div>
    </div>
  );
}
