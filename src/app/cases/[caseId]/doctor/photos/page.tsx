import Link from "next/link";
import { redirect } from "next/navigation";
import CategoryPhotoUpload from "@/components/uploads/CategoryPhotoUpload";
import { DOCTOR_PHOTO_CATEGORIES } from "@/lib/doctorPhotoCategories";
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
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <Link href={`/cases/${caseId}/doctor/form`} className="text-sm text-gray-600 hover:underline">← Back to Doctor Form</Link>
        <Link href={`/cases/${caseId}`} className="text-sm text-gray-600 hover:underline">Case overview</Link>
      </div>
      <h1 className="text-2xl font-bold mb-2">Doctor — Visual Records</h1>
      <p className="text-gray-600 mb-8">Pre-procedure, surgery, and post-procedure images (optional).</p>

      <CategoryPhotoUpload
        caseId={caseId}
        initialUploads={doctorUploads}
        caseStatus={c.status ?? "draft"}
        submittedAt={c.submitted_at}
        typePrefix="doctor_photo"
        categories={DOCTOR_PHOTO_CATEGORIES}
        uploadApiUrl="/api/uploads/doctor-photos"
      />
    </div>
  );
}
