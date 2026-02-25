import Link from "next/link";
import { redirect } from "next/navigation";
import PhotoUploader from "@/components/photos/PhotoUploader";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";

type PageProps = { params: Promise<{ caseId: string }> };

export default async function Page({ params }: PageProps) {
  const { caseId } = await params;

  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: c } = await supabase
    .from("cases")
    .select("id, status, submitted_at")
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-4">
        <Link
          href={`/cases/${caseId}/patient/questions`}
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          ← Back to questions
        </Link>
      </div>

      <PhotoUploader
        caseId={caseId}
        submitterType="patient"
        initialUploads={patientUploads}
        caseStatus={c.status ?? "draft"}
        submittedAt={c.submitted_at}
        backHref={`/cases/${caseId}/patient/questions`}
        nextHref={`/cases/${caseId}`}
        nextLabel="3. Submit for audit"
      />
    </div>
  );
}
