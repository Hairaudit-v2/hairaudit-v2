import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canAccessCase } from "@/lib/case-access";
import { resolveSurgeryUploadActor } from "@/lib/surgeryUpload/access";
import type { SurgeryUploadDetails } from "@/lib/surgeryUpload/fields";
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
      />
    </div>
  );
}
