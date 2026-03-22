import Link from "next/link";
import { redirect } from "next/navigation";
import UnifiedPatientUploader from "@/components/patient/UnifiedPatientUploader";
import { loadPatientPhotoStageGuidanceForCase } from "@/lib/patientPhoto/loadPatientPhotoStageGuidanceForCase";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";

export const metadata = {
  title: "Patient Photos | HairAudit",
};

export default async function Page({
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

  const { data: c } = await supabase
    .from("cases")
    .select("id, user_id, status, submitted_at")
    .eq("id", caseId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!c) redirect("/dashboard");

  const { data: uploads } = await supabase
    .from("uploads")
    .select("id, type, storage_path, metadata, created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  const patientUploads = (uploads ?? []).filter((u) =>
    String(u.type ?? "").startsWith("patient_photo:")
  );

  const patientPhotoStageGuidance = await loadPatientPhotoStageGuidanceForCase(supabase, caseId);

  return (
    <main className="min-h-screen bg-white py-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-4 px-4">
          <Link
            href={`/cases/${caseId}`}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            ← Back to case
          </Link>
        </div>

        <UnifiedPatientUploader
          caseId={caseId}
          initialUploads={patientUploads}
          caseStatus={c.status ?? "draft"}
          submittedAt={c.submitted_at}
          patientPhotoStageGuidance={patientPhotoStageGuidance}
          backHref={`/cases/${caseId}`}
          nextHref={`/cases/${caseId}`}
          uploadApiUrl="/api/uploads/patient-photos"
        />
      </div>
    </main>
  );
}
