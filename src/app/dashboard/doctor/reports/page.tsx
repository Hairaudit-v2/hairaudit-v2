import { redirect } from "next/navigation";

// Demo reports table removed from production. View reports from each case: /cases/[caseId]
export default function DoctorReportsPage() {
  redirect("/dashboard/doctor");
}
