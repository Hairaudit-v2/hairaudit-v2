import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canAccessCase } from "@/lib/case-access";
import { resolveSurgeryUploadActor } from "@/lib/surgeryUpload/access";
import type { SurgeryUploadDetails } from "@/lib/surgeryUpload/fields";
import type { SurgerySlotReviewRow } from "@/lib/surgeryUpload/evidenceReview";
import { loadEvidenceEvents, type EvidenceTimelineEvent } from "@/lib/surgeryUpload/evidenceEvents";
import { loadPhotoExportHistory } from "@/lib/surgeryUpload/photoExportHistory";
import { loadAuditIntakeByCase } from "@/lib/surgeryUpload/auditIntakeQuery";
import type { AuditIntakeStatus } from "@/lib/surgeryUpload/auditIntake";
import SurgeryUploadFlowClient, { type SurgeryUploadRow } from "./SurgeryUploadFlowClient";

export const dynamic = "force-dynamic";

export default async function SurgeryUploadCasePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;

  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const actor = await resolveSurgeryUploadActor(user);
  if (!actor.allowed) redirect("/dashboard");

  const admin = createSupabaseAdminClient();

  const { data: c } = await admin
    .from("cases")
    .select("id, user_id, patient_id, doctor_id, clinic_id")
    .eq("id", caseId)
    .maybeSingle();

  if (!c || !(await canAccessCase(user.id, c))) {
    redirect("/dashboard/surgery-upload");
  }

  const { data: details } = await admin
    .from("surgery_upload_details")
    .select("*")
    .eq("case_id", caseId)
    .maybeSingle();

  if (!details) {
    redirect("/dashboard/surgery-upload");
  }

  const { data: uploads } = await admin
    .from("uploads")
    .select("id, type, storage_path, metadata, created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  // Stage 5: per-slot reviewer decisions (so the flow can show which slots need more).
  let slotReviews: SurgerySlotReviewRow[] = [];
  try {
    const { data: slotRows } = await admin
      .from("surgery_upload_slot_reviews")
      .select("case_id, slot_key, status, reviewer_notes, reviewed_by, reviewed_at")
      .eq("case_id", caseId);
    slotReviews = (slotRows as SurgerySlotReviewRow[] | null) ?? [];
  } catch {
    /* Stage 5 table may not exist yet in older environments */
  }

  // Stage 6A: read-only evidence-review history for clinic/doctor visibility.
  // Case access was already enforced above via canAccessCase.
  const evidenceEvents: EvidenceTimelineEvent[] = await loadEvidenceEvents(admin, caseId);
  const photoExportHistory = await loadPhotoExportHistory(admin, caseId);

  // Stage 6C: read-only audit intake status (bare status only on the mobile flow).
  const intake = await loadAuditIntakeByCase(admin, caseId);
  const auditIntakeStatus: AuditIntakeStatus | null = intake?.status ?? null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28">
      <div className="pt-2">
        <Link
          href="/dashboard/surgery-upload"
          className="text-sm text-slate-500 hover:text-slate-800"
        >
          ← All surgery uploads
        </Link>
      </div>
      <SurgeryUploadFlowClient
        caseId={caseId}
        userId={user.id}
        initialDetails={details as SurgeryUploadDetails}
        initialUploads={(uploads ?? []) as SurgeryUploadRow[]}
        initialSlotReviews={slotReviews}
        evidenceEvents={evidenceEvents}
        auditIntakeStatus={auditIntakeStatus}
        photoExportHistory={photoExportHistory}
      />
    </div>
  );
}
