import { redirect, notFound } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { isAuditor } from "@/lib/auth/isAuditor";
import BulkUploadWizardClient from "@/components/admin/hair-audit/bulk-upload/BulkUploadWizardClient";
import type { BulkCaseImageRow, BulkCaseRow, HairAuditCaseBatchRow } from "@/lib/hair-audit/bulkUpload/types";

export const dynamic = "force-dynamic";

export default async function BulkUploadBatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;

  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!isAuditor({ profileRole: profile?.role, userEmail: user.email })) {
    redirect("/login/auditor");
  }

  const [batchRes, casesRes, imagesRes] = await Promise.all([
    admin.from("hair_audit_case_batches").select("*").eq("id", batchId).maybeSingle(),
    admin
      .from("cases")
      .select(
        "id, batch_id, case_label, patient_reference, patient_email, graft_count, hair_count, case_specific_notes, intake_status, status, title, audit_type, doctor_id, clinic_id, created_at"
      )
      .eq("batch_id", batchId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    admin
      .from("hair_audit_case_images")
      .select("*")
      .eq("batch_id", batchId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (!batchRes.data) notFound();

  return (
    <BulkUploadWizardClient
      batch={batchRes.data as HairAuditCaseBatchRow}
      initialCases={(casesRes.data ?? []) as BulkCaseRow[]}
      initialImages={(imagesRes.data ?? []) as BulkCaseImageRow[]}
    />
  );
}
