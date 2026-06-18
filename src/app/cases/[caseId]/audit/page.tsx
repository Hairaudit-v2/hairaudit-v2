import { redirect } from "next/navigation";

export const metadata = {
  title: "Patient Photo Upload | HairAudit",
};

/** Legacy route — canonical patient upload is /cases/[caseId]/patient/photos */
export default async function PatientPhotoAuditPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  redirect(`/cases/${caseId}/patient/photos`);
}
