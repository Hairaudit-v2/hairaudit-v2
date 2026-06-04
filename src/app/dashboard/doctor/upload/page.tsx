import { redirect } from "next/navigation";

// The doctor "upload" slot now routes into the shared Surgery Upload Portal.
export default function DoctorUploadPage() {
  redirect("/dashboard/surgery-upload");
}
