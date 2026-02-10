import Link from "next/link";
import { redirect } from "next/navigation";
import AuditFormClient from "@/components/audit-form/AuditFormClient";
import { CLINIC_AUDIT_SECTIONS } from "@/lib/clinicAuditForm";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { canAccessCase } from "@/lib/case-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function ClinicFormPage({ params }: { params: Promise<{ caseId: string }> }) {
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

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href={`/cases/${caseId}`} className="text-sm text-gray-600 hover:underline">← Back to case</Link>
      </div>
      <h1 className="text-2xl font-bold mb-2">Clinic Audit Form</h1>
      <p className="text-gray-600 mb-8">About 15–20 minutes. Clinic performance, facilities, and pricing.</p>

      <AuditFormClient
        caseId={caseId}
        caseStatus={c.status ?? "draft"}
        submittedAt={c.submitted_at}
        sections={CLINIC_AUDIT_SECTIONS}
        loadUrl={`/api/clinic-answers?caseId=${caseId}`}
        saveUrl={`/api/clinic-answers?caseId=${caseId}`}
        payloadKey="clinicAnswers"
        title="Clinic Audit Form"
        description="Clinic performance, facilities, staff, and pricing structure."
        backHref={`/cases/${caseId}`}
        visualRecordsSection={
          <section className="rounded-xl border border-gray-200 bg-gray-50 p-6">
            <h2 className="text-lg font-semibold mb-2">Visual Documentation (Optional)</h2>
            <p className="text-sm text-gray-600 mb-3">Clinic facilities, equipment, and procedure images.</p>
            <Link href={`/cases/${caseId}/clinic/photos`} className="text-amber-600 hover:underline font-medium">
              → Upload or view clinic images
            </Link>
          </section>
        }
      />
    </div>
  );
}
