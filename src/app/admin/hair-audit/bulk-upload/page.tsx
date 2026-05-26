import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { isAuditor } from "@/lib/auth/isAuditor";
import BulkUploadListClient from "@/components/admin/hair-audit/bulk-upload/BulkUploadListClient";
import type { HairAuditCaseBatchRow } from "@/lib/hair-audit/bulkUpload/types";

export const dynamic = "force-dynamic";

export default async function BulkUploadListPage() {
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

  const { data: batches } = await admin
    .from("hair_audit_case_batches")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(100);

  return <BulkUploadListClient initialBatches={(batches ?? []) as HairAuditCaseBatchRow[]} />;
}
