import Link from "next/link";
import { redirect } from "next/navigation";
import PhotoUploader from "@/components/photos/PhotoUploader";
import SubmitButton from "../../submit-button";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { canAccessCase } from "@/lib/case-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function DoctorPhotosPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createSupabaseAdminClient();
  const { data: c } = await admin
    .from("cases")
    .select("id, status, submitted_at, user_id, doctor_id, clinic_id")
    .eq("id", caseId)
    .maybeSingle();

  const allowed = await canAccessCase(user.id, c);
  if (!c || !allowed) redirect("/dashboard");

  const { data: uploads } = await admin
    .from("uploads")
    .select("id, type, storage_path, metadata, created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  const doctorUploads = (uploads ?? []).filter((u) => String(u.type ?? "").startsWith("doctor_photo:"));

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <Link href={`/cases/${caseId}/doctor/form`} className="text-sm text-gray-600 hover:underline">← Back to Doctor Form</Link>
        <Link href={`/cases/${caseId}`} className="text-sm text-gray-600 hover:underline">Case overview</Link>
      </div>

      <PhotoUploader
        caseId={caseId}
        submitterType="doctor"
        initialUploads={doctorUploads}
        caseStatus={c.status ?? "draft"}
        submittedAt={c.submitted_at}
        backHref={`/cases/${caseId}/doctor/form`}
        hideFooter
      />

      <div className="mt-6 p-5 rounded-xl border border-slate-200 bg-white">
        <h2 className="font-semibold text-slate-900 mb-2">3. Submit for audit</h2>
        <SubmitButton caseId={c.id} caseStatus={c.status ?? "draft"} submittedAt={c.submitted_at} />
      </div>
    </div>
  );
}
