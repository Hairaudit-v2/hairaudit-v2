import Link from "next/link";
import { redirect } from "next/navigation";
import PhotoUploader from "@/components/photos/PhotoUploader";
import { buildPatientLoginHref } from "@/lib/auth/patientLogin";
import { loadPatientPhotoStageGuidanceForCase } from "@/lib/patientPhoto/loadPatientPhotoStageGuidanceForCase";
import { resolvePatientReviewPathwayFromCase } from "@/lib/patient/patientReviewPathway";
import { getQuestionsHrefAfterRequiredImages } from "@/lib/patient/patientPathwayQuestionnaire";
import { parseDonorEntryContext } from "@/lib/patient/donorHealingEntry";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type PageProps = {
  params: Promise<{ caseId: string }>;
  searchParams?: Promise<{ entry_context?: string }>;
};

export default async function Page({ params, searchParams }: PageProps) {
  const { caseId } = await params;
  const query = searchParams ? await searchParams : {};

  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(buildPatientLoginHref(`/cases/${caseId}/patient/photos`));

  const { data: c } = await supabase
    .from("cases")
    .select("id, status, submitted_at, user_id, patient_id, patient_review_pathway")
    .eq("id", caseId)
    .maybeSingle();

  const allowed = !!c && (c.user_id === user.id || c.patient_id === user.id);
  if (!allowed) redirect("/dashboard");

  const { data: uploads } = await supabase
    .from("uploads")
    .select("id, type, storage_path, metadata, created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  const patientUploads = (uploads ?? []).filter((u) =>
    String(u.type ?? "").startsWith("patient_photo:")
  );

  const patientPhotoStageGuidance = await loadPatientPhotoStageGuidanceForCase(supabase, caseId);
  const patientReviewPathway = resolvePatientReviewPathwayFromCase(c);

  let entryContext = parseDonorEntryContext(query.entry_context);
  try {
    const admin = createSupabaseAdminClient();
    const { data: report } = await admin
      .from("reports")
      .select("summary, patient_audit_v2")
      .eq("case_id", caseId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const summary = (report?.summary ?? {}) as Record<string, unknown>;
    const v2 = (report?.patient_audit_v2 ?? {}) as Record<string, unknown>;
    entryContext =
      entryContext ??
      parseDonorEntryContext(summary.entry_context) ??
      parseDonorEntryContext(v2.entry_context) ??
      parseDonorEntryContext(
        (summary.patient_answers as Record<string, unknown> | undefined)?.entry_context
      );
  } catch {
    /* admin optional for entry context enrichment */
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-4">
        <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
          ← Home
        </Link>
      </div>

      <PhotoUploader
        caseId={caseId}
        submitterType="patient"
        initialUploads={patientUploads}
        caseStatus={c.status ?? "draft"}
        submittedAt={c.submitted_at}
        backHref="/"
        nextHref={getQuestionsHrefAfterRequiredImages(caseId)}
        nextLabel="Continue to questions"
        patientPhotoStageGuidance={patientPhotoStageGuidance}
        patientReviewPathway={patientReviewPathway}
        entryContext={entryContext}
      />
    </div>
  );
}
