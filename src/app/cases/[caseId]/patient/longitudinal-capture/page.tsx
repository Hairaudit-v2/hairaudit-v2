import { redirect } from "next/navigation";

/**
 * Deep-link alias for 1D reminders:
 * /cases/[caseId]/patient/longitudinal-capture?stage=month_6
 * → /cases/[caseId]/patient/follow-up/[stage]
 */
type PageProps = {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ stage?: string }>;
};

export default async function LongitudinalCaptureDeepLinkPage({
  params,
  searchParams,
}: PageProps) {
  const { caseId } = await params;
  const sp = await searchParams;
  const stage = String(sp.stage ?? "").trim();
  if (stage) {
    redirect(`/cases/${caseId}/patient/follow-up/${stage}`);
  }
  redirect(`/cases/${caseId}/patient/follow-up`);
}
