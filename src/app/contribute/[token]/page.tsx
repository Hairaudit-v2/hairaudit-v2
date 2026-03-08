import ContributionPortalForm from "./ContributionPortalForm";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";
import { hashContributionToken } from "@/lib/transparency/contributionTokens";
import { markRequestViewed } from "@/lib/transparency/requestLifecycle";

export default async function ContributionPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createSupabaseAdminClient();
  const tokenHash = hashContributionToken(token);

  const { data: request } = await admin
    .from("case_contribution_requests")
    .select("id, case_id, status, secure_token_expires_at, clinic_name_snapshot, doctor_name_snapshot")
    .eq("secure_token_hash", tokenHash)
    .maybeSingle();

  if (!request) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
          <h1 className="text-lg font-semibold text-rose-900">Invalid contribution link</h1>
          <p className="mt-2 text-sm text-rose-800">This secure link is invalid or has already been replaced.</p>
        </div>
      </div>
    );
  }

  if (request.status === "clinic_request_sent") {
    await markRequestViewed(admin, request.id);
    await admin.from("cases").update({ status: "clinic_viewed_request" }).eq("id", request.case_id);
    await inngest.send({
      name: "contribution-request/opened",
      data: {
        requestId: request.id,
        caseId: request.case_id,
        currentStatus: "clinic_viewed_request",
        openedAt: new Date().toISOString(),
      },
    });
  } else {
    await admin
      .from("case_contribution_requests")
      .update({ last_opened_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", request.id);
  }

  return (
    <div className="px-4 py-8">
      <ContributionPortalForm
        token={token}
        caseId={request.case_id}
        clinicName={request.clinic_name_snapshot}
        doctorName={request.doctor_name_snapshot}
      />
    </div>
  );
}
