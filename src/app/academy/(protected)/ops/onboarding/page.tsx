import Link from "next/link";
import { redirect } from "next/navigation";
import { getAcademyAccess } from "@/lib/academy/auth";
import { academyOpsInboxAddress } from "@/lib/academy/onboardingTemplate";
import OnboardingClient from "./OnboardingClient";

export const dynamic = "force-dynamic";

export default async function AcademyOnboardingPage() {
  const access = await getAcademyAccess();
  if (!access.ok) redirect("/academy/login");
  if (access.role !== "academy_admin") redirect("/academy/dashboard");

  const trainingAcademyInbox = academyOpsInboxAddress();
  const opsInboxConfigured = Boolean(trainingAcademyInbox);
  const defaultRequesterEmail = access.user.email?.trim() ?? "";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-6">
      <div>
        <Link href="/academy/dashboard" className="text-sm font-medium text-amber-700 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Academy team access</h1>
        <p className="mt-1 text-sm text-slate-600">
          As a HairAudit academy admin: email the training academy (IIOHR / Evolved) to collect their official roster,
          then create Supabase logins for each person they confirm.
        </p>
      </div>

      <OnboardingClient
        opsInboxConfigured={opsInboxConfigured}
        trainingAcademyInbox={trainingAcademyInbox}
        defaultHairauditAdminEmail={defaultRequesterEmail}
      />
    </div>
  );
}
