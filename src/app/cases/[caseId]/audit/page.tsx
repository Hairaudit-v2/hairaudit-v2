import Link from "next/link";
import { redirect } from "next/navigation";
import rubric from "@/lib/audit/rubrics/hairaudit_clinical_v1.json";
import AuditFormClient from "./AuditFormClient";
import PatientPhotoUploadClient from "./PatientPhotoUploadClient";
import PatientPhotosClient from "./PatientPhotosClient";
import PatientPhotoUpload from "./PatientPhotoUpload";
import AuditPhotoUploadClient from "./AuditPhotoUploadClient";
import ManualAuditFinalize from "./ManualAuditFinalize";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canAccessCase, getUserRole } from "@/lib/case-access";

type PageProps = { params: Promise<{ caseId: string }> };

const SECTION_ID = "patient_minimum_inputs";
const AUDITOR_EMAIL = "auditor@hairaudit.com";

export default async function AuditPage({ params }: PageProps) {
  const { caseId } = await params;

  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createSupabaseAdminClient();
  const { data: c } = await admin
    .from("cases")
    .select("id, status, user_id, patient_id, doctor_id, clinic_id")
    .eq("id", caseId)
    .maybeSingle();
  const allowed = await canAccessCase(user.id, c ?? null);
  if (!c || !allowed) redirect("/dashboard");

  const role = await getUserRole(user.id);
  const isAuditor = role === "auditor" || user.email === AUDITOR_EMAIL;

  const minSection =
    // @ts-ignore
    rubric?.domains
      ?.flatMap((d: any) => d.sections ?? [])
      .find((s: any) => s.section_id === SECTION_ID) ?? null;

  if (!minSection) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold">Audit Form</h1>
        <p>Could not find section <b>{SECTION_ID}</b> in the rubric JSON.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Link href={`/cases/${caseId}`} className="text-sm text-slate-600 hover:underline mb-4 block">
        ← Back to case
      </Link>
      <h1 className="text-2xl font-bold text-slate-900">Manual audit</h1>
      <p className="text-slate-600 mt-1">Case: {caseId}</p>

      {isAuditor && (c.status === "audit_failed" || c.status === "processing" || c.status === "submitted") && (
        <>
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-900">
              <strong>You can complete the manual audit without uploading any photos.</strong> Enter a score (0–100), notes, and key findings below, then click &quot;Finalize report&quot;. The photo sections further down are optional (for adding or reviewing evidence).
            </p>
          </div>
          <ManualAuditFinalize caseId={caseId} />
        </>
      )}

      <div className="mt-8 space-y-8">
        <h2 className="text-lg font-semibold text-slate-800">Optional: review or add photos</h2>
        <AuditFormClient caseId={caseId} />
        <PatientPhotoUpload caseId={caseId} />
        <PatientPhotoUploadClient caseId={caseId} />
        <PatientPhotosClient caseId={caseId} />
        <AuditPhotoUploadClient caseId={caseId} />
      </div>
    </div>
  );
}
