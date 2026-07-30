import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import DashboardHeader from "@/components/DashboardHeader";
import { buildPatientLoginHref } from "@/lib/auth/patientLogin";
import { isBetaAllowedUser } from "@/lib/auth/betaAccess";
import { isAnonymousAuthUser } from "@/lib/patient/intakeCaseOwnership";

/**
 * Case-scoped auth gate — preserves `/cases/:id` as the post-login `next`
 * path. Parent `cases/layout.tsx` intentionally skips auth when the request
 * is case-scoped so a missing middleware `x-pathname` cannot rewrite `next`
 * to `/dashboard/patient`.
 */
export default async function CaseIdLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildPatientLoginHref(`/cases/${caseId}`));
  }
  if (!(await isBetaAllowedUser(user))) {
    redirect("/beta-access-message");
  }

  const isAnonymousSession = isAnonymousAuthUser(user);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <DashboardHeader isAnonymousSession={isAnonymousSession} />
      <main className="flex-1 py-6 sm:py-8">{children}</main>
    </div>
  );
}
