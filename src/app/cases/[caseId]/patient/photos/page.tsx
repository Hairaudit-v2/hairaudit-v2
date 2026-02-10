import Link from "next/link";
import { redirect } from "next/navigation";
import PatientPhotoUpload from "./patient-photo-upload";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";

type PageProps = { params: Promise<{ caseId: string }> };

export default async function Page({ params }: PageProps) {
  const { caseId } = await params;

  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Case (enforce ownership)
  const { data: c } = await supabase
    .from("cases")
    .select("id, status, submitted_at")
    .eq("id", caseId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!c) redirect("/dashboard");

  // Initial uploads
  const { data: uploads } = await supabase
    .from("uploads")
    .select("id, type, storage_path, metadata, created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  return (
    <div style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <div style={{ marginBottom: 12 }}>
        <Link href={`/cases/${caseId}`}>← Back to case</Link>
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 6 }}>
        Patient Photo Uploads
      </h1>

      <div style={{ color: "#555", marginBottom: 18 }}>
        Case: <code>{caseId}</code>
      </div>

      <PatientPhotoUpload
        caseId={caseId}
        initialUploads={uploads ?? []}
        caseStatus={c.status ?? "draft"}
        submittedAt={c.submitted_at}
      />
    </div>
  );
}
