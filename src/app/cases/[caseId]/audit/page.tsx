import rubric from "@/lib/audit/rubrics/hairaudit_clinical_v1.json";
import AuditFormClient from "./AuditFormClient";
import PatientPhotoUploadClient from "./PatientPhotoUploadClient";
import PatientPhotosClient from "./PatientPhotosClient";
import PatientPhotoUpload from "./PatientPhotoUpload";
import AuditPhotoUploadClient from "./AuditPhotoUploadClient";

type PageProps = { params: Promise<{ caseId: string }> };

const SECTION_ID = "patient_minimum_inputs";

export default async function AuditPage({ params }: PageProps) {
  const { caseId } = await params;

  const minSection =
    // @ts-ignore
    rubric?.domains
      ?.flatMap((d: any) => d.sections ?? [])
      .find((s: any) => s.section_id === SECTION_ID) ?? null;

  if (!minSection) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Audit Form</h1>
        <p>
          Could not find section <b>{SECTION_ID}</b> in the rubric JSON.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Audit Form</h1>
      <p style={{ color: "#555" }}>
        Case: <code>{caseId}</code>
      </p>

      <AuditFormClient caseId={caseId} />
      <PatientPhotoUpload caseId={caseId} />
      {/* NEW: Photo uploads */}
      <PatientPhotoUploadClient caseId={caseId} />
    </div>
  );
}
