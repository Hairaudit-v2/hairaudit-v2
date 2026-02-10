import { redirect } from "next/navigation";
import PatientPhotoUpload from "./photos/patient-photo-upload";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";

export default async function Page({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: c } = await supabase
    .from("cases")
    .select("id, status, submitted_at")
    .eq("id", caseId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!c) redirect("/dashboard");

  const { data: uploads, error } = await supabase
    .from("uploads")
    .select("id, type, storage_path, metadata, created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  if (error) console.error(error);

  return (
    <PatientPhotoUpload
      caseId={caseId}
      initialUploads={uploads ?? []}
      caseStatus={c.status ?? "draft"}
      submittedAt={c.submitted_at}
    />
  );
}
