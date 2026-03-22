import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import UnifiedPatientUploader from "@/components/patient/UnifiedPatientUploader";

export const metadata = {
  title: "Patient Photo Upload | HairAudit",
};

export default async function PatientPhotoAuditPage({
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

  const admin = createSupabaseAdminClient();

  // Load case and uploads
  const [{ data: c }, { data: uploads }] = await Promise.all([
    admin
      .from("cases")
      .select("id, status, submitted_at, user_id, patient_id")
      .eq("id", caseId)
      .maybeSingle(),
    admin
      .from("uploads")
      .select("id, type, storage_path, metadata, created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false }),
  ]);

  if (!c) redirect("/dashboard/patient");

  // Authorization check
  const canAccess = c.user_id === user.id || c.patient_id === user.id;
  if (!canAccess) redirect("/dashboard/patient");

  const patientUploads = (uploads ?? []).filter((u) =>
    String(u.type ?? "").startsWith("patient_photo:")
  );

  return (
    <main className="min-h-screen bg-white py-8">
      <UnifiedPatientUploader
        caseId={caseId}
        initialUploads={patientUploads}
        caseStatus={c.status ?? "draft"}
        submittedAt={c.submitted_at}
        backHref={`/cases/${caseId}`}
        nextHref={`/cases/${caseId}`}
        uploadApiUrl="/api/uploads/patient-photos"
      />
    </main>
  );
}
