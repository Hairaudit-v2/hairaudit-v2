import { redirect } from "next/navigation";

// Demo upload wizard removed from production. Use case-based flow: create case → /cases/[caseId]/doctor/form → /cases/[caseId]/doctor/photos
export default function DoctorUploadPage() {
  redirect("/dashboard/doctor");
}
